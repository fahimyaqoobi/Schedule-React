import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { userCanAccessBranch, DEFAULT_BRANCH_ID } from "../../../../lib/branches";
import { trySendSms, buildManualReminderSms } from "../../../../lib/sms";

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

// Admin/ops manually re-sending an assignment text — the "they said they
// never got it" escape hatch. No dedup by design: this is an explicit,
// deliberate click, not an automated trigger.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: You cannot send reminders." }, { status: 403 });
        }

        const { bookingId, staffUid } = await request.json();
        if (!bookingId || !staffUid) {
            return NextResponse.json({ error: "Missing bookingId or staffUid." }, { status: 400 });
        }

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const doc = await bookingRef.get();
        if (!doc.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

        const booking = doc.data();
        if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden: You cannot access this branch." }, { status: 403 });
        }
        if (!(booking.assignedStaffIds || []).includes(staffUid)) {
            return NextResponse.json({ error: "This person is not assigned to this job." }, { status: 400 });
        }

        const staffDoc = await adminDb.collection("users").doc(staffUid).get();
        const phone = staffDoc.exists ? (staffDoc.data()?.staffProfile?.personal?.phone || "") : "";
        if (!phone) {
            return NextResponse.json({ error: "This cleaner has no phone number on file." }, { status: 400 });
        }

        const origin = request.headers.get("origin") || request.nextUrl.origin;
        const result = await trySendSms(phone, buildManualReminderSms(booking, origin));
        if (!result.ok) {
            return NextResponse.json({ error: result.error || "Failed to send text." }, { status: 502 });
        }

        const nowIso = new Date().toISOString();
        await bookingRef.set({
            staffNotifiedAt: {
                ...(booking.staffNotifiedAt || {}),
                [staffUid]: { ...(booking.staffNotifiedAt?.[staffUid] || {}), manualReminderAt: nowIso },
            },
        }, { merge: true });

        return NextResponse.json({ message: "Reminder sent." }, { status: 200 });
    } catch (err) {
        console.error("POST booking remind error:", err);
        const status = err.message?.includes("Authorization") || err.message?.includes("approved") ? 401 : 500;
        return NextResponse.json({ error: err.message || "Failed to send reminder." }, { status });
    }
}
