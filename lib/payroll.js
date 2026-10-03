import { DEFAULT_TIMEZONE, getZonedMidnightUtc, getZonedEndOfDayUtc, getZonedDateKey, addDaysToKey } from "./timezone";

export const DEFAULT_PAY_RATE = 20;
export const DEFAULT_OVERTIME_RATE = 30;
export const DEFAULT_OVERTIME_AFTER_HOURS = 44;

// The business runs on Eastern time (Ottawa). Pay periods are Eastern
// calendar days — this must stay explicit rather than relying on the
// runtime's ambient timezone, because that ambient zone differs by where
// the code executes: the admin's browser (Eastern, so this "just works"
// by luck) vs. the server generating paystub PDFs (UTC on most hosts,
// which silently shifts period boundaries and clock-in/out times by
// 4-5 hours). Everything here is computed in explicit-Eastern calendar-date
// space so both call sites agree no matter where they run.
const PAY_PERIOD_TIMEZONE = DEFAULT_TIMEZONE;
// Eastern calendar date of a past period cutoff (period end). The cycle
// repeats every 14 days from here, forever, in both directions.
const PAY_PERIOD_ANCHOR_KEY = "2026-06-14";

function formatPeriodLabel(periodStart, cutoffDate) {
    const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PAY_PERIOD_TIMEZONE });
    return `${fmt(periodStart)} – ${fmt(cutoffDate)}`;
}

function buildPayPeriodFromCutoffKey(cutoffKey) {
    const periodStartKey = addDaysToKey(cutoffKey, -13);
    const payDateKey = addDaysToKey(cutoffKey, 5);
    const periodStart = getZonedMidnightUtc(periodStartKey);
    const cutoffDate = getZonedEndOfDayUtc(cutoffKey);
    const payDate = getZonedMidnightUtc(payDateKey);
    return {
        periodStart,
        cutoffDate,
        payDate,
        key: periodStartKey,
        label: formatPeriodLabel(periodStart, cutoffDate),
        payDateFull: payDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: PAY_PERIOD_TIMEZONE }),
    };
}

// Biweekly pay period, anchored to a fixed cutoff date. Shared by the
// Payroll tab (offset-based browsing) and the paystub PDF route (which
// only has a periodKey and needs to reconstruct the same boundaries).
export function getPayPeriod(offset = 0) {
    const todayKey = getZonedDateKey(new Date());
    let cutoffKey = PAY_PERIOD_ANCHOR_KEY;
    while (cutoffKey < todayKey) cutoffKey = addDaysToKey(cutoffKey, 14);
    cutoffKey = addDaysToKey(cutoffKey, offset * 14);
    return buildPayPeriodFromCutoffKey(cutoffKey);
}

// Same shape as getPayPeriod(), reconstructed from the periodKey alone
// (the periodStart date string) — used server-side where we only get the
// key back from the client, never trusting client-computed date ranges.
export function getPayPeriodFromKey(periodKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodKey || "")) return null;
    const cutoffKey = addDaysToKey(periodKey, 13);
    return buildPayPeriodFromCutoffKey(cutoffKey);
}

export function normalizePayrollSettings(employment = {}) {
    const hourlyRate = Number(employment.hourlyRate ?? DEFAULT_PAY_RATE);
    const overtimeRate = Number(employment.overtimeRate ?? DEFAULT_OVERTIME_RATE);
    const overtimeAfterHours = Number(employment.overtimeAfterHours ?? DEFAULT_OVERTIME_AFTER_HOURS);
    const payrollStatus = employment.payrollStatus || "active";
    const bonusAmount = Number(employment.bonusAmount ?? 0);
    return {
        hourlyRate,
        overtimeRate,
        overtimeAfterHours,
        payrollStatus,
        bonusAmount
    };
}

export function calculatePayrollBreakdown(durationMinutes = 0, employment = {}) {
    const settings = normalizePayrollSettings(employment);
    const totalHours = Math.max(0, Number(durationMinutes || 0) / 60);
    const regularHours = Math.min(totalHours, settings.overtimeAfterHours);
    const overtimeHours = Math.max(0, totalHours - settings.overtimeAfterHours);
    const regularPay = regularHours * settings.hourlyRate;
    const overtimePay = overtimeHours * settings.overtimeRate;
    const grossPay = Number((regularPay + overtimePay + settings.bonusAmount).toFixed(2));
    return {
        ...settings,
        totalHours: Number(totalHours.toFixed(2)),
        regularHours: Number(regularHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        regularPay: Number(regularPay.toFixed(2)),
        overtimePay: Number(overtimePay.toFixed(2)),
        grossPay
    };
}

// `overtimeAfterHours` (44, by default) is Ontario's ESA overtime threshold,
// which the law defines per CALENDAR WORK WEEK — never per pay period. A
// biweekly pay period is two separate 7-day weeks, so each week's hours
// must be checked against the threshold on its own and the results added
// together; comparing the whole period's total against 44 (as
// calculatePayrollBreakdown does) fires overtime after just 44h across two
// weeks instead of 44h in one week, and simply doubling the threshold to 88
// would swing the other way and hide real overtime — someone who works 50h
// one week and 30h the next is legally owed 6h of OT even though their
// 80h period total never reaches 88. `minutesByDate` is a { "YYYY-MM-DD":
// minutes } map (the same per-day grouping the Payroll tab's daily
// breakdown already builds); `periodStart` is the pay period's first day
// (always a Monday here, so day 0-6 is week 1 and day 7-13 is week 2).
export function calculateBiweeklyPayrollBreakdown(minutesByDate = {}, periodStart, employment = {}) {
    const settings = normalizePayrollSettings(employment);
    const week2StartMs = periodStart.getTime() + 7 * 24 * 60 * 60 * 1000;

    let week1Minutes = 0;
    let week2Minutes = 0;
    for (const [dateKey, minutes] of Object.entries(minutesByDate)) {
        const dayMs = getZonedMidnightUtc(dateKey).getTime();
        if (dayMs >= week2StartMs) week2Minutes += Number(minutes || 0);
        else week1Minutes += Number(minutes || 0);
    }

    const weeks = [week1Minutes, week2Minutes].map((minutes) => {
        const hours = Math.max(0, minutes / 60);
        return {
            regularHours: Math.min(hours, settings.overtimeAfterHours),
            overtimeHours: Math.max(0, hours - settings.overtimeAfterHours),
        };
    });

    const regularHours = weeks.reduce((sum, w) => sum + w.regularHours, 0);
    const overtimeHours = weeks.reduce((sum, w) => sum + w.overtimeHours, 0);
    const regularPay = regularHours * settings.hourlyRate;
    const overtimePay = overtimeHours * settings.overtimeRate;
    const grossPay = Number((regularPay + overtimePay + settings.bonusAmount).toFixed(2));

    return {
        ...settings,
        totalHours: Number((regularHours + overtimeHours).toFixed(2)),
        regularHours: Number(regularHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        regularPay: Number(regularPay.toFixed(2)),
        overtimePay: Number(overtimePay.toFixed(2)),
        grossPay
    };
}
