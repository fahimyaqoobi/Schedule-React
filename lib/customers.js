import { customerKeyForBooking } from "./phone";

const OPEN_STATUSES = new Set(["Completed"]);

// Groups a branch's bookings into per-customer CRM records — this is computed
// on read from the bookings collection (no synced "customers" collection to
// keep in sync), matching the "auto-match by phone, fallback email" decision.
export function buildCustomerRecords(bookings = []) {
    const groups = new Map();

    for (const booking of bookings) {
        const key = customerKeyForBooking(booking);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(booking);
    }

    const records = [];
    for (const [key, list] of groups.entries()) {
        list.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
        const latest = list[0];
        const active = list.filter(b => b.status !== "Cancelled");

        const totalRevenue = active
            .filter(b => OPEN_STATUSES.has(b.status))
            .reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);
        const totalPaid = active
            .filter(b => (b.paymentStatus || "").toLowerCase() === "paid")
            .reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);
        const totalOwing = active
            .filter(b => b.status === "Completed" && (b.paymentStatus || "").toLowerCase() !== "paid")
            .reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);

        const serviceBreakdown = {};
        active.forEach(b => {
            const svc = b.service || "Unspecified";
            serviceBreakdown[svc] = (serviceBreakdown[svc] || 0) + 1;
        });

        const promoBookings = active.filter(b => b.promoCode);
        const upcoming = active
            .filter(b => ["Pending", "Confirmed", "Quote"].includes(b.status))
            .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        const dates = active.map(b => b.date).filter(Boolean).sort();

        records.push({
            key,
            name: latest.clientName || `${latest.firstName || ""} ${latest.lastName || ""}`.trim() || "Unknown Customer",
            phone: latest.phone || latest.customerPortalPhone || "",
            email: latest.email || "",
            branchId: latest.branchId || "",
            memberSince: dates[0] || latest.createdAt || "",
            lastBookingDate: dates[dates.length - 1] || "",
            totalBookings: active.length,
            cancelledBookings: list.length - active.length,
            completedBookings: active.filter(b => b.status === "Completed").length,
            recurringBookings: active.filter(b => b.isRecurring).length,
            isRecurringCustomer: active.some(b => b.isRecurring),
            totalRevenue,
            totalPaid,
            totalOwing,
            serviceBreakdown,
            promoUsageCount: promoBookings.length,
            promoCodesUsed: [...new Set(promoBookings.map(b => b.promoCode))],
            upcomingCount: upcoming.length,
            leadSources: [...new Set(active.map(b => b.leadSource).filter(Boolean))],
            bookings: list,
        });
    }

    records.sort((a, b) => (b.lastBookingDate || "").localeCompare(a.lastBookingDate || ""));
    return records;
}
