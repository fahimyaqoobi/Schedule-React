import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { createNotification } from "../../../../lib/notifications";
import { DEFAULT_BRANCH_ID } from "../../../../lib/branches";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Runs once a day. Finds jobs asked for a review 3+ days ago with no review
// received yet, and creates exactly ONE in-app notification per job — never
// a text or email to the customer, and never more than once per job (that's
// what reviewReminderNotified guards). An admin has to open the notification
// and press "Send Reminder" themselves; nothing here contacts the customer.
export async function GET() {
    try {
        const snap = await adminDb.collection("bookings")
            .where("reviewAsked", "==", true)
            .where("reviewReceived", "==", false)
            .get();

        const cutoff = Date.now() - THREE_DAYS_MS;
        let notified = 0;

        for (const doc of snap.docs) {
            const booking = doc.data();
            if (booking.reviewReminderNotified || booking.reviewReminderSent) continue;
            const askedAt = booking.reviewAskedAt ? new Date(booking.reviewAskedAt).getTime() : null;
            if (!askedAt || askedAt > cutoff) continue;

            await createNotification(adminDb, {
                type: "review_reminder_due",
                title: "Review reminder due",
                body: `${booking.clientName || "A customer"} hasn't left a review yet — 3 days since asked.`,
                branchId: booking.branchId || DEFAULT_BRANCH_ID,
                link: `?tab=bookings&job=${booking.id}`,
                refId: booking.id,
            });
            await doc.ref.set({ reviewReminderNotified: true }, { merge: true });
            notified++;
        }

        return NextResponse.json({ ok: true, notified }, { status: 200 });
    } catch (err) {
        console.error("GET cron/review-reminders error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
