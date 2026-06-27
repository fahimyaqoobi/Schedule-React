"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const STATUS_OPTIONS = [
    { value: "awaiting_approval", label: "⏳ Awaiting Approval", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { value: "Pending",           label: "Pending",              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { value: "Confirmed",         label: "✓ Confirmed",          color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    { value: "Completed",         label: "★ Completed",          color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "Cancelled",         label: "✕ Cancelled",          color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
];

const ROW_STATUS_BG = {
    awaiting_approval: "#fffdf5",
    Pending:           "#f8f8ff",
    Confirmed:         "#f0fbff",
    Completed:         "#f0fff4",
    Cancelled:         "#fff5f5",
};

const TIME_SLOTS = [
    "7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM",
    "10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM",
    "1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
    "4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM",
];

function StatusBadge({ status }) {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || { label: status, color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" };
    return (
        <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 20,
            fontSize: 11, fontWeight: 700, border: `1px solid ${opt.border}`,
            color: opt.color, background: opt.bg, whiteSpace: "nowrap",
        }}>{opt.label}</span>
    );
}

function StaffPopover({ booking, fieldStaff, onSave, onClose }) {
    const ref = useRef(null);
    const currentIds = (booking.assignedStaff || []).map(m => m.uid).filter(Boolean);
    const [selected, setSelected] = useState(new Set(currentIds));

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const toggle = (uid) => setSelected(prev => {
        const next = new Set(prev);
        next.has(uid) ? next.delete(uid) : next.add(uid);
        return next;
    });

    const save = () => {
        const ids = [...selected];
        const staff = (fieldStaff || []).filter(m => ids.includes(m.uid)).map(m => ({
            uid: m.uid, name: m.name || m.displayName, email: m.email,
        }));
        onSave({ assignedStaffIds: ids, assignedStaff: staff });
    };

    return (
        <div ref={ref} style={{
            position: "absolute", zIndex: 999, top: "100%", left: 0,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220, padding: 12,
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Assign Staff</div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {(fieldStaff || []).length === 0 && (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>No staff loaded</div>
                )}
                {(fieldStaff || []).map(m => (
                    <label key={m.uid} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                        <input type="checkbox" checked={selected.has(m.uid)} onChange={() => toggle(m.uid)} />
                        <span style={{ fontSize: 12 }}>{m.name || m.displayName}</span>
                    </label>
                ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={save} style={{ flex: 1, padding: "6px 0", background: "#0891b2", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                <button onClick={onClose} style={{ flex: 1, padding: "6px 0", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
        </div>
    );
}

function SchedulePopover({ booking, onSave, onClose }) {
    const ref = useRef(null);
    const [date, setDate] = useState(booking.date || "");
    const [time, setTime] = useState(booking.time || "");

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} style={{
            position: "absolute", zIndex: 999, top: "100%", left: 0,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 14, minWidth: 220,
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 10 }}>Reschedule</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Date</div>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }} />
                </div>
                <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>Start Time</div>
                    <select value={time} onChange={e => setTime(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}>
                        <option value="">-- Select time --</option>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={() => { if (date) onSave({ date, time }); }} style={{ flex: 1, padding: "6px 0", background: "#0891b2", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                <button onClick={onClose} style={{ flex: 1, padding: "6px 0", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
        </div>
    );
}

export default function BookingsTab({
    searchVal, setSearchVal,
    filterService, setFilterService,
    filterStatus, setFilterStatus,
    sortVal, setSortVal,
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
    fieldStaff,
    handleQuickBookingUpdate,
}) {
    const [editingCell, setEditingCell] = useState(null); // { bookingId, col }
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState("");
    const [dateFilter, setDateFilter] = useState(""); // "today" | "week" | "month" | ""
    const [saving, setSaving] = useState(null); // bookingId currently saving

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (str) => {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d) ? null : d;
    };

    const visibleBookings = (filteredBookings || []).filter(b => {
        if (!dateFilter) return true;
        const d = parseDate(b.date);
        if (!d) return true;
        if (dateFilter === "today") return d.toDateString() === today.toDateString();
        if (dateFilter === "week") {
            const end = new Date(today); end.setDate(today.getDate() + 7);
            return d >= today && d <= end;
        }
        if (dateFilter === "month") {
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }
        return true;
    });

    const quickUpdate = useCallback(async (bookingId, fields) => {
        if (!handleQuickBookingUpdate) return;
        setSaving(bookingId);
        await handleQuickBookingUpdate(bookingId, fields);
        setSaving(null);
        setEditingCell(null);
    }, [handleQuickBookingUpdate]);

    const toggleSelectAll = () => {
        if (selectedIds.size === visibleBookings.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleBookings.map(b => b.id)));
        }
    };

    const applyBulkStatus = async () => {
        if (!bulkStatus || selectedIds.size === 0) return;
        for (const id of selectedIds) {
            await handleQuickBookingUpdate?.(id, { status: bulkStatus });
        }
        setSelectedIds(new Set());
        setBulkStatus("");
    };

    const isEditing = (bookingId, col) => editingCell?.bookingId === bookingId && editingCell?.col === col;
    const startEditing = (bookingId, col) => setEditingCell({ bookingId, col });
    const stopEditing = () => setEditingCell(null);

    return (
        <div className="animate-fade">
            {/* Filters */}
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

            {/* Quick date filter pills + row count */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                    {[
                        { key: "", label: "All" },
                        { key: "today", label: "Today" },
                        { key: "week", label: "This Week" },
                        { key: "month", label: "This Month" },
                    ].map(opt => (
                        <button key={opt.key} onClick={() => setDateFilter(opt.key)} style={{
                            padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            border: dateFilter === opt.key ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                            background: dateFilter === opt.key ? "#ecfeff" : "#fff",
                            color: dateFilter === opt.key ? "#0891b2" : "#64748b",
                        }}>{opt.label}</button>
                    ))}
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                    Showing <strong>{visibleBookings.length}</strong> of <strong>{filteredBookings.length}</strong> bookings
                </span>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, marginBottom: 10,
                }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1" }}>{selectedIds.size} selected</span>
                    <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{
                        padding: "5px 10px", borderRadius: 6, border: "1px solid #bae6fd", fontSize: 12,
                    }}>
                        <option value="">Change status to…</option>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button onClick={applyBulkStatus} disabled={!bulkStatus} style={{
                        padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: bulkStatus ? "#0891b2" : "#e2e8f0", color: bulkStatus ? "#fff" : "#94a3b8", border: "none",
                    }}>Apply</button>
                    <button onClick={() => setSelectedIds(new Set())} style={{
                        marginLeft: "auto", padding: "5px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                        background: "transparent", border: "none", color: "#94a3b8",
                    }}>Clear</button>
                </div>
            )}

            <div className="table-container">
                {visibleBookings.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-sm">No scheduled cleanings match search variables.</div>
                ) : (
                    <table className="bookings-table">
                        <thead>
                            <tr>
                                <th style={{ width: 32 }}>
                                    <input type="checkbox"
                                        checked={selectedIds.size === visibleBookings.length && visibleBookings.length > 0}
                                        onChange={toggleSelectAll} />
                                </th>
                                <th>Client Details</th>
                                <th>Street Address</th>
                                <th>Service Details</th>
                                <th>Schedule Window <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>click to edit</span></th>
                                <th>Assigned Staff <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>click to edit</span></th>
                                <th>Status <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 400 }}>click to edit</span></th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleBookings.map(b => {
                                const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                const rowBg = ROW_STATUS_BG[b.status] || "#fff";
                                const isSaving = saving === b.id;

                                return (
                                    <tr key={b.id} style={{ background: rowBg, opacity: isSaving ? 0.6 : 1, transition: "opacity 0.2s" }}>
                                        {/* Checkbox */}
                                        <td style={{ width: 32 }}>
                                            <input type="checkbox"
                                                checked={selectedIds.has(b.id)}
                                                onChange={() => setSelectedIds(prev => {
                                                    const next = new Set(prev);
                                                    next.has(b.id) ? next.delete(b.id) : next.add(b.id);
                                                    return next;
                                                })} />
                                        </td>

                                        {/* Client Details */}
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

                                        {/* Address */}
                                        <td data-label="Street Address">
                                            <div className="address-cell text-xs" title={formatAddress(b)}>{formatAddress(b)}</div>
                                        </td>

                                        {/* Service Details */}
                                        <td data-label="Service Details" className="service-cell">
                                            <div className="flex flex-col items-end md:items-start">
                                                <div className="font-bold text-slate-700 text-xs">{b.service}</div>
                                                <div className="price-text">${parseFloat(b.price || 0).toFixed(2)}</div>
                                            </div>
                                        </td>

                                        {/* Schedule Window — click to edit */}
                                        <td data-label="Schedule Window" className="datetime-cell" style={{ position: "relative" }}>
                                            {isEditing(b.id, "schedule") ? (
                                                <SchedulePopover
                                                    booking={b}
                                                    onSave={(fields) => quickUpdate(b.id, fields)}
                                                    onClose={stopEditing}
                                                />
                                            ) : null}
                                            <div
                                                onClick={() => startEditing(b.id, "schedule")}
                                                style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}
                                                title="Click to reschedule"
                                            >
                                                <div style={{ fontWeight: 700, fontSize: 12 }}>{b.date || "—"}</div>
                                                <div style={{ fontSize: 11, color: "#64748b" }}>{formatTimeWindow(b.time, b.duration)}</div>
                                                <div style={{ fontSize: 10, color: "#94a3b8" }}>✏️ edit</div>
                                            </div>
                                        </td>

                                        {/* Assigned Staff — click to edit */}
                                        <td data-label="Assigned Staff" style={{ position: "relative" }}>
                                            {isEditing(b.id, "staff") ? (
                                                <StaffPopover
                                                    booking={b}
                                                    fieldStaff={fieldStaff}
                                                    onSave={(fields) => quickUpdate(b.id, fields)}
                                                    onClose={stopEditing}
                                                />
                                            ) : null}
                                            <div
                                                onClick={() => startEditing(b.id, "staff")}
                                                style={{ cursor: "pointer" }}
                                                title="Click to assign staff"
                                            >
                                                <div className="assigned-staff-list">
                                                    {(b.assignedStaff || []).map(member => (
                                                        <span key={member.uid || member.email}>{member.name}</span>
                                                    ))}
                                                    {!b.assignedStaff?.length && (
                                                        <span style={{ color: "#94a3b8" }}>{b.team || "Unassigned"}</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>✏️ edit</div>
                                            </div>
                                        </td>

                                        {/* Status — click to open inline select */}
                                        <td data-label="Status" style={{ position: "relative", minWidth: 140 }}>
                                            {isEditing(b.id, "status") ? (
                                                <select
                                                    autoFocus
                                                    defaultValue={b.status}
                                                    onChange={async (e) => {
                                                        await quickUpdate(b.id, { status: e.target.value });
                                                    }}
                                                    onBlur={stopEditing}
                                                    style={{
                                                        width: "100%", padding: "6px 8px", borderRadius: 8,
                                                        border: "2px solid #0891b2", fontSize: 12, cursor: "pointer",
                                                    }}
                                                >
                                                    {STATUS_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div onClick={() => startEditing(b.id, "status")} style={{ cursor: "pointer" }}>
                                                    <StatusBadge status={b.status} />
                                                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>✏️ edit</div>
                                                </div>
                                            )}
                                        </td>

                                        {/* Actions */}
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
