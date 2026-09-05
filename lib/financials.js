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

// A job's financial record is built once, at the moment its booking is
// marked Completed, from whichever time entries happen to be "approved" at
// that exact instant (see buildJobFinancialRecord above). It is NOT a live
// view — if a cleaner's hours get approved, edited, or a manual time card
// gets added AFTER the job was already Completed (a very normal sequence:
// the job finishes today, payroll approves the hours a day or two later),
// nothing recomputes it on its own. That silent staleness is exactly what
// under/over-states "Net Profit" on the dashboard after the fact. Every
// place that changes a time entry's approved status or its hours must call
// this afterward so an already-Completed job's numbers stay honest.
export async function refreshBookingFinancialRecord(adminDb, bookingId) {
    if (!bookingId) return;
    const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) return;
    const booking = bookingSnap.data();
    // Only a Completed job has a financial record to keep honest — anything
    // still in progress doesn't have one yet (it gets created fresh, with
    // whatever's approved by then, the moment it's marked Completed).
    if (booking.status !== "Completed") return;
    const timeEntriesSnap = await adminDb.collection("timeEntries")
        .where("bookingId", "==", bookingId)
        .where("status", "==", "approved")
        .get();
    const approvedTimeEntries = timeEntriesSnap.docs.map((doc) => doc.data());
    const financialRecord = buildJobFinancialRecord({ ...booking, id: bookingId }, approvedTimeEntries);
    await adminDb.collection("financialRecords").doc(bookingId).set(financialRecord);
}
