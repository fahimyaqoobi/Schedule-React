import { normalizePhone } from "./phone";
import { createNotification } from "./notifications";

export function supportThreadId(type, refId) {
    return type === "customer" ? `customer_${normalizePhone(refId)}` : `cleaner_${refId}`;
}

// Single writer for a support message, used by both the in-app POST route
// and the inbound-SMS webhook — so a reply that arrives by text and a
// reply typed in the app land in the exact same shape, with the exact same
// notification behavior.
export async function appendSupportMessage(adminDb, { type, refId, refName, senderKind, senderId, senderName, text }) {
    const id = supportThreadId(type, refId);
    const nowIso = new Date().toISOString();
    const threadRef = adminDb.collection("supportThreads").doc(id);
    const threadSnap = await threadRef.get();
    const messagePreview = String(text).trim().slice(0, 140);

    await threadRef.set({
        id, type,
        refId: type === "customer" ? normalizePhone(refId) : refId,
        refName: refName || (threadSnap.exists ? threadSnap.data().refName : senderName),
        lastMessageAt: nowIso,
        lastMessagePreview: messagePreview,
        createdAt: threadSnap.exists ? threadSnap.data().createdAt : nowIso,
    }, { merge: true });

    const msgId = `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const message = {
        id: msgId, threadId: id,
        senderKind, senderId,
        senderName,
        text: String(text).trim(),
        createdAt: nowIso,
    };
    await adminDb.collection("supportMessages").doc(msgId).set(message);

    // A customer or cleaner messaging in (whether from the app or a text
    // reply) is exactly what the notification bell exists for.
    if (senderKind !== "staff") {
        await createNotification(adminDb, {
            type: "chat_message",
            title: `New message from ${message.senderName}`,
            body: messagePreview,
            link: `?tab=messages&thread=${encodeURIComponent(id)}`,
            refId: id,
        });
    }

    return { threadId: id, message };
}
