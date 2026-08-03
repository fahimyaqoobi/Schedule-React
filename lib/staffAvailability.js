import { normalizeStaffProfile, getAvailabilityWeekdayIndex } from "./staffProfiles";

// Maps a booking's `time` ("9:30 AM") to the shift bucket it falls in —
// mirrors app/page.js's timeToShift(), which defines the same three
// buckets (morning/afternoon/evening) used for weekly staff availability.
// Kept as a small local copy rather than importing from page.js: that file
// is a client-only "god component" and lib/ modules should not depend on it.
function timeToShiftBucket(timeStr = "") {
    const m = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const min = h * 60 + parseInt(m[2], 10);
    if (min >= 420 && min < 720) return "morning";
    if (min >= 720 && min < 1080) return "afternoon";
    if (min >= 1080 && min < 1200) return "evening";
    return null;
}

const SHIFT_LABELS = { morning: "morning", afternoon: "afternoon", evening: "evening" };

// Day-level only: is this staff member working AT ALL on this date, per
// their own weekly schedule + blocked dates? Ignores time-of-day — this is
// what a Timeline cell uses to grey itself out / disable dropping before
// any specific booking is even involved. Returns the resolved `day` entry
// (weekdays[i]) on success so callers can go on to check a specific shift
// without re-deriving it.
export function isStaffWorkingOnDate(staffMember, dateStr) {
    if (!dateStr || !staffMember) return { available: true };
    const profile = normalizeStaffProfile(staffMember.staffProfile);
    const availability = profile.availability;
    const name = staffMember.name || staffMember.displayName || "This staff member";

    if ((availability.blockedDates || []).includes(dateStr)) {
        return { available: false, reason: `${name} has marked ${dateStr} as unavailable.` };
    }

    const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
    const weekdayIndex = getAvailabilityWeekdayIndex(jsDay);
    const day = availability.weekdays?.[weekdayIndex];
    if (!day || !day.enabled) {
        return { available: false, reason: `${name} does not work on this day.` };
    }

    return { available: true, day };
}

// Full check: day-level availability AND (if the booking has a time) the
// specific shift bucket that time falls in. Used at actual drop-time,
// where we know the exact booking being placed, not just the cell.
export function checkStaffAvailability(staffMember, booking) {
    const dateResult = isStaffWorkingOnDate(staffMember, booking?.date);
    if (!dateResult.available) return dateResult;
    if (!booking?.date) return { available: true };

    const shift = timeToShiftBucket(booking.time);
    if (shift && dateResult.day?.shifts && dateResult.day.shifts[shift] === false) {
        const name = staffMember.name || staffMember.displayName || "This staff member";
        return { available: false, reason: `${name} is not available for the ${SHIFT_LABELS[shift]} shift on this day.` };
    }

    return { available: true };
}
