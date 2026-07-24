// Per-job financial record built the moment a booking is marked Completed.
// This is the data model for Daily Business Performance (see AGENTS/requirements
// doc section 3) — live sync to Google Sheets/QuickBooks is intentionally a stub
// (syncStatus stays "not_synced") until credentials are wired up.
export function buildJobFinancialRecord(booking, approvedTimeEntries = []) {
    const revenue = Number(booking.price || booking.totalAmount || 0);
    const laborCost = approvedTimeEntries
        .filter(entry => entry.bookingId === booking.id)
        .reduce((sum, entry) => sum + Number(entry.grossPayEstimate || 0), 0);
    const materialCost = Number(booking.materialCost || 0);
    const profit = revenue - laborCost - materialCost;
    const margin = revenue > 0 ? profit / revenue : 0;

    return {
        id: booking.id,
        bookingId: booking.id,
        branchId: booking.branchId || "ottawa-ca",
        branchName: booking.branchName || "Ottawa",
        clientName: booking.clientName || "",
        service: booking.service || "",
        date: booking.date || "",
        revenue,
        laborCost,
        materialCost,
        profit,
        margin,
        syncStatus: "not_synced",
        syncedAt: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}
