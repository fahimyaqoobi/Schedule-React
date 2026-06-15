export const DEFAULT_PAY_RATE = 20;
export const DEFAULT_OVERTIME_RATE = 30;
export const DEFAULT_OVERTIME_AFTER_HOURS = 44;

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
