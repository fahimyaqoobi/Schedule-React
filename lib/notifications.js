// In-app notification center — polled from the admin header bell. Two kinds
// for now: a customer sent a support message, or a cleaner tapped "Can't
// Make It" on an assigned job. Kept generic (type/title/body/link) so more
// kinds can be added later without a schema change.
export async function createNotification(adminDb, { type, title, body = "", branchId = "", link = "", refId = "" }) {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification = {
        id,
        type,
        title,
        body,
        branchId,
        link,
        refId,
        read: false,
        createdAt: new Date().toISOString(),
    };
    await adminDb.collection("notifications").doc(id).set(notification);
    return notification;
}
