// Booking phone numbers arrive in inconsistent formats depending on creation
// path (admin-entered free text vs. the customer portal's clean digits-only
// session phone). Normalize before using a phone number as a customer
// identity key anywhere (chat threads, CRM aggregation, matching).
export function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits;
}

// Best-effort identity key for a booking: prefer phone, fall back to email.
// Returns null if neither is present (can't attribute the booking to a customer).
export function customerKeyForBooking(booking = {}) {
    const phone = normalizePhone(booking.phone || booking.customerPortalPhone || "");
    if (phone) return `phone:${phone}`;
    const email = String(booking.email || "").trim().toLowerCase();
    if (email) return `email:${email}`;
    return null;
}
