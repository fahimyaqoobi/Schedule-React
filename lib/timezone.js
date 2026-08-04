// Shared branch-timezone helpers.
//
// This app is used by admins, supervisors, and cleaners who may sign in
// from anywhere in the world, about bookings and shifts that happen at a
// fixed physical branch (Ottawa today, "America/Toronto"). Every date/time
// tied to WHERE THE WORK HAPPENS — a booking's scheduled time, a time-card
// clock-in/out, a pay period boundary, an SMS about an appointment — must
// always render in that branch's local time, never the viewer's device
// timezone or the server process's ambient timezone (UTC in production).
// Without an explicit `timeZone`, toLocaleDateString/toLocaleTimeString
// silently use whatever zone happens to be running the code, which is why
// this bug was invisible in local dev (this machine's zone is already
// Eastern) but very visible in production (server runs UTC).
//
// Not everything needs this: a live "what time is it on YOUR clock right
// now" display, or a 1:1 chat timestamp between two people who may be in
// different places, is legitimately viewer-local — those should NOT use
// these helpers.

export const DEFAULT_TIMEZONE = "America/Toronto";

export function getTimeZoneOffsetMinutes(timeZone, date) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
    const offsetPart = parts.find(p => p.type === "timeZoneName")?.value || "GMT+0";
    const match = offsetPart.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return 0;
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    return hours * 60 + (hours < 0 ? -minutes : minutes);
}

// The UTC instant for local midnight on `dateKey` ("YYYY-MM-DD") in `timeZone`.
// DST-safe: re-derives the real offset for that specific date.
export function getZonedMidnightUtc(dateKey, timeZone = DEFAULT_TIMEZONE) {
    const approxUtc = new Date(`${dateKey}T00:00:00Z`);
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, approxUtc);
    return new Date(approxUtc.getTime() - offsetMinutes * 60000);
}

// One ms before the next day's local midnight — 23:59:59.999 local on `dateKey`.
export function getZonedEndOfDayUtc(dateKey, timeZone = DEFAULT_TIMEZONE) {
    return new Date(getZonedMidnightUtc(addDaysToKey(dateKey, 1), timeZone).getTime() - 1);
}

// "YYYY-MM-DD" for `date` as seen in `timeZone` — the calendar day that
// actually applies at the branch, not wherever the code happens to run.
export function getZonedDateKey(date, timeZone = DEFAULT_TIMEZONE) {
    return date.toLocaleDateString("en-CA", { timeZone });
}

// Whole-calendar-day arithmetic on a "YYYY-MM-DD" key. Anchored to UTC noon
// purely as a neutral scratch instant (never exposed) so this is immune to
// DST transitions landing inside the offset window.
export function addDaysToKey(dateKey, days) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

// Named period -> {startKey, endKey} (inclusive, "YYYY-MM-DD") anchored on
// "today" in the branch's timezone, not the viewer's device zone. Returns
// null for "all" (no filtering). Used by the Status Board's date filter.
export function getDateRangeForPeriod(period, timeZone = DEFAULT_TIMEZONE, now = new Date()) {
    const todayKey = getZonedDateKey(now, timeZone);
    switch (period) {
        case "yesterday": {
            const key = addDaysToKey(todayKey, -1);
            return { startKey: key, endKey: key };
        }
        case "today":
            return { startKey: todayKey, endKey: todayKey };
        case "tomorrow": {
            const key = addDaysToKey(todayKey, 1);
            return { startKey: key, endKey: key };
        }
        case "week": {
            const [y, m, d] = todayKey.split("-").map(Number);
            const jsDay = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=Sun..6=Sat
            const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
            const startKey = addDaysToKey(todayKey, mondayOffset);
            return { startKey, endKey: addDaysToKey(startKey, 6) };
        }
        case "month": {
            const [y, m] = todayKey.split("-").map(Number);
            const startKey = `${y}-${String(m).padStart(2, "0")}-01`;
            const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
            const endKey = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
            return { startKey, endKey };
        }
        case "all":
        default:
            return null;
    }
}

export const DATE_FILTER_OPTIONS = [
    { value: "all", label: "All Time" },
    { value: "yesterday", label: "Yesterday" },
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
];

export function formatZonedDate(date, options = {}, timeZone = DEFAULT_TIMEZONE, locale = "en-US") {
    if (!date) return "—";
    return date.toLocaleDateString(locale, { ...options, timeZone });
}

export function formatZonedTime(date, options = {}, timeZone = DEFAULT_TIMEZONE, locale = "en-US") {
    if (!date) return "—";
    return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", ...options, timeZone });
}

export function formatZonedDateTime(date, options = {}, timeZone = DEFAULT_TIMEZONE, locale = "en-US") {
    if (!date) return "—";
    return date.toLocaleString(locale, { ...options, timeZone });
}

// Converts a stored UTC ISO timestamp into a "YYYY-MM-DDTHH:mm" string for
// an <input type="datetime-local">, showing the wall-clock time AS SEEN AT
// THE BRANCH — not the viewer's own device timezone. A native datetime-local
// input has no timezone concept of its own; without this it silently shows
// (and, on save, re-interprets) the value in the browser's ambient zone,
// which is only "correct" by accident when the person editing happens to be
// in the same zone as the branch.
export function zonedIsoToDatetimeLocalValue(iso, timeZone = DEFAULT_TIMEZONE) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const get = type => parts.find(p => p.type === type)?.value;
    let hour = get("hour");
    if (hour === "24") hour = "00"; // some engines format midnight as "24" under hour12:false
    return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

// The inverse of zonedIsoToDatetimeLocalValue: takes a "YYYY-MM-DDTHH:mm"
// value (interpreted as branch-local wall-clock time, not the viewer's own
// device zone) and returns the correct UTC ISO instant for it.
export function zonedDatetimeLocalToIso(value, timeZone = DEFAULT_TIMEZONE) {
    if (!value) return "";
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return "";
    const approxUtc = new Date(`${datePart}T${timePart}:00Z`);
    if (Number.isNaN(approxUtc.getTime())) return "";
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, approxUtc);
    return new Date(approxUtc.getTime() - offsetMinutes * 60000).toISOString();
}
