"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const STATUS_OPTIONS = [
    { value: "awaiting_approval", label: "⏳ Awaiting Approval", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { value: "Pending",           label: "Pending",              color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { value: "Confirmed",         label: "✓ Confirmed",          color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    { value: "Completed",         label: "★ Completed",          color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "Cancelled",         label: "✕ Cancelled",          color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
];

const PAYMENT_OPTIONS = [
    { value: "unpaid",  label: "Unpaid",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { value: "paid",    label: "💳 Paid",   color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "redo",    label: "↩ Redo",    color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { value: "pending", label: "Pending",   color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
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

function initials(name = "") {
    return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

const AVATAR_COLORS = ["#6366f1","#0891b2","#16a34a","#d97706","#dc2626","#7c3aed","#0d9488"];
function avatarColor(uid = "") {
    let n = 0;
    for (const c of uid) n = (n * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function StaffAvatar({ member, size = 30 }) {
    const [imgError, setImgError] = useState(false);
    const hasPhoto = member.photoURL && !imgError;
    const label = member.name || member.displayName || member.email || "?";
    return (
        <div title={label} style={{
            width: size, height: size, borderRadius: "50%",
            overflow: "hidden", flexShrink: 0,
            border: "2px solid #fff",
            boxShadow: "0 0 0 1.5px #e2e8f0",
            background: hasPhoto ? "transparent" : avatarColor(member.uid || label),
            display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            {hasPhoto ? (
                <img src={member.photoURL} alt={label} onError={() => setImgError(true)}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ fontSize: size * 0.36, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {initials(label)}
                </span>
            )}
        </div>
    );
}

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

function PaymentBadge({ status }) {
    const opt = PAYMENT_OPTIONS.find(o => o.value === (status || "unpaid")) || PAYMENT_OPTIONS[0];
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
            uid: m.uid,
            name: m.name || m.displayName,
            email: m.email,
            photoURL: m.photoURL || "",
        }));
        onSave({ assignedStaffIds: ids, assignedStaff: staff });
    };

    return (
        <div ref={ref} style={{
            position: "absolute", zIndex: 999, top: "100%", left: 0,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 230, padding: 12,
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Assign Staff</div>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {(fieldStaff || []).length === 0 && (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>No staff loaded</div>
                )}
                {(fieldStaff || []).map(m => (
                    <label key={m.uid} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 2px" }}>
                        <input type="checkbox" checked={selected.has(m.uid)} onChange={() => toggle(m.uid)} />
                        <StaffAvatar member={m} size={24} />
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
    filterTeam, setFilterTeam,
    filterPayment, setFilterPayment,
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
    branchTimezone,
}) {
    const [editingCell, setEditingCell] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [saving, setSaving] = useState(null);

    const tz = branchTimezone || "America/Toronto";

    // Get the current date string (YYYY-MM-DD) in the branch timezone.
    // Using Intl so an admin in Europe or Asia sees Ottawa's calendar day, not their own.
    const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date()); // → "2026-06-26"

    // Derive Monday and Sunday of the current branch-timezone week (Mon–Sun).
    const [ty, tm, td] = todayStr.split("-").map(Number);
    const todayJs = new Date(ty, tm - 1, td); // midnight, used only for day-of-week arithmetic
    const dow = todayJs.getDay();              // 0=Sun … 6=Sat
    const mondayJs = new Date(todayJs);
    mondayJs.setDate(td - (dow === 0 ? 6 : dow - 1));
    const sundayJs = new Date(mondayJs);
    sundayJs.setDate(mondayJs.getDate() + 6);
    const pad = n => String(n).padStart(2, "0");
    const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const mondayStr = toDateStr(mondayJs);
    const sundayStr = toDateStr(sundayJs);
    const monthPrefix = todayStr.slice(0, 7); // "2026-06"

    // All date comparisons use YYYY-MM-DD string order (lexicographic == chronological).
    // Booking dates are stored as plain YYYY-MM-DD strings so no timezone conversion is needed.
    const visibleBookings = (filteredBookings || []).filter(b => {
        if (!dateFilter || !b.date) return true;
        if (dateFilter === "today")  return b.date === todayStr;
        if (dateFilter === "week")   return b.date >= mondayStr && b.date <= sundayStr;
        if (dateFilter === "month")  return b.date.startsWith(monthPrefix);
        return true;
    });

    // Build a map of uid → photoURL from fieldStaff for avatar lookups
    const staffPhotoMap = {};
    (fieldStaff || []).forEach(m => { if (m.uid) staffPhotoMap[m.uid] = m.photoURL || ""; });

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

    const activeFilterCount = [filterService, filterStatus, filterTeam, filterPayment, dateFilter].filter(Boolean).length;

    return (
        <div className="animate-fade">
            {/* ── Filters card ── */}
            <div className="filters-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: search */}
                <div className="search-input-wrapper">
                    <span className="search-icon">{Icons.Search()}</span>
                    <input type="text" value={searchVal} onChange={e => setSearchVal(e.target.value)}
                        placeholder="Search client name, address, email or phone…" />
                    {searchVal && (
                        <button onClick={() => setSearchVal("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: "0 6px" }}>✕</button>
                    )}
                </div>

                {/* Row 2: dropdowns */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <select value={filterService} onChange={e => setFilterService(e.target.value)} style={{ flex: "1 1 160px" }}>
                        <option value="">All Services</option>
                        {Object.keys(pricingRates.services).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: "1 1 160px" }}>
                        <option value="">All Statuses</option>
                        <option value="awaiting_approval">⏳ Awaiting Approval</option>
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">✓ Confirmed</option>
                        <option value="Completed">★ Completed</option>
                        <option value="Cancelled">✕ Cancelled</option>
                    </select>

                    <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} style={{ flex: "1 1 140px" }}>
                        <option value="">All Payments</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">💳 Paid</option>
                        <option value="redo">↩ Redo</option>
                        <option value="pending">Pending Payment</option>
                    </select>

                    <select value={sortVal} onChange={e => setSortVal(e.target.value)} style={{ flex: "1 1 160px" }}>
                        <option value="date-asc">↑ Date: Soonest First</option>
                        <option value="date-desc">↓ Date: Latest First</option>
                        <option value="name-asc">A–Z Client Name</option>
                        <option value="price-desc">$ Price: Highest First</option>
                    </select>

                    {activeFilterCount > 0 && (
                        <button onClick={() => {
                            setFilterService(""); setFilterStatus("");
                            setFilterTeam(""); setFilterPayment(""); setDateFilter("");
                        }} style={{
                            padding: "6px 14px", borderRadius: 8, border: "1.5px solid #fecaca",
                            background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", whiteSpace: "nowrap",
                        }}>✕ Clear filters ({activeFilterCount})</button>
                    )}
                </div>
            </div>

            {/* Quick date pills + row count */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6 }}>
                    {[
                        { key: "", label: "All Dates" },
                        { key: "today",  label: "Today" },
                        { key: "week",   label: "This Week" },
                        { key: "month",  label: "This Month" },
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
                    Showing <strong>{visibleBookings.length}</strong> of <strong>{(filteredBookings || []).length}</strong> bookings
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
                    <div className="text-center p-12 text-slate-400 text-sm">No scheduled cleanings match your filters.</div>
                ) : (
                <div className="table-scroll-wrapper">
                    <table className="bookings-table">
                        <thead>
                            <tr>
                                <th style={{ width: 36 }}>
                                    <input type="checkbox"
                                        checked={selectedIds.size === visibleBookings.length && visibleBookings.length > 0}
                                        onChange={toggleSelectAll} />
                                </th>
                                <th style={{ minWidth: 160 }}>Client</th>
                                <th style={{ minWidth: 180 }}>Address</th>
                                <th style={{ minWidth: 140 }}>Service</th>
                                <th style={{ minWidth: 150 }}>Schedule ✏</th>
                                <th style={{ minWidth: 120 }}>Staff ✏</th>
                                <th style={{ minWidth: 130 }}>Status ✏</th>
                                <th style={{ minWidth: 110 }}>Payment ✏</th>
                                <th style={{ minWidth: 100, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleBookings.map(b => {
                                const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                const isSaving = saving === b.id;
                                const enrichedStaff = (b.assignedStaff || []).map(m => ({
                                    ...m, photoURL: m.photoURL || staffPhotoMap[m.uid] || "",
                                }));

                                return (
                                    <tr key={b.id} data-status={b.status} style={{ opacity: isSaving ? 0.5 : 1, transition: "opacity 0.15s" }}>

                                        {/* ── Checkbox ── */}
                                        <td style={{ width: 36 }}>
                                            <input type="checkbox" checked={selectedIds.has(b.id)}
                                                onChange={() => setSelectedIds(prev => {
                                                    const next = new Set(prev); next.has(b.id) ? next.delete(b.id) : next.add(b.id); return next;
                                                })} />
                                        </td>

                                        {/* ── Client ── */}
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", whiteSpace: "nowrap" }}>{b.clientName}</div>
                                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{b.phone}</div>
                                            {(b.customerConfirmed && b.status === "Pending") && (
                                                <span style={{ display:"inline-block", marginTop:3, fontSize:9, fontWeight:700, background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0", borderRadius:99, padding:"1px 7px" }}>✓ Confirmed</span>
                                            )}
                                            {hasPendingEdit && (
                                                <span style={{ display:"inline-block", marginTop:3, fontSize:9, fontWeight:700, background:"#fffbeb", color:"#d97706", border:"1px solid #fde68a", borderRadius:99, padding:"1px 7px" }}>● Review</span>
                                            )}
                                        </td>

                                        {/* ── Address ── */}
                                        <td>
                                            <div style={{ fontSize: 12, color: "#475569", maxWidth: 200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={formatAddress(b)}>
                                                {formatAddress(b)}
                                            </div>
                                        </td>

                                        {/* ── Service ── */}
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: 12, color: "#1e293b" }}>{b.service}</div>
                                            <div style={{ fontSize: 12, fontWeight: 800, color: "#0891b2", marginTop: 1 }}>${parseFloat(b.price || 0).toFixed(2)}</div>
                                        </td>

                                        {/* ── Schedule ── click to edit */}
                                        <td style={{ position: "relative" }}>
                                            {isEditing(b.id, "schedule") && (
                                                <SchedulePopover booking={b} onSave={f => quickUpdate(b.id, f)} onClose={stopEditing} />
                                            )}
                                            <div onClick={() => startEditing(b.id, "schedule")} style={{ cursor: "pointer" }} title="Click to reschedule">
                                                <div style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}>{b.date || "—"}</div>
                                                <div style={{ fontSize: 11, color: "#64748b" }}>{formatTimeWindow(b.time, b.duration)}</div>
                                            </div>
                                        </td>

                                        {/* ── Staff avatars ── click to edit */}
                                        <td style={{ position: "relative" }}>
                                            {isEditing(b.id, "staff") && (
                                                <StaffPopover booking={b} fieldStaff={fieldStaff} onSave={f => quickUpdate(b.id, f)} onClose={stopEditing} />
                                            )}
                                            <div onClick={() => startEditing(b.id, "staff")} style={{ cursor: "pointer" }} title="Click to assign staff">
                                                {enrichedStaff.length > 0 ? (
                                                    <div style={{ display: "flex" }}>
                                                        {enrichedStaff.slice(0, 4).map((m, i) => (
                                                            <div key={m.uid || i} style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 10 - i }}>
                                                                <StaffAvatar member={m} size={28} />
                                                            </div>
                                                        ))}
                                                        {enrichedStaff.length > 4 && (
                                                            <div style={{ marginLeft: -7, width: 28, height: 28, borderRadius: "50%", background: "#e2e8f0", border: "2px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 9, fontWeight: 800, color: "#64748b" }}>
                                                                +{enrichedStaff.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: "#cbd5e1", fontStyle:"italic" }}>Unassigned</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* ── Status ── click to edit */}
                                        <td style={{ position: "relative" }}>
                                            {isEditing(b.id, "status") ? (
                                                <select autoFocus defaultValue={b.status}
                                                    onChange={async e => { await quickUpdate(b.id, { status: e.target.value }); }}
                                                    onBlur={stopEditing}
                                                    style={{ width:"100%", padding:"5px 7px", borderRadius:7, border:"2px solid #818cf8", fontSize:12, cursor:"pointer" }}>
                                                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            ) : (
                                                <div onClick={() => startEditing(b.id, "status")} style={{ cursor: "pointer" }}>
                                                    <StatusBadge status={b.status} />
                                                </div>
                                            )}
                                        </td>

                                        {/* ── Payment ── click to edit */}
                                        <td style={{ position: "relative" }}>
                                            {isEditing(b.id, "payment") ? (
                                                <select autoFocus defaultValue={b.paymentStatus || "unpaid"}
                                                    onChange={async e => { await quickUpdate(b.id, { paymentStatus: e.target.value }); }}
                                                    onBlur={stopEditing}
                                                    style={{ width:"100%", padding:"5px 7px", borderRadius:7, border:"2px solid #34d399", fontSize:12, cursor:"pointer" }}>
                                                    {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            ) : (
                                                <div onClick={() => startEditing(b.id, "payment")} style={{ cursor: "pointer" }}>
                                                    <PaymentBadge status={b.paymentStatus} />
                                                </div>
                                            )}
                                        </td>

                                        {/* ── Actions ── */}
                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                            <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
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
                </div>
                )}
            </div>
        </div>
    );
}
