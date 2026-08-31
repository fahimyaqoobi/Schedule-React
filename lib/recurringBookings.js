// Recurring-booking date math. The feature no longer auto-books months of
// future occurrences on its own (that eager batch-generation was removed —
// it would occasionally create dates nobody actually wanted). Instead, a
// recurring booking creates exactly ONE next occurrence at a time, and only
// when someone marks the current one Completed and confirms a date in the
// "Schedule next visit?" prompt (see RecurringNextVisitDialog.js). These
// helpers just compute that one suggested next date.
export const RECURRING_FREQUENCIES = ["Weekly", "Bi-Weekly", "Monthly"];

export function addMonthsClamped(date, n) {
    const d = new Date(date);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
}

export function toLocalDateStr(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The single next date after `fromDateStr` for a given frequency — used only
// to pre-fill the date picker in the "Schedule next visit?" prompt with a
// sensible default. The admin can change it to anything before confirming.
export function nextRecurringDate(fromDateStr, frequency) {
    if (!fromDateStr) return "";
    const from = new Date(`${fromDateStr}T00:00:00`);
    if (Number.isNaN(from.getTime())) return "";
    if (frequency === "Monthly") return toLocalDateStr(addMonthsClamped(from, 1));
    const step = frequency === "Bi-Weekly" ? 14 : 7;
    const d = new Date(from);
    d.setDate(d.getDate() + step);
    return toLocalDateStr(d);
}
