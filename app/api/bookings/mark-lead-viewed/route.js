import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { userCanAccessBranch, DEFAULT_BRANCH_ID } from "../../../../lib/branches";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) throw new Error("User profile not found");
    const userData = userDoc.data();
    if (userData.status !== "approved") throw new Error("User account is pending approval or disabled");
    return userData;
}

// Deliberately NOT routed through the main bookings PUT — that recomputes
// pricing and appends an audit-log/job-chat entry on every save, which would
// spam "Booking updated to Lead" noise every time someone merely opens a
// lead to look at it. This just clears one flag.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const { bookingId } = await request.json();
        if (!bookingId) return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const snap = await bookingRef.get();
        if (!snap.exists) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

        const booking = snap.data();
        if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        await bookingRef.set({
            googleGmail: { ...(booking.googleGmail || {}), unread: false },
        }, { merge: true });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
        console.error("POST bookings/mark-lead-viewed error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
    }
}
