import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { ROLE_DEFINITIONS, canManageBranch, normalizeRole } from "../../../lib/permissions";
import {
    DEFAULT_BRANCH_ID,
    findBranchForAddress,
    getBranchById,
    getBranchScopeForUser,
    userCanAccessBranch,
    buildBranchRecordFields
} from "../../../lib/branches";
import { generateReferralCode } from "../../../lib/promotions";

const BOOKING_STATUS_FLOW = ["Lead", "Follow Up", "Pending", "Confirmed", "Completed", "Cancelled"];
const PAYMENT_STATUS_FLOW = ["unpaid", "paid", "redo"];

function normalizeBookingStatus(status = "Lead") {
    return BOOKING_STATUS_FLOW.includes(status) ? status : "Lead";
}

function normalizePaymentStatus(status = "unpaid") {
    return PAYMENT_STATUS_FLOW.includes(status) ? status : "unpaid";
}

async function generateBookingOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = `STC-${year}-`;
    const snapshot = await adminDb.collection("bookings").get();
    const existing = snapshot.size + 1;
    return `${prefix}${String(existing).padStart(4, "0")}`;
}

function appendBookingAuditLog(existingLog = [], event = {}) {
    return [
        ...(Array.isArray(existingLog) ? existingLog : []),
        {
            id: `log-${Date.now()}`,
            at: new Date().toISOString(),
            ...event
        }
    ];
}

function calculateCatalogCartItems(requestedItems = [], catalog = {}) {
    if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
        return { error: "At least one catalog service is required." };
    }

    const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
    const bathrooms = catalog.bathrooms && typeof catalog.bathrooms === "object" ? catalog.bathrooms : {};
    const items = [];

    for (const requestedItem of requestedItems) {
        const category = categories.find(candidate => candidate.id === requestedItem.categoryId);
        if (!category) {
            return { error: `Service ${requestedItem.name || requestedItem.categoryId || "unknown"} is not available in Catalog Studio.` };
        }

        const sizes = Array.isArray(category.sizes) ? category.sizes : [];
        const selectedSize = sizes.find(size => size.id === requestedItem.optionId);
        if (sizes.length > 0 && !selectedSize) {
            return { error: `Select a valid catalog tier for ${category.name}.` };
        }

        const basePrice = Number(selectedSize?.price ?? category.baseRate ?? 0);
        const durationHrs = Number(selectedSize?.durationHrs ?? category.durationHrs ?? 0);
        const isHouseCleaning = category.id === "house_cleaning";
        const bathroomKey = isHouseCleaning ? String(requestedItem.bathroomKey || "1 Bathroom") : "";
        if (isHouseCleaning && !Object.prototype.hasOwnProperty.call(bathrooms, bathroomKey)) {
            return { error: `Select a valid bathroom tier for ${category.name}.` };
        }
        const bathroomPrice = isHouseCleaning ? Number(bathrooms[bathroomKey] || 0) : 0;

        const catalogAddons = Array.isArray(category.addons) ? category.addons : [];
        const selectedAddons = [];
        for (const requestedAddon of Array.isArray(requestedItem.addons) ? requestedItem.addons : []) {
            const addon = catalogAddons.find(candidate => candidate.id === requestedAddon.id);
            if (!addon) {
                return { error: `Add-on ${requestedAddon.name || requestedAddon.id || "unknown"} is not available for ${category.name}.` };
            }
            const qty = addon.qtySelector
                ? Math.max(1, Number.parseInt(requestedAddon.qty || 1, 10))
                : 1;
            const price = Number(addon.price || 0);
            selectedAddons.push({
                id: addon.id,
                name: addon.name,
                price,
                qty,
                total: price * qty
            });
        }

        const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.total, 0);
        items.push({
            cartId: requestedItem.cartId || `${category.id}-${Date.now()}-${items.length}`,
            categoryId: category.id,
            name: category.name,
            pricingModel: category.pricingModel || "flat_rate",
            optionId: selectedSize?.id || "base",
            optionName: selectedSize?.name || "Base service",
            basePrice,
            bathroomKey,
            bathroomPrice,
            price: basePrice + bathroomPrice + addonTotal,
            durationHrs,
            configuredExtras: isHouseCleaning ? [{
                id: "bathrooms",
                name: bathroomKey,
                price: bathroomPrice,
                qty: 1,
                total: bathroomPrice
            }] : [],
            addons: selectedAddons
        });
    }

    return { items };
}

// Shared Secure JWT and Role verification helper
async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    
    // 1. Verify standard Firebase ID JWT token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // 2. Fetch official role/status from users collection (server-authoritative check)
    const userRef = adminDb.collection("users").doc(uid);
    let userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        // Safe auto-creation in case the user exists in Firebase Auth but has no Firestore document profile yet
        const usersSnap = await adminDb.collection("users").limit(1).get();
        const isFirst = usersSnap.empty;
        
        const newUser = {
            uid,
            name: decodedToken.name || decodedToken.email.split("@")[0],
            email: decodedToken.email,
            role: isFirst ? "super-admin" : "cleaner",
            departmentIds: isFirst ? ROLE_DEFINITIONS["super-admin"].departments : ROLE_DEFINITIONS.cleaner.departments,
            branchId: "ottawa-ca",
            branchIds: ["ottawa-ca"],
            branchName: "Ottawa",
            teamId: "",
            status: isFirst ? "approved" : "pending_approval",
            createdAt: new Date().toISOString()
        };
        await userRef.set(newUser);
        return newUser;
    }
    
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    
    return userData;
}

// 1. Scoped READ: Return branch bookings for admins, own bookings for customers, or assigned jobs for field staff.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        const { searchParams } = new URL(request.url);
        const requestedBranchId = searchParams.get("branchId");
        const branchScope = getBranchScopeForUser(user);
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;
        
        let query = adminDb.collection("bookings");
        let branchFilterId = null;
        if (role === "cleaner" || role === "subcontractor" || role === "supervisor") {
            query = query.where("assignedStaffIds", "array-contains", user.uid);
        } else if (role === "customer") {
            query = query.where("email", "==", user.email);
        } else if (!branchScope.canSwitchBranches || requestedBranchId) {
            if (!userCanAccessBranch(user, activeBranchId)) {
                return NextResponse.json({ error: "Forbidden: You cannot access this branch." }, { status: 403 });
            }
            branchFilterId = activeBranchId;
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            const booking = doc.data();
            const bookingBranchId = booking.branchId || DEFAULT_BRANCH_ID;
            if (!branchFilterId || bookingBranchId === branchFilterId) {
                const isFieldStaff = role === "cleaner" || role === "subcontractor" || role === "supervisor" || role === "employee";
                list.push({
                    ...booking,
                    clientName: isFieldStaff ? (booking.firstName || booking.clientName?.split(" ")[0] || "Client") : booking.clientName,
                    lastName: isFieldStaff ? "" : booking.lastName,
                    email: isFieldStaff ? "" : booking.email,
                    phone: isFieldStaff ? "" : booking.phone,
                    price: isFieldStaff ? undefined : booking.price,
                    subtotal: isFieldStaff ? undefined : booking.subtotal,
                    tax: isFieldStaff ? undefined : booking.tax,
                    branchId: bookingBranchId
                });
            }
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Bookings Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. Scoped CREATE: Add booking. Scheduling is based on assigned people, not fixed crews.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        const bookingData = await request.json();
        
        if (!bookingData.clientName || !bookingData.date || !bookingData.time) {
            return NextResponse.json({ error: "Missing required booking details." }, { status: 400 });
        }

        const matchedBranch = bookingData.branchId
            ? getBranchById(bookingData.branchId)
            : findBranchForAddress({
                city: bookingData.city,
                country: bookingData.country,
                postalCode: bookingData.postalCode
            });

        if (!matchedBranch) {
            return NextResponse.json({
                error: "We do not service this area yet. A lead should be created for admin follow-up."
            }, { status: 422 });
        }

        if (!userCanAccessBranch(user, matchedBranch.id) && role !== "customer") {
            return NextResponse.json({ error: "Forbidden: You cannot create bookings for this branch." }, { status: 403 });
        }
        
        const id = bookingData.id || `bk-${Date.now()}`;
        const orderNumber = bookingData.orderNumber || await generateBookingOrderNumber();
        const bookingStatus = normalizeBookingStatus(bookingData.status || "Lead");
        const paymentStatus = normalizePaymentStatus(bookingData.paymentStatus || "unpaid");
        const subtotal = parseFloat(bookingData.subtotal || bookingData.price || 0);
        const tax = paymentStatus === "redo"
            ? 0
            : bookingData.tax !== undefined
                ? parseFloat(bookingData.tax || 0)
                : subtotal * matchedBranch.taxRate;
        const total = paymentStatus === "redo" ? 0 : parseFloat(bookingData.price || subtotal + tax);
        const customerPortalPhone = bookingData.customerPortalPhone || bookingData.phone || "";
        const newBooking = {
            ...bookingData,
            ...buildBranchRecordFields(matchedBranch, user),
            id,
            orderNumber,
            team: "",
            assignedStaff: Array.isArray(bookingData.assignedStaff) ? bookingData.assignedStaff : [],
            assignedStaffIds: Array.isArray(bookingData.assignedStaffIds) ? bookingData.assignedStaffIds : [],
            subtotal,
            tax,
            price: total,
            status: bookingStatus,
            paymentStatus,
            documentStage: ["Lead", "Follow Up", "Pending"].includes(bookingStatus) ? "estimate" : "booking",
            estimateNumber: ["Lead", "Follow Up", "Pending"].includes(bookingStatus) ? orderNumber : "",
            invoiceNumber: "",
            customerPortalPhone,
            referralCode: bookingData.referralCode || generateReferralCode(customerPortalPhone, orderNumber, bookingData.clientName),
            duration: parseFloat(bookingData.duration || 2),
            createdAt: new Date().toISOString(),
            createdBy: user.email,
            auditLog: appendBookingAuditLog([], {
                type: "created",
                by: user.email || user.uid,
                summary: `Booking created as ${bookingStatus}`,
                status: bookingStatus,
                paymentStatus
            })
        };
        
        await adminDb.collection("bookings").doc(id).set(newBooking);
        return NextResponse.json({ message: "Booking created successfully", booking: newBooking }, { status: 200 });
    } catch (err) {
        console.error("POST Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 3. Scoped UPDATE: Immediate merge for Admins; creates approval Edit Request for Team Leaders
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        const bookingData = await request.json();
        
        if (!bookingData.id) {
            return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
        }
        
        const bookingRef = adminDb.collection("bookings").doc(bookingData.id);
        const existingDoc = await bookingRef.get();
        if (!existingDoc.exists) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
        
        const originalData = existingDoc.data();
        if (!userCanAccessBranch(user, originalData.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden: You cannot modify this branch booking." }, { status: 403 });
        }
        
        if ((role === "cleaner" || role === "subcontractor" || role === "supervisor") && !originalData.assignedStaffIds?.includes(user.uid)) {
            return NextResponse.json({ error: "Forbidden: You are not assigned to this job." }, { status: 403 });
        }
        
        if (canManageBranch(user)) {
            const overrideRequested = bookingData.priceOverride === true;
            const catalogEditRequested = bookingData.servicesChanged === true;
            if (overrideRequested && role !== "super-admin") {
                return NextResponse.json({ error: "Forbidden: Only Super Admin can override service names or prices." }, { status: 403 });
            }

            let protectedCartItems = Array.isArray(originalData.cartItems) ? originalData.cartItems : [];
            let protectedService = originalData.service || "Cleaning Service";
            let protectedSubtotal = Number(originalData.subtotal ?? originalData.price ?? 0);
            let protectedTax = Number(originalData.tax ?? 0);
            let protectedDuration = Number(originalData.duration ?? 0);

            if (overrideRequested) {
                if (!Array.isArray(bookingData.cartItems) || bookingData.cartItems.length === 0) {
                    return NextResponse.json({ error: "At least one manual service is required for an override." }, { status: 400 });
                }
                protectedCartItems = bookingData.cartItems.map((item, index) => ({
                    ...item,
                    cartId: item.cartId || `override-${Date.now()}-${index}`,
                    name: String(item.name || `Manual Service ${index + 1}`).trim(),
                    price: Math.max(0, Number(item.price || 0)),
                    durationHrs: Math.max(0, Number(item.durationHrs || 0)),
                    addons: Array.isArray(item.addons) ? item.addons : []
                }));
                protectedService = protectedCartItems.map(item => item.name).join(" + ");
                protectedSubtotal = protectedCartItems.reduce((sum, item) => sum + item.price, 0);
                protectedDuration = protectedCartItems.reduce((sum, item) => sum + item.durationHrs, 0);
                const taxRate = Number(originalData.companySnapshot?.taxRate ?? originalData.taxRate ?? 0.13);
                protectedTax = protectedSubtotal * taxRate;
            } else if (catalogEditRequested) {
                const settingsDoc = await adminDb.collection("settings").doc("pricing").get();
                const catalog = settingsDoc.exists ? settingsDoc.data()?.v2_catalog : null;
                const catalogResult = calculateCatalogCartItems(bookingData.cartItems, catalog || {});
                if (catalogResult.error) {
                    return NextResponse.json({ error: catalogResult.error }, { status: 400 });
                }
                protectedCartItems = catalogResult.items;
                protectedService = protectedCartItems.map(item => item.name).join(" + ");
                protectedSubtotal = protectedCartItems.reduce((sum, item) => sum + item.price, 0);
                protectedDuration = protectedCartItems.reduce((sum, item) => sum + item.durationHrs, 0);
                const taxRate = Number(originalData.companySnapshot?.taxRate ?? originalData.taxRate ?? 0.13);
                protectedTax = protectedSubtotal * taxRate;
            }

            const nextStatus = normalizeBookingStatus(bookingData.status ?? originalData.status ?? "Lead");
            const nextPaymentStatus = normalizePaymentStatus(bookingData.paymentStatus ?? originalData.paymentStatus ?? "unpaid");
            const requestedDocumentStage = String(bookingData.documentStage || "").toLowerCase();
            const nextDocumentStage = requestedDocumentStage === "invoice"
                ? "invoice"
                : ["Lead", "Follow Up", "Pending"].includes(nextStatus)
                    ? "estimate"
                    : "booking";
            const fixedDiscount = Math.max(0, Number(bookingData.customDiscountAmount ?? originalData.customDiscountAmount ?? 0));
            const percentDiscount = Math.min(100, Math.max(0, Number(bookingData.customDiscountPercent ?? originalData.customDiscountPercent ?? 0)));
            const percentDiscountValue = protectedSubtotal * (percentDiscount / 100);
            const totalDiscount = Math.min(protectedSubtotal, fixedDiscount + percentDiscountValue);
            const nextPrice = nextPaymentStatus === "redo" ? 0 : Math.max(0, protectedSubtotal + protectedTax - totalDiscount);
            const safeBookingData = { ...bookingData };
            delete safeBookingData.priceOverride;
            delete safeBookingData.servicesChanged;
            const updatedBooking = {
                ...originalData,
                ...safeBookingData,
                service: protectedService,
                cartItems: protectedCartItems,
                customerPortalPhone: bookingData.customerPortalPhone ?? bookingData.phone ?? originalData.customerPortalPhone ?? originalData.phone ?? "",
                referralCode: bookingData.referralCode || originalData.referralCode || generateReferralCode(
                    bookingData.customerPortalPhone ?? bookingData.phone ?? originalData.customerPortalPhone ?? originalData.phone ?? "",
                    bookingData.invoiceNumber || bookingData.estimateNumber || bookingData.orderNumber || originalData.invoiceNumber || originalData.estimateNumber || originalData.orderNumber,
                    bookingData.clientName || originalData.clientName
                ),
                price: nextPrice,
                status: nextStatus,
                paymentStatus: nextPaymentStatus,
                tax: nextPaymentStatus === "redo" ? 0 : protectedTax,
                subtotal: nextPaymentStatus === "redo" ? 0 : protectedSubtotal,
                documentStage: nextDocumentStage,
                estimateNumber: nextDocumentStage === "estimate"
                    ? (originalData.estimateNumber || originalData.orderNumber || "")
                    : (originalData.estimateNumber || ""),
                invoiceNumber: nextDocumentStage === "invoice"
                    ? (bookingData.invoiceNumber || originalData.invoiceNumber || originalData.orderNumber || "")
                    : (originalData.invoiceNumber || ""),
                duration: protectedDuration,
                servicePriceOverride: overrideRequested ? {
                    active: true,
                    at: new Date().toISOString(),
                    by: user.email || user.uid
                } : catalogEditRequested ? null : originalData.servicePriceOverride || null,
                updatedAt: new Date().toISOString(),
                updatedBy: user.email,
                auditLog: appendBookingAuditLog(originalData.auditLog, {
                    type: overrideRequested ? "service_price_override" : catalogEditRequested ? "catalog_service_update" : "updated",
                    by: user.email || user.uid,
                    summary: overrideRequested
                        ? "Super Admin manually overrode service name or price"
                        : catalogEditRequested
                            ? "Booking services updated from Catalog Studio"
                            : `${nextDocumentStage === "invoice" ? "Invoice generated" : `Booking updated to ${nextStatus}`}`,
                    status: nextStatus,
                    paymentStatus: nextPaymentStatus
                })
            };
            await bookingRef.set(updatedBooking);
            return NextResponse.json({ message: "Booking updated directly by Admin", booking: updatedBooking }, { status: 200 });
        } else {
            // Team Leader updates: Write to review table 'editRequests' for Admin approval
            const reqId = `req-${Date.now()}`;
            const requestedStatus = normalizeBookingStatus(bookingData.status ?? originalData.status ?? "Lead");
            const requestedPaymentStatus = normalizePaymentStatus(bookingData.paymentStatus ?? originalData.paymentStatus ?? "unpaid");
            const safeRequestedBookingData = { ...bookingData };
            delete safeRequestedBookingData.priceOverride;
            delete safeRequestedBookingData.servicesChanged;
            const editRequest = {
                id: reqId,
                bookingId: bookingData.id,
                clientName: originalData.clientName,
                requestedBy: user.email,
                createdAt: new Date().toISOString(),
                status: "Pending",
                originalData: originalData,
                requestedData: {
                    ...originalData,
                    ...safeRequestedBookingData,
                    service: originalData.service,
                    cartItems: originalData.cartItems,
                    price: requestedPaymentStatus === "redo" ? 0 : Number(originalData.price || 0),
                    subtotal: requestedPaymentStatus === "redo" ? 0 : Number(originalData.subtotal ?? originalData.price ?? 0),
                    tax: requestedPaymentStatus === "redo" ? 0 : Number(originalData.tax || 0),
                    status: requestedStatus,
                    paymentStatus: requestedPaymentStatus,
                    documentStage: ["Lead", "Follow Up", "Pending"].includes(requestedStatus) ? "estimate" : "booking",
                    duration: Number(originalData.duration || 0)
                }
            };
            
            await adminDb.collection("editRequests").doc(reqId).set(editRequest);
            return NextResponse.json({ message: "Booking edit request sent to Admin inbox for approval", requestId: reqId }, { status: 202 });
        }
    } catch (err) {
        console.error("PUT Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 4. Scoped DELETE: Admin-only booking soft cancellation
export async function DELETE(request) {
    try {
        const user = await authenticateRequest(request);
        const { searchParams } = new URL(request.url);
        const bookingId = searchParams.get("id");
        
        if (!bookingId) {
            return NextResponse.json({ error: "Missing booking ID in URL params" }, { status: 400 });
        }
        
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Team Leaders are not authorized to cancel bookings." }, { status: 403 });
        }
        
        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const existingDoc = await bookingRef.get();
        if (!existingDoc.exists) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
        
        const originalData = existingDoc.data();
        if (!userCanAccessBranch(user, originalData.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden: You cannot cancel this branch booking." }, { status: 403 });
        }
        const cancelledBooking = {
            ...originalData,
            status: "Cancelled",
            updatedAt: new Date().toISOString(),
            updatedBy: user.email
        };
        await bookingRef.set(cancelledBooking);
        
        return NextResponse.json({ message: "Booking soft-cancelled successfully", booking: cancelledBooking }, { status: 200 });
    } catch (err) {
        console.error("DELETE Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
