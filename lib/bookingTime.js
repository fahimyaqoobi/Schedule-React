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
