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
        const subtotal = parseFloat(bookingData.subtotal || bookingData.price || 0);
        const tax = bookingData.tax !== undefined ? parseFloat(bookingData.tax || 0) : subtotal * matchedBranch.taxRate;
        const total = parseFloat(bookingData.price || subtotal + tax);
        const newBooking = {
            ...bookingData,
            ...buildBranchRecordFields(matchedBranch, user),
            id,
            team: "",
            assignedStaff: Array.isArray(bookingData.assignedStaff) ? bookingData.assignedStaff : [],
            assignedStaffIds: Array.isArray(bookingData.assignedStaffIds) ? bookingData.assignedStaffIds : [],
            subtotal,
            tax,
            price: total,
            paymentStatus: bookingData.paymentStatus || "unpaid",
            duration: parseFloat(bookingData.duration || 2),
            createdAt: new Date().toISOString(),
            createdBy: user.email
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
            const updatedBooking = {
                ...originalData,
                ...bookingData,
                price: parseFloat(bookingData.price ?? originalData.price),
                paymentStatus: bookingData.paymentStatus ?? originalData.paymentStatus ?? "unpaid",
                duration: parseFloat(bookingData.duration ?? originalData.duration),
                updatedAt: new Date().toISOString(),
                updatedBy: user.email
            };
            await bookingRef.set(updatedBooking);
            return NextResponse.json({ message: "Booking updated directly by Admin", booking: updatedBooking }, { status: 200 });
        } else {
            // Team Leader updates: Write to review table 'editRequests' for Admin approval
            const reqId = `req-${Date.now()}`;
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
                    ...bookingData,
                    price: parseFloat(bookingData.price ?? originalData.price),
                    paymentStatus: bookingData.paymentStatus ?? originalData.paymentStatus ?? "unpaid",
                    duration: parseFloat(bookingData.duration ?? originalData.duration)
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
