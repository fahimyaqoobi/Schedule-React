import { createNotification } from "./notifications";

export const JOB_CHAT_LOCKED_STATUSES = new Set(["Completed", "Cancelled"]);

// Single writer for a job-chat message — used by both the in-app POST route
// and the inbound-SMS webhook, same reasoning as lib/supportChat.js.
export async function appendJobChatMessage(adminDb, { bookingId, senderKind, senderId, senderName, text, branchId = "" }) {
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
            branchId,
            link: `?tab=bookings&job=${encodeURIComponent(bookingId)}`,
            refId: bookingId,
        });
    }

    return message;
}
