"use client";

export default function BookingsTab({
    searchVal,
    setSearchVal,
    filterService,
    setFilterService,
    filterStatus,
    setFilterStatus,
    sortVal,
    setSortVal,
    pricingRates,
    filteredBookings,
    editRequests,
    canManagePermissions,
    Icons,
    formatAddress,
    formatTimeWindow,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    handleDeleteBooking,
}) {
    return (
        <div className="animate-fade">
            <div className="filters-card">
                <div className="search-input-wrapper">
                    <span className="search-icon">{Icons.Search()}</span>
                    <input type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search by client name, address, email or phone..." />
                </div>
                <div className="filters-actions">
                    <select value={filterService} onChange={e => setFilterService(e.target.value)}>
                        <option value="">All Services</option>
                        {Object.keys(pricingRates.services).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="awaiting_approval">⏳ Awaiting Approval</option>
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                    <select value={sortVal} onChange={e => setSortVal(e.target.value)}>
                        <option value="date-asc">Date: Soonest First</option>
                        <option value="date-desc">Date: Latest First</option>
                        <option value="name-asc">Client: Name A-Z</option>
                        <option value="price-desc">Cost: Highest First</option>
                    </select>
                </div>
            </div>

            <div className="table-container">
                {filteredBookings.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-sm">No scheduled cleanings match search variables.</div>
                ) : (
                    <table className="bookings-table">
                        <thead>
                            <tr>
                                <th>Client Details</th>
                                <th>Street Address</th>
                                <th>Service Details</th>
                                <th>Schedule Window</th>
                                <th>Assigned Staff</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.map(b => {
                                const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                return (
                                    <tr key={b.id}>
                                        <td data-label="Client Details">
                                            <div className="flex flex-col items-end md:items-start">
                                                <div className="client-name-cell">{b.clientName}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{b.phone}</div>
                                                {b.customerConfirmed && b.status === "Pending" && (
                                                    <div className="inline-block text-[9px] bg-green-50 border border-green-200 text-green-700 font-bold px-1.5 py-0.5 rounded-full mt-1">✓ Customer Confirmed</div>
                                                )}
                                                {b.paymentStatus === "paid" && (
                                                    <div className="inline-block text-[9px] bg-blue-50 border border-blue-200 text-blue-700 font-bold px-1.5 py-0.5 rounded-full mt-1">💳 Paid</div>
                                                )}
                                                {hasPendingEdit && (
                                                    <div className="inline-block text-[9px] bg-amber-50 border border-amber-200 text-amber-700 font-bold px-1.5 py-0.5 rounded-full mt-1">Pending Admin Review</div>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Street Address">
                                            <div className="address-cell text-xs" title={formatAddress(b)}>{formatAddress(b)}</div>
                                        </td>
                                        <td data-label="Service Details" className="service-cell">
                                            <div className="flex flex-col items-end md:items-start">
                                                <div className="font-bold text-slate-700 text-xs">{b.service}</div>
                                                <div className="price-text">${parseFloat(b.price || 0).toFixed(2)}</div>
                                            </div>
                                        </td>
                                        <td data-label="Schedule Window" className="datetime-cell">
                                            <div className="flex flex-col items-end md:items-start">
                                                <div className="font-bold text-xs">{b.date}</div>
                                                <div className="time-text text-[11px]">{formatTimeWindow(b.time, b.duration)}</div>
                                            </div>
                                        </td>
                                        <td data-label="Assigned Staff">
                                            <div className="assigned-staff-list">
                                                {(b.assignedStaff || []).map(member => (
                                                    <span key={member.uid || member.email}>{member.name}</span>
                                                ))}
                                                {!b.assignedStaff?.length && <span>{b.team || "Unassigned"}</span>}
                                            </div>
                                        </td>
                                        <td data-label="Status">
                                            <div>
                                                <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                            </div>
                                        </td>
                                        <td data-label="Actions" className="actions-cell text-right">
                                            <div className="actions-cell-inner flex gap-2 justify-end">
                                                <button onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} className="action-btn btn-view" title="Details">{Icons.Eye()}</button>
                                                <button onClick={() => openEditBookingModal(b)} className="action-btn btn-edit" title="Edit">{Icons.Edit()}</button>
                                                {canManagePermissions && (
                                                    <button onClick={() => handleDeleteBooking(b.id)} className="action-btn btn-delete" title="Cancel">{Icons.Trash()}</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
