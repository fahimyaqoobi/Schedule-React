import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch, normalizeRole } from "../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser, userCanAccessBranch } from "../../../lib/branches";
import { calculatePayrollBreakdown, DEFAULT_PAY_RATE, normalizePayrollSettings } from "../../../lib/payroll";

const GEO_RADIUS_METERS = 200;

function haversineMeters(pointA, pointB) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(pointB.lat - pointA.lat);
    const dLng = toRadians(pointB.lng - pointA.lng);
    const lat1 = toRadians(pointA.lat);
    const lat2 = toRadians(pointB.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDurationMinutes(startedAt, endedAt) {
    if (!startedAt || !endedAt) return 0;
    return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
}

function toIsoOrFallback(value, fallback = "") {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toISOString();
}

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new Error("User profile not found");
    }
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

async function getBookingForUser(bookingId, user) {
    const bookingRef = adminDb.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new Error("Assigned job not found.");
    }
    const booking = bookingSnap.data();
    const role = normalizeRole(user.role);
    if (["cleaner", "subcontractor", "supervisor", "employee"].includes(role) && !booking.assignedStaffIds?.includes(user.uid)) {
        throw new Error("You are not assigned to this job.");
    }
    if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID)) {
        throw new Error("You cannot access this branch booking.");
    }
    return booking;
}

export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get("status");
        const branchScope = getBranchScopeForUser(user);
        const requestedBranchId = searchParams.get("branchId");
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

        let query = adminDb.collection("timeEntries");
        if (canManageBranch(user)) {
            query = query.where("branchId", "==", activeBranchId);
        } else {
            query = query.where("cleanerUid", "==", user.uid);
        }

        const snapshot = await query.get();
        const entries = [];
        snapshot.forEach((doc) => {
            const entry = doc.data();
            if (entry.status === "deleted") return;
            if (!statusFilter || entry.status === statusFilter) {
                entries.push(entry);
            }
        });
        entries.sort((a, b) => new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime());
        return NextResponse.json(entries, { status: 200 });
    } catch (error) {
        console.error("GET time entries error:", error);
        return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        const body = await request.json();
        if (body.action === "admin_create_manual") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Only admins can create manual time cards." }, { status: 403 });
            }
            const { cleanerUid, bookingId, startedAt, endedAt, unpaidBreakMinutes } = body;
            if (!cleanerUid || !startedAt || !endedAt) {
                return NextResponse.json({ error: "Cleaner, start time, and finish time are required." }, { status: 400 });
            }
            const cleanerDoc = await adminDb.collection("users").doc(cleanerUid).get();
            if (!cleanerDoc.exists) {
                return NextResponse.json({ error: "Employee not found." }, { status: 404 });
            }
            const cleaner = cleanerDoc.data();
            if (!userCanAccessBranch(user, cleaner.branchId || DEFAULT_BRANCH_ID)) {
                return NextResponse.json({ error: "You cannot create time cards for this branch." }, { status: 403 });
            }
            const payroll = normalizePayrollSettings(cleaner.staffProfile?.employment || {});
            const startIso = toIsoOrFallback(startedAt);
            const endIso = toIsoOrFallback(endedAt);
            const breakMinutes = Math.max(0, Number(unpaidBreakMinutes || 0));
            const durationMinutes = Math.max(0, getDurationMinutes(startIso, endIso) - breakMinutes);
            const payrollBreakdown = calculatePayrollBreakdown(durationMinutes, payroll);
            const id = `te-${Date.now()}`;
            const booking = bookingId ? await adminDb.collection("bookings").doc(bookingId).get() : null;
            const bookingData = booking?.exists ? booking.data() : {};
            const entry = {
                id,
                bookingId: bookingId || "",
                branchId: bookingData.branchId || cleaner.branchId || DEFAULT_BRANCH_ID,
                branchName: bookingData.branchName || cleaner.branchName || "Ottawa",
                cleanerUid,
                cleanerName: cleaner.name || cleaner.email || "Employee",
                cleanerRole: normalizeRole(cleaner.role),
                serviceName: bookingData.service || "Manual payroll entry",
                customerFirstName: bookingData.firstName || "",
                locationLabel: [bookingData.address1, bookingData.city].filter(Boolean).join(", "),
                bookingDate: bookingData.date || startIso.split("T")[0],
                scheduledTime: bookingData.time || "",
                bookingPrice: Number(bookingData.price || 0),
                payRate: payroll.hourlyRate,
                overtimeRate: payroll.overtimeRate,
                overtimeAfterHours: payroll.overtimeAfterHours,
                payrollStatus: payroll.payrollStatus,
                status: "approved",
                startedAt: startIso,
                endedAt: endIso,
                unpaidBreakMinutes: breakMinutes,
                durationMinutes,
                grossPayEstimate: payrollBreakdown.grossPay,
                payrollBreakdown,
                geofenceRadiusMeters: GEO_RADIUS_METERS,
                startLocation: null,
                siteLocation: bookingData.location || null,
                startDistanceMeters: null,
                endLocation: null,
                endDistanceMeters: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                reviewedAt: new Date().toISOString(),
                reviewedBy: user.email || user.uid,
                source: "admin_manual"
            };
            await adminDb.collection("timeEntries").doc(id).set(entry);
            return NextResponse.json({ message: "Manual time card added.", entry }, { status: 200 });
        }

        if (body.action === "admin_checkin") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Only admins can clock in on behalf of staff." }, { status: 403 });
            }
            const { cleanerUid, bookingId: adminBookingId, startedAt: adminStartedAt } = body;
            if (!cleanerUid || !adminBookingId) {
                return NextResponse.json({ error: "Staff member and booking are required." }, { status: 400 });
            }
            const cleanerDoc = await adminDb.collection("users").doc(cleanerUid).get();
            if (!cleanerDoc.exists) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
            const cleaner = cleanerDoc.data();
            const existingActive = await adminDb.collection("timeEntries")
                .where("cleanerUid", "==", cleanerUid).where("status", "==", "active").limit(1).get();
            if (!existingActive.empty) {
                return NextResponse.json({ error: `${cleaner.name || "This staff member"} already has an active shift.` }, { status: 400 });
            }
            const bookingSnap = await adminDb.collection("bookings").doc(adminBookingId).get();
            const booking = bookingSnap.exists ? bookingSnap.data() : {};
            const payroll = normalizePayrollSettings(cleaner.staffProfile?.employment || {});
            const startIso = adminStartedAt ? toIsoOrFallback(adminStartedAt) : new Date().toISOString();
            const id = `te-${Date.now()}`;
            const entry = {
                id, bookingId: adminBookingId,
                branchId: booking.branchId || cleaner.branchId || DEFAULT_BRANCH_ID,
                branchName: booking.branchName || cleaner.branchName || "Ottawa",
                cleanerUid, cleanerName: cleaner.name || cleaner.email || "Staff",
                cleanerRole: normalizeRole(cleaner.role),
                serviceName: booking.service || "Assigned Job",
                customerFirstName: booking.firstName || booking.clientName?.split(" ")[0] || "Client",
                locationLabel: [booking.address1, booking.city].filter(Boolean).join(", "),
                bookingDate: booking.date || startIso.split("T")[0],
                scheduledTime: booking.time || "",
                bookingPrice: Number(booking.price || 0),
                payRate: payroll.hourlyRate, overtimeRate: payroll.overtimeRate,
                overtimeAfterHours: payroll.overtimeAfterHours, payrollStatus: payroll.payrollStatus,
                status: "active", startedAt: startIso, endedAt: "", durationMinutes: 0, grossPayEstimate: 0,
                geofenceRadiusMeters: GEO_RADIUS_METERS, startLocation: null,
                siteLocation: booking.location || null, startDistanceMeters: null,
                endLocation: null, endDistanceMeters: null,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                source: "admin_override"
            };
            await adminDb.collection("timeEntries").doc(id).set(entry);
            return NextResponse.json({ message: `Clocked in ${cleaner.name || "staff member"} successfully.`, entry }, { status: 200 });
        }

        if (!["cleaner", "subcontractor", "supervisor", "employee"].includes(role)) {
            return NextResponse.json({ error: "Only field staff can clock into jobs." }, { status: 403 });
        }
        const { bookingId, currentLocation, jobLocation } = body;
        if (!bookingId || !currentLocation?.lat || !currentLocation?.lng) {
            return NextResponse.json({ error: "Booking and current geolocation are required." }, { status: 400 });
        }

        const booking = await getBookingForUser(bookingId, user);
        const activeEntrySnap = await adminDb.collection("timeEntries")
            .where("cleanerUid", "==", user.uid)
            .where("status", "==", "active")
            .limit(1)
            .get();
        if (!activeEntrySnap.empty) {
            return NextResponse.json({ error: "You already have an active shift running." }, { status: 400 });
        }

        const targetLocation = booking.location?.lat && booking.location?.lng ? booking.location : jobLocation;
        if (!targetLocation?.lat || !targetLocation?.lng) {
            return NextResponse.json({ error: "This job is missing a saved site location. Ask admin to re-save the booking address." }, { status: 400 });
        }

        const distanceMeters = haversineMeters(
            { lat: Number(currentLocation.lat), lng: Number(currentLocation.lng) },
            { lat: Number(targetLocation.lat), lng: Number(targetLocation.lng) }
        );
        if (distanceMeters > GEO_RADIUS_METERS) {
            return NextResponse.json({ error: `You must be within ${GEO_RADIUS_METERS} meters of the job site to check in.` }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const id = `te-${Date.now()}`;
        const payroll = normalizePayrollSettings(user.staffProfile?.employment || {});
        const entry = {
            id,
            bookingId: booking.id,
            branchId: booking.branchId || DEFAULT_BRANCH_ID,
            branchName: booking.branchName || user.branchName || "Ottawa",
            cleanerUid: user.uid,
            cleanerName: user.name || user.email || "Cleaner",
            cleanerRole: role,
            serviceName: booking.service || "Assigned Job",
            customerFirstName: booking.firstName || booking.clientName?.split(" ")[0] || "Client",
            locationLabel: [booking.address1, booking.city].filter(Boolean).join(", "),
            bookingDate: booking.date || "",
            scheduledTime: booking.time || "",
            bookingPrice: Number(booking.price || 0),
            payRate: payroll.hourlyRate,
            overtimeRate: payroll.overtimeRate,
            overtimeAfterHours: payroll.overtimeAfterHours,
            payrollStatus: payroll.payrollStatus,
            status: "active",
            startedAt: nowIso,
            endedAt: "",
            durationMinutes: 0,
            grossPayEstimate: 0,
            geofenceRadiusMeters: GEO_RADIUS_METERS,
            startLocation: {
                lat: Number(currentLocation.lat),
                lng: Number(currentLocation.lng),
                accuracy: Number(currentLocation.accuracy || 0),
                recordedAt: nowIso
            },
            siteLocation: {
                lat: Number(targetLocation.lat),
                lng: Number(targetLocation.lng)
            },
            startDistanceMeters: Math.round(distanceMeters),
            endLocation: null,
            endDistanceMeters: null,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        await adminDb.collection("timeEntries").doc(id).set(entry);
        return NextResponse.json({ message: "Checked in successfully.", entry }, { status: 200 });
    } catch (error) {
        console.error("POST time entry error:", error);
        return NextResponse.json({ error: error.message || "Failed to check in." }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const body = await request.json();
        const { action, entryId, currentLocation, startedAt, endedAt, unpaidBreakMinutes } = body;

        if (action === "admin_checkout") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Only admins can clock out on behalf of staff." }, { status: 403 });
            }
            const { entryId: adminEntryId, endedAt: adminEndedAt } = body;
            if (!adminEntryId) return NextResponse.json({ error: "Time entry ID is required." }, { status: 400 });
            const entryRef = adminDb.collection("timeEntries").doc(adminEntryId);
            const entrySnap = await entryRef.get();
            if (!entrySnap.exists) return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
            const entry = entrySnap.data();
            const endIso = adminEndedAt ? toIsoOrFallback(adminEndedAt) : new Date().toISOString();
            const durationMinutes = getDurationMinutes(entry.startedAt, endIso);
            const payrollBreakdown = calculatePayrollBreakdown(durationMinutes, {
                hourlyRate: entry.payRate || DEFAULT_PAY_RATE,
                overtimeRate: entry.overtimeRate, overtimeAfterHours: entry.overtimeAfterHours
            });
            const updated = {
                ...entry, status: "pending_approval", endedAt: endIso, durationMinutes,
                grossPayEstimate: payrollBreakdown.grossPay, payrollBreakdown,
                endLocation: null, endDistanceMeters: null,
                updatedAt: new Date().toISOString(), source: (entry.source || "") + "+admin_override"
            };
            await entryRef.set(updated);
            return NextResponse.json({ message: "Clocked out staff member successfully. Entry pending approval.", entry: updated }, { status: 200 });
        }

        if (action === "checkout") {
            if (!entryId || !currentLocation?.lat || !currentLocation?.lng) {
                return NextResponse.json({ error: "Entry and geolocation are required for checkout." }, { status: 400 });
            }
            const entryRef = adminDb.collection("timeEntries").doc(entryId);
            const entrySnap = await entryRef.get();
            if (!entrySnap.exists) {
                return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
            }
            const entry = entrySnap.data();
            if (entry.cleanerUid !== user.uid) {
                return NextResponse.json({ error: "You cannot close another cleaner's time entry." }, { status: 403 });
            }
            if (entry.status !== "active") {
                return NextResponse.json({ error: "This shift is no longer active." }, { status: 400 });
            }
            const distanceMeters = haversineMeters(
                { lat: Number(currentLocation.lat), lng: Number(currentLocation.lng) },
                { lat: Number(entry.siteLocation?.lat), lng: Number(entry.siteLocation?.lng) }
            );
            if (distanceMeters > GEO_RADIUS_METERS) {
                return NextResponse.json({ error: `You must be within ${GEO_RADIUS_METERS} meters of the job site to check out.` }, { status: 400 });
            }
            const endedAt = new Date().toISOString();
            const durationMinutes = getDurationMinutes(entry.startedAt, endedAt);
            const payrollBreakdown = calculatePayrollBreakdown(durationMinutes, {
                hourlyRate: entry.payRate || DEFAULT_PAY_RATE,
                overtimeRate: entry.overtimeRate,
                overtimeAfterHours: entry.overtimeAfterHours
            });
            const updatedEntry = {
                ...entry,
                status: "pending_approval",
                endedAt,
                durationMinutes,
                grossPayEstimate: payrollBreakdown.grossPay,
                payrollBreakdown,
                endDistanceMeters: Math.round(distanceMeters),
                endLocation: {
                    lat: Number(currentLocation.lat),
                    lng: Number(currentLocation.lng),
                    accuracy: Number(currentLocation.accuracy || 0),
                    recordedAt: endedAt
                },
                updatedAt: endedAt
            };
            await entryRef.set(updatedEntry);
            return NextResponse.json({ message: "Checked out successfully. Awaiting payroll approval.", entry: updatedEntry }, { status: 200 });
        }

        if (action === "admin_edit") {
            if (normalizeRole(user.role) !== "super-admin") {
                return NextResponse.json({ error: "Only super admins can edit approved time entries." }, { status: 403 });
            }
            if (!entryId) return NextResponse.json({ error: "Entry ID required." }, { status: 400 });
            const entryRef = adminDb.collection("timeEntries").doc(entryId);
            const snap = await entryRef.get();
            if (!snap.exists) return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
            const entry = snap.data();
            const editStart = toIsoOrFallback(startedAt, entry.startedAt);
            const editEnd = toIsoOrFallback(endedAt, entry.endedAt);
            const editBreak = Math.max(0, Number(unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0));
            const editDuration = Math.max(0, getDurationMinutes(editStart, editEnd) - editBreak);
            const editBreakdown = calculatePayrollBreakdown(editDuration, {
                hourlyRate: entry.payRate || DEFAULT_PAY_RATE,
                overtimeRate: entry.overtimeRate,
                overtimeAfterHours: entry.overtimeAfterHours,
            });
            const updated = {
                ...entry,
                startedAt: editStart,
                endedAt: editEnd,
                unpaidBreakMinutes: editBreak,
                durationMinutes: editDuration,
                grossPayEstimate: editBreakdown.grossPay,
                payrollBreakdown: editBreakdown,
                updatedAt: new Date().toISOString(),
                reviewedAt: new Date().toISOString(),
                reviewedBy: user.email || user.uid,
            };
            await entryRef.set(updated);
            return NextResponse.json({ message: "Time entry updated.", entry: updated }, { status: 200 });
        }

        if (action === "approve" || action === "reject") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Only admins can review payroll entries." }, { status: 403 });
            }
            if (!entryId) {
                return NextResponse.json({ error: "Entry id is required." }, { status: 400 });
            }
            const entryRef = adminDb.collection("timeEntries").doc(entryId);
            const entrySnap = await entryRef.get();
            if (!entrySnap.exists) {
                return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
            }
            const entry = entrySnap.data();
            if (!userCanAccessBranch(user, entry.branchId || DEFAULT_BRANCH_ID)) {
                return NextResponse.json({ error: "You cannot review this branch entry." }, { status: 403 });
            }
            const reviewedStartedAt = action === "approve" ? toIsoOrFallback(startedAt, entry.startedAt) : entry.startedAt;
            const reviewedEndedAt = action === "approve" ? toIsoOrFallback(endedAt, entry.endedAt) : entry.endedAt;
            const normalizedBreak = action === "approve" ? Math.max(0, Number(unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0)) : Number(entry.unpaidBreakMinutes || 0);
            const adjustedDurationMinutes = action === "approve"
                ? Math.max(0, getDurationMinutes(reviewedStartedAt, reviewedEndedAt) - normalizedBreak)
                : entry.durationMinutes;
            const adjustedPayrollBreakdown = action === "approve"
                ? calculatePayrollBreakdown(adjustedDurationMinutes, {
                    hourlyRate: entry.payRate || DEFAULT_PAY_RATE,
                    overtimeRate: entry.overtimeRate,
                    overtimeAfterHours: entry.overtimeAfterHours
                })
                : entry.payrollBreakdown;
            const updatedEntry = {
                ...entry,
                status: action === "approve" ? "approved" : "rejected",
                startedAt: reviewedStartedAt,
                endedAt: reviewedEndedAt,
                unpaidBreakMinutes: normalizedBreak,
                durationMinutes: adjustedDurationMinutes,
                grossPayEstimate: action === "approve" ? adjustedPayrollBreakdown.grossPay : 0,
                payrollBreakdown: adjustedPayrollBreakdown,
                reviewedAt: new Date().toISOString(),
                reviewedBy: user.email || user.uid,
                updatedAt: new Date().toISOString()
            };
            await entryRef.set(updatedEntry);
            return NextResponse.json({ message: `Entry ${action}d successfully.`, entry: updatedEntry }, { status: 200 });
        }

        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
        console.error("PUT time entry error:", error);
        return NextResponse.json({ error: error.message || "Failed to update time entry." }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const user = await authenticateRequest(request);
        if (normalizeRole(user.role) !== "super-admin") {
            return NextResponse.json({ error: "Only super admins can delete time entries." }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const entryId = searchParams.get("id");
        if (!entryId) return NextResponse.json({ error: "Entry ID required." }, { status: 400 });
        const entryRef = adminDb.collection("timeEntries").doc(entryId);
        const snap = await entryRef.get();
        if (!snap.exists) return NextResponse.json({ error: "Time entry not found." }, { status: 404 });
        await entryRef.update({
            status: "deleted",
            deletedAt: new Date().toISOString(),
            deletedBy: user.email || user.uid,
            updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({ message: "Time entry soft-deleted." }, { status: 200 });
    } catch (error) {
        console.error("DELETE time entry error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete time entry." }, { status: 500 });
    }
}
