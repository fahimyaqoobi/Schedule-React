import { trySendSms, buildAssignmentSms, buildJobChangedSms } from "./sms";

async function getStaffPhone(adminDb, uid) {
    try {
        const doc = await adminDb.collection("users").doc(uid).get();
        if (!doc.exists) return "";
        return doc.data()?.staffProfile?.personal?.phone || "";
    } catch {
        return "";
    }
}

// Called from the bookings PUT handler on every save. Compares the staff
// list + status/date/time before and after the edit and fires the right
// texts — new assignment, or "this confirmed job changed on you." Returns
// the assignedStaffConfirmations/staffNotifiedAt fields to merge into the
// booking write (never mutates anything itself).
export async function computeAssignmentNotifications(adminDb, { originalData, nextBooking, origin }) {
    const previousStaffIds = Array.isArray(originalData.assignedStaffIds) ? originalData.assignedStaffIds : [];
    const nextStaffIds = Array.isArray(nextBooking.assignedStaffIds) ? nextBooking.assignedStaffIds : [];
    const newlyAssigned = nextStaffIds.filter((uid) => !previousStaffIds.includes(uid));
    const stillAssigned = previousStaffIds.filter((uid) => nextStaffIds.includes(uid));

    const wasConfirmed = originalData.status === "Confirmed";
    const nowConfirmed = nextBooking.status === "Confirmed";
    const changeSummaries = [];
    if (wasConfirmed && !nowConfirmed) {
        changeSummaries.push(`status changed to ${nextBooking.status}`);
    } else if (wasConfirmed && nowConfirmed) {
        if (originalData.date && nextBooking.date && originalData.date !== nextBooking.date) {
            changeSummaries.push(`rescheduled to ${nextBooking.date}`);
        }
        if (originalData.time && nextBooking.time && originalData.time !== nextBooking.time) {
            changeSummaries.push(`new time ${nextBooking.time}`);
        }
    }
    // Staff who already knew about the OLD version of a Confirmed job and are
    // still assigned — only they get a "this changed" text; someone newly
    // added gets the plain assignment text instead, not a "changed" one.
    const staffToNotifyOfChange = changeSummaries.length > 0 ? stillAssigned : [];

    const confirmations = {};
    const notifiedAt = { ...(originalData.staffNotifiedAt || {}) };
    const nowIso = new Date().toISOString();
    const sendTasks = [];

    for (const uid of nextStaffIds) {
        const existing = originalData.assignedStaffConfirmations?.[uid];
        confirmations[uid] = existing && previousStaffIds.includes(uid) ? existing : { status: "pending" };
    }

    if (nowConfirmed) {
        for (const uid of newlyAssigned) {
            sendTasks.push(async () => {
                const phone = await getStaffPhone(adminDb, uid);
                if (!phone) return;
                await trySendSms(phone, buildAssignmentSms(nextBooking, origin));
                notifiedAt[uid] = { ...(notifiedAt[uid] || {}), assignedAt: nowIso };
            });
        }
    }

    if (staffToNotifyOfChange.length > 0) {
        const summary = changeSummaries.join("; ");
        for (const uid of staffToNotifyOfChange) {
            sendTasks.push(async () => {
                const phone = await getStaffPhone(adminDb, uid);
                if (!phone) return;
                await trySendSms(phone, buildJobChangedSms(nextBooking, origin, summary));
                notifiedAt[uid] = { ...(notifiedAt[uid] || {}), lastChangeNotifiedAt: nowIso };
            });
        }
    }

    // Fire all sends concurrently, but don't let one bad phone number take
    // the others down with it.
    await Promise.allSettled(sendTasks.map((task) => task()));

    return { assignedStaffConfirmations: confirmations, staffNotifiedAt: notifiedAt };
}
