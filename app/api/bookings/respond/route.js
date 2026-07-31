import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { createNotification } from "../../../../lib/notifications";

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

const VALID_RESPONSES = new Set(["confirmed", "declined"]);

// A cleaner tapping Confirm / Can't Make It on an assigned job. Only the
// assigned staff member's own confirmation entry is touched — no other
// booking field changes.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const { bookingId, response } = await request.json();

        if (!bookingId || !VALID_RESPONSES.has(response)) {
            return NextResponse.json({ error: "Missing bookingId or invalid response." }, { status: 400 });
        }

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const doc = await bookingRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

        const booking = doc.data();
        if (!(booking.assignedStaffIds || []).includes(user.uid)) {
            return NextResponse.json({ error: "Forbidden: You are not assigned to this job." }, { status: 403 });
        }

        const nowIso = new Date().toISOString();
        const nextConfirmations = {
            ...(booking.assignedStaffConfirmations || {}),
            [user.uid]: { status: response, respondedAt: nowIso },
        };
        await bookingRef.set({ assignedStaffConfirmations: nextConfirmations }, { merge: true });

        if (response === "declined") {
            await createNotification(adminDb, {
                type: "staff_declined",
                title: `${user.name || "A cleaner"} can't make a job on ${booking.date}`,
                body: `${booking.service || "Job"} at ${booking.address1 || "address on file"} — needs reassignment.`,
                branchId: booking.branchId || "",
                link: `?tab=bookings&job=${encodeURIComponent(bookingId)}`,
                refId: bookingId,
            });
        }

        return NextResponse.json({ message: "Response recorded.", status: response }, { status: 200 });
    } catch (err) {
        console.error("POST booking respond error:", err);
        const status = err.message?.includes("Authorization") || err.message?.includes("approved") ? 401 : 500;
        return NextResponse.json({ error: err.message || "Failed to record response." }, { status });
    }
}
