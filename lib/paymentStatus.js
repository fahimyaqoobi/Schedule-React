// Single source of truth for the booking payment-status vocabulary that is
// actually writable server-side (app/api/bookings/route.js's
// PAYMENT_STATUS_FLOW allowlist: unpaid/partial/paid/redo — anything else
// gets silently coerced back to "unpaid" on save). Mirrors the shape of
// lib/bookingStatus.js so any new UI (Calendar context menus, Dispatch Map)
// can share it instead of re-declaring its own copy.
export const PAYMENT_STATUSES = [
    { value: "unpaid", label: "Unpaid", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { value: "partial", label: "◐ Partial", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { value: "paid", label: "💳 Paid", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "redo", label: "↩ Redo", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
];

const UNKNOWN_PAYMENT_META = { label: "", color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" };

export function getPaymentMeta(status) {
    const known = PAYMENT_STATUSES.find(o => o.value === (status || "unpaid"));
    if (known) return known;
    return { ...UNKNOWN_PAYMENT_META, label: status || "Unpaid" };
}
