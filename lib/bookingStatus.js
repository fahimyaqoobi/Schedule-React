// Single source of truth for booking status metadata — shared by the
// Bookings table's small badges and the Calendar's full-card coloring, so
// the two views can never visually drift apart.
//
// `value` must exactly match the server's BOOKING_STATUS_FLOW allowlist
// (app/api/bookings/route.js) — these are the only 7 real, writable
// statuses. "awaiting_approval" is NOT one of them: it's a derived UI
// state (status === "Pending" && customerConfirmed === true, see
// app/page.js) used only for filtering, never written back. It lives in
// STATUS_FILTER_OPTIONS below, kept out of BOOKING_STATUSES on purpose —
// writing it as a real status silently gets coerced back to "Lead"
// server-side.
export const BOOKING_STATUSES = [
    { value: "Lead", label: "Lead", color: "#78716c", bg: "#fafaf9", border: "#e7e5e4", fill: "#78716c", fillText: "#ffffff" },
    { value: "Follow Up", label: "Follow Up", color: "#a16207", bg: "#fefce8", border: "#fef08a", fill: "#a16207", fillText: "#ffffff" },
    { value: "Quote", label: "💬 Quote", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", fill: "#7c3aed", fillText: "#ffffff" },
    { value: "Pending", label: "Pending", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", fill: "#6366f1", fillText: "#ffffff" },
    { value: "Confirmed", label: "✓ Confirmed", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", fill: "#0891b2", fillText: "#ffffff" },
    { value: "Completed", label: "★ Completed", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", fill: "#16a34a", fillText: "#ffffff" },
    { value: "Cancelled", label: "✕ Cancelled", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", fill: "#dc2626", fillText: "#ffffff" },
];

// Adds the read-only "Awaiting Approval" filter choice on top of the 7 real
// statuses. Use this ONLY for filter dropdowns — never for a control that
// writes `status` back to a booking (inline quick-edit, bulk-apply, the
// Calendar's status-drag columns).
export const STATUS_FILTER_OPTIONS = [
    ...BOOKING_STATUSES,
    { value: "awaiting_approval", label: "⏳ Awaiting Approval", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", fill: "#f59e0b", fillText: "#ffffff" },
];

const UNKNOWN_STATUS_META = { label: "", color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0", fill: "#64748b", fillText: "#ffffff" };

export function getStatusMeta(status) {
    const known = BOOKING_STATUSES.find(o => o.value === status);
    if (known) return known;
    return { ...UNKNOWN_STATUS_META, label: status || "Unknown" };
}
