// Shared with every booking-creation path so a booking never ends up
// without an order number (which shows as the literal word "Pending" in the
// UI forever, regardless of later status changes — an order number is only
// ever assigned at creation time, nothing re-assigns one afterward).
export async function generateBookingOrderNumber(adminDb) {
    const year = new Date().getFullYear();
    const prefix = `STC-${year}-`;
    const snapshot = await adminDb.collection("bookings").get();
    const existing = snapshot.size + 1;
    return `${prefix}${String(existing).padStart(4, "0")}`;
}
