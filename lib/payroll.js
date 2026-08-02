export const DEFAULT_PAY_RATE = 20;
export const DEFAULT_OVERTIME_RATE = 30;
export const DEFAULT_OVERTIME_AFTER_HOURS = 44;

const PAY_PERIOD_ANCHOR = "2026-06-14T23:59:59-04:00";
const MS_DAY = 86400000;
const PAY_PERIOD_MS = 14 * MS_DAY;

function formatPeriodLabel(periodStart, cutoffDate) {
    const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(periodStart)} – ${fmt(cutoffDate)}`;
}

// Biweekly pay period, anchored to a fixed cutoff date. Shared by the
// Payroll tab (offset-based browsing) and the paystub PDF route (which
// only has a periodKey and needs to reconstruct the same boundaries).
export function getPayPeriod(offset = 0) {
    const now = new Date();
    let cutoff = new Date(PAY_PERIOD_ANCHOR);
    while (cutoff < now) cutoff = new Date(cutoff.getTime() + PAY_PERIOD_MS);
    cutoff = new Date(cutoff.getTime() + offset * PAY_PERIOD_MS);
    const periodStart = new Date(cutoff.getTime() - 13 * MS_DAY);
    periodStart.setHours(0, 0, 0, 0);
    const payDate = new Date(cutoff.getTime() + 5 * MS_DAY);
    payDate.setHours(0, 0, 0, 0);
    return {
        periodStart,
        cutoffDate: cutoff,
        payDate,
        key: periodStart.toISOString().split("T")[0],
        label: formatPeriodLabel(periodStart, cutoff),
        payDateFull: payDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
}

// Same shape as getPayPeriod(), reconstructed from the periodKey alone
// (the periodStart date string) — used server-side where we only get the
// key back from the client, never trusting client-computed date ranges.
export function getPayPeriodFromKey(periodKey) {
    const periodStart = new Date(`${periodKey}T00:00:00`);
    if (Number.isNaN(periodStart.getTime())) return null;
    const cutoffDate = new Date(periodStart.getTime() + 13 * MS_DAY);
    const payDate = new Date(cutoffDate.getTime() + 5 * MS_DAY);
    return {
        periodStart,
        cutoffDate,
        payDate,
        key: periodKey,
        label: formatPeriodLabel(periodStart, cutoffDate),
        payDateFull: payDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
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
