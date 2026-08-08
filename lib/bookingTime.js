// Converts a booking's stored 12-hour time string ("9:30 AM") into minutes
// since midnight, for chronological sorting. Do NOT sort raw time strings
// with localeCompare/`<` — locale-aware string comparison does not order
// "1:00 PM" after "10:00 AM" the way a human (or a plain 24h clock) would,
// since it doesn't understand these are times at all. This bit a real sort
// in the Calendar month view's side panel before being caught.
export function timeSortKey(timeStr = "") {
    const m = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 9999;
    let h = parseInt(m[1], 10);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + parseInt(m[2], 10);
}

// Inverse of timeSortKey — minutes since midnight back to "9:00 AM" style.
function minutesToTimeLabel(totalMinutes) {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const h24 = Math.floor(normalized / 60);
    const m = normalized % 60;
    const period = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// "Arrival window" — the range of time a customer is told to expect the
// crew, as opposed to an exact minute. Deliberately separate from this
// booking's own `duration` (how long the JOB takes, shown elsewhere as a
// "Time Window" in the admin detail view) — this is about uncertainty in
// WHEN THEY'LL SHOW UP, not how long the clean takes once they're there.
// `booking.arrivalWindowMinutes` (a future per-booking override) takes
// priority; `defaultMinutes` is the branch-wide setting resolved by the
// caller. Returns null (caller falls back to the exact time) when neither
// is set or the booking has no parseable time.
export function formatArrivalWindow(booking = {}, defaultMinutes) {
    const minutes = Number(booking.arrivalWindowMinutes ?? defaultMinutes);
    if (!minutes || !booking.time) return null;
    const startMin = timeSortKey(booking.time);
    if (startMin >= 9999) return null;
    return `between ${minutesToTimeLabel(startMin)} and ${minutesToTimeLabel(startMin + minutes)}`;
}
