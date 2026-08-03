// Pure functions building the exact `fields` object each drag interaction
// sends to the shared handleQuickBookingUpdate(bookingId, fields) — kept
// separate from dnd-kit/DOM code so the update semantics are easy to read
// and test independent of drag mechanics.

// Board view: dragging a card into a different status column.
export function applyStatusDrag(booking, newStatus, handleQuickBookingUpdate) {
    return handleQuickBookingUpdate(booking.id, { status: newStatus });
}

// Timeline view: dragging a card from one staff column to another (or to/from
// the synthetic "Unassigned" column, where fromUid/toUid is null). Surgically
// swaps just the one uid being moved — removes fromUid, adds toUid — rather
// than replacing the whole assignedStaffIds array, so any other staff already
// assigned to a multi-assigned booking are left untouched. Matches the exact
// {assignedStaffIds, assignedStaff} shape the existing StaffPopover already
// sends (BookingsTab.js), so no server changes are needed.
export function applyStaffReassignDrag(booking, fromUid, toUid, fieldStaffList, handleQuickBookingUpdate) {
    const currentIds = booking.assignedStaffIds || [];
    let nextIds = fromUid ? currentIds.filter(id => id !== fromUid) : [...currentIds];
    if (toUid && !nextIds.includes(toUid)) nextIds = [...nextIds, toUid];
    const nextStaff = fieldStaffList
        .filter(m => nextIds.includes(m.uid))
        .map(m => ({ uid: m.uid, name: m.name || m.displayName || "", email: m.email || "", photoURL: m.photoURL || "" }));
    return handleQuickBookingUpdate(booking.id, { assignedStaffIds: nextIds, assignedStaff: nextStaff });
}

// Timeline view: dragging a card to a different date row.
export function applyDateDrag(booking, newDate, handleQuickBookingUpdate) {
    return handleQuickBookingUpdate(booking.id, { date: newDate });
}

// Timeline view: a single drag can move a card diagonally — a different
// staff column AND a different date row at once. Builds one combined
// `fields` object and fires a single handleQuickBookingUpdate call rather
// than two sequential ones, so this is one PUT (one SMS-notification pass
// server-side, if any), not two racing writes to the same booking.
export function applyTimelineDrag(booking, { fromUid, toUid, newDate }, fieldStaffList, handleQuickBookingUpdate) {
    const fields = {};
    const staffChanged = fromUid !== toUid;
    if (staffChanged) {
        const currentIds = booking.assignedStaffIds || [];
        let nextIds = fromUid ? currentIds.filter(id => id !== fromUid) : [...currentIds];
        if (toUid && !nextIds.includes(toUid)) nextIds = [...nextIds, toUid];
        fields.assignedStaffIds = nextIds;
        fields.assignedStaff = fieldStaffList
            .filter(m => nextIds.includes(m.uid))
            .map(m => ({ uid: m.uid, name: m.name || m.displayName || "", email: m.email || "", photoURL: m.photoURL || "" }));
    }
    if (newDate && newDate !== booking.date) fields.date = newDate;
    if (Object.keys(fields).length === 0) return Promise.resolve({ ok: true, pending: false });
    return handleQuickBookingUpdate(booking.id, fields);
}
