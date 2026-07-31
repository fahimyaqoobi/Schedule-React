import { createNotification } from "./notifications";
import { normalizePhone } from "./phone";
import { getStaffPhone } from "./staffNotify";
import { trySendSms, buildJobChatMessageSms } from "./sms";

export const JOB_CHAT_LOCKED_STATUSES = new Set(["Completed", "Cancelled"]);

// Single writer for a job-chat message — used by both the in-app POST route
// and the inbound-SMS webhook, so a message typed in the app and a reply
// that arrives by text go through the exact same steps: save it, notify
// staff in-app, and text whoever didn't send it. Living in one place means
// a future caller can't forget the SMS-mirror step the way the webhook did
// when this logic was duplicated across two files.
export async function appendJobChatMessage(adminDb, { booking, senderKind, senderId, senderName, text }) {
    const bookingId = booking.id;
    const nowIso = new Date().toISOString();
    const id = `jcm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const message = {
        id, bookingId,
        senderKind, senderId, senderName,
        text: String(text).trim(),
        createdAt: nowIso,
    };
    await adminDb.collection("jobChatMessages").doc(id).set(message);

    if (senderKind !== "staff") {
        await createNotification(adminDb, {
            type: "chat_message",
            title: `New job message from ${senderName}`,
            body: message.text.slice(0, 140),
            branchId: booking.branchId || "",
            link: `?tab=bookings&job=${encodeURIComponent(bookingId)}`,
            refId: bookingId,
        });
    }

    // Whoever didn't send it gets a real text — the customer if a
    // cleaner/staff wrote in, every assigned cleaner if the customer did.
    const smsBody = buildJobChatMessageSms(message.text, senderName, booking);
    if (senderKind === "customer") {
        const staffIds = booking.assignedStaffIds || [];
        const phones = await Promise.all(staffIds.map((uid) => getStaffPhone(adminDb, uid)));
        await Promise.allSettled(phones.filter(Boolean).map((phone) => trySendSms(phone, smsBody)));
    } else {
        const customerPhone = normalizePhone(booking.customerPortalPhone || booking.phone || "");
        if (customerPhone) await trySendSms(customerPhone, smsBody);
    }

    return message;
}
