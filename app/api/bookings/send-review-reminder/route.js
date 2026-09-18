import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { userCanAccessBranch, DEFAULT_BRANCH_ID } from "../../../../lib/branches";
import { sendEmail, isMailConfigured } from "../../../../lib/email";
import { buildReviewReminderEmailHtml } from "../../../../lib/reviewRequest";
import { trySendSms, buildReviewReminderSms } from "../../../../lib/sms";
import { appendJobActivityMessage } from "../../../../lib/jobChat";

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

// The ONE allowed reminder per job. Never fired automatically — the 3-day
// cron (app/api/cron/review-reminders) only ever creates an in-app
// notification; an admin has to open this specific job and press the
// button, every time. Enforced server-side too (not just hidden in the UI)
// so there's never a second reminder no matter how this gets called.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only admins can send review reminders." }, { status: 403 });
        }

        const { bookingId } = await request.json();
        if (!bookingId) return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const snap = await bookingRef.get();
        if (!snap.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

        const booking = snap.data();
        if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden: You cannot manage this branch's booking." }, { status: 403 });
        }
        if (!booking.reviewAsked) {
            return NextResponse.json({ error: "A review hasn't been asked for yet on this job." }, { status: 422 });
        }
        if (booking.reviewReceived) {
            return NextResponse.json({ error: "A review was already marked as received." }, { status: 422 });
        }
        if (booking.reviewReminderSent) {
            return NextResponse.json({ error: "The one allowed reminder has already been sent for this job." }, { status: 422 });
        }

        const settingsDoc = await adminDb.collection("settings").doc("pricing").get();
        const reviewLink = settingsDoc.exists ? settingsDoc.data()?.reviewLink : "";
        if (!reviewLink) {
            return NextResponse.json({ error: "No review link configured yet — add one in Settings first." }, { status: 422 });
        }

        const sentTo = [];
        if (booking.email && isMailConfigured()) {
            try {
                await sendEmail({
                    to: booking.email,
                    subject: "Just a friendly reminder — SmarTouch Clean",
                    html: buildReviewReminderEmailHtml({ booking, reviewLink }),
                });
                sentTo.push("email");
            } catch (emailErr) {
                console.error("send-review-reminder email failed:", emailErr.message);
            }
        }
        const smsPhone = booking.customerPortalPhone || booking.phone;
        if (smsPhone) {
            const result = await trySendSms(smsPhone, buildReviewReminderSms(booking, reviewLink));
            if (result.ok) sentTo.push("sms");
        }

        if (sentTo.length === 0) {
            return NextResponse.json({ error: "Couldn't send — this customer has no email or phone on file, or sending failed." }, { status: 422 });
        }

        await bookingRef.set({
            reviewReminderSent: true,
            reviewReminderSentAt: new Date().toISOString(),
        }, { merge: true });

        await appendJobActivityMessage(adminDb, {
            bookingId,
            summary: `Review reminder sent to customer (${sentTo.join(" + ")})`,
            by: user.email || user.uid,
        });

        return NextResponse.json({ message: "Reminder sent.", sentTo }, { status: 200 });
    } catch (err) {
        console.error("POST bookings/send-review-reminder error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
    }
}
