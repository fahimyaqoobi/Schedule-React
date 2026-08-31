// Branch-scoped "no bookings today" dates — holidays, closures, anything
// that should stop new bookings (and reschedules) from landing on a given
// day for ONE branch, without touching any other branch's calendar. Backed
// by its own small Firestore collection (one doc per branch+date) rather
// than a field on the global settings doc, since this is a growing list
// with independent add/remove operations, not a settings blob.

// Deterministic id — doubles as a natural dedupe key (blocking the same
// date twice for the same branch just overwrites the same doc) and makes
// unblocking a plain delete-by-id instead of a query-then-delete.
export function blockedDateDocId(branchId, date) {
    return `${branchId}__${date}`;
}

// Matches an already-fetched list against one branch+date pair. Kept as a
// single shared function so the several call sites that need to ask "is
// this date blocked for this branch?" (admin create, admin reschedule,
// customer self-booking) can't drift into checking it differently.
export function findBlockedDate(blockedDates = [], branchId, date) {
    if (!branchId || !date) return null;
    return blockedDates.find((entry) => entry.branchId === branchId && entry.date === date) || null;
}
