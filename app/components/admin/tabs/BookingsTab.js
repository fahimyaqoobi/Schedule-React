"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const STATUS_OPTIONS = [
    { value: "Lead",              label: "Lead",                  color: "#78716c", bg: "#fafaf9", border: "#e7e5e4" },
    { value: "Follow Up",         label: "Follow Up",             color: "#a16207", bg: "#fefce8", border: "#fef08a" },
    { value: "Quote",             label: "💬 Quote",               color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
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

const METHOD_OPTIONS = [
    { value: "",               label: "— None —" },
    { value: "cash",           label: "💵 Cash" },
    { value: "e-transfer",     label: "📲 E-Transfer" },
    { value: "credit-card",    label: "💳 Card" },
    { value: "direct-deposit", label: "🏦 Direct Deposit" },
    { value: "cheque",         label: "📄 Cheque" },
];

const TIME_SLOTS = [
    "7:00 AM","7:30 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM",
    "10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM",
    "1:00 PM","1:30 PM","2:00 PM","2:30 PM","3:00 PM","3:30 PM",
    "4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM",
];

const COLUMN_STORAGE_KEY = "stc_bookings_columns_v1";

// Toggleable / reorderable columns. "client" and "actions" are fixed in place
// (first and last) so the table always has an identity anchor and row actions.
const COLUMN_DEFS = [
    { key: "phone",     label: "Phone",        minWidth: 130, defaultVisible: false },
    { key: "email",     label: "Email",        minWidth: 190, defaultVisible: false },
    { key: "address",   label: "Address",      minWidth: 190, defaultVisible: true },
    { key: "service",   label: "Service",      minWidth: 150, defaultVisible: true },
    { key: "amount",    label: "Amount",       minWidth: 100, defaultVisible: true },
    { key: "duration",  label: "Duration",     minWidth: 90,  defaultVisible: false },
    { key: "schedule",  label: "Schedule",     minWidth: 150, defaultVisible: true },
    { key: "staff",     label: "Staff",        minWidth: 120, defaultVisible: true },
    { key: "status",    label: "Status",       minWidth: 140, defaultVisible: true },
    { key: "payment",   label: "Payment",      minWidth: 110, defaultVisible: true },
    { key: "method",    label: "Method",       minWidth: 120, defaultVisible: false },
    { key: "source",    label: "Lead Source",  minWidth: 120, defaultVisible: true },
    { key: "frequency", label: "Frequency",    minWidth: 110, defaultVisible: false },
    { key: "notes",     label: "Notes",        minWidth: 180, defaultVisible: false },
    { key: "created",   label: "Created",      minWidth: 130, defaultVisible: false },
];
const COLUMN_DEF_MAP = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, c]));
const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map(c => c.key);
const DEFAULT_HIDDEN_COLUMNS = COLUMN_DEFS.filter(c => !c.defaultVisible).map(c => c.key);

function loadColumnPrefs() {
    if (typeof window === "undefined") return { order: DEFAULT_COLUMN_ORDER, hidden: DEFAULT_HIDDEN_COLUMNS };
    try {
        const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
        if (!raw) return { order: DEFAULT_COLUMN_ORDER, hidden: DEFAULT_HIDDEN_COLUMNS };
        const parsed = JSON.parse(raw);
        const savedOrder = Array.isArray(parsed.order) ? parsed.order.filter(k => COLUMN_DEF_MAP[k]) : [];
        // Merge in any newly-added columns that weren't in the saved order yet.
        const mergedOrder = [...savedOrder, ...DEFAULT_COLUMN_ORDER.filter(k => !savedOrder.includes(k))];
        const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(k => COLUMN_DEF_MAP[k]) : DEFAULT_HIDDEN_COLUMNS;
        return { order: mergedOrder, hidden };
    } catch {
        return { order: DEFAULT_COLUMN_ORDER, hidden: DEFAULT_HIDDEN_COLUMNS };
    }
}

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

function ColumnManagerPopover({ order, hidden, onToggle, onMove, onShowAll, onReset, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} style={{
            position: "absolute", zIndex: 999, top: "100%", right: 0, marginTop: 6,
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)", minWidth: 260, padding: 12,
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>Table Columns</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>Show, hide, and reorder. Saved to this device.</div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {order.map((key, idx) => {
                    const def = COLUMN_DEF_MAP[key];
                    if (!def) return null;
                    const isHidden = hidden.has(key);
                    return (
                        <div key={key} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "5px 4px",
                            borderRadius: 6, background: isHidden ? "transparent" : "#f8fafc",
                        }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, cursor: "pointer" }}>
                                <input type="checkbox" checked={!isHidden} onChange={() => onToggle(key)} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: isHidden ? "#94a3b8" : "#1e293b" }}>{def.label}</span>
                            </label>
                            <div style={{ display: "flex", gap: 2 }}>
                                <button onClick={() => onMove(idx, -1)} disabled={idx === 0} title="Move up" style={{
                                    background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer",
                                    opacity: idx === 0 ? 0.25 : 1, fontSize: 11, padding: "2px 4px",
                                }}>▲</button>
                                <button onClick={() => onMove(idx, 1)} disabled={idx === order.length - 1} title="Move down" style={{
                                    background: "none", border: "none", cursor: idx === order.length - 1 ? "default" : "pointer",
                                    opacity: idx === order.length - 1 ? 0.25 : 1, fontSize: 11, padding: "2px 4px",
                                }}>▼</button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                <button onClick={onShowAll} style={{ flex: 1, padding: "6px 0", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Show All</button>
                <button onClick={onReset} style={{ flex: 1, padding: "6px 0", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Reset Default</button>
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
    leadSources,
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
    openNewBookingCommand,
    teams,
}) {
    const [editingCell, setEditingCell] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [saving, setSaving] = useState(null);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState("asc");
    const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
    const [columnManagerOpen, setColumnManagerOpen] = useState(false);

    // ── Extra local filters (layered on top of the server/page-level ones) ──
    const [filterStaff, setFilterStaff] = useState("");
    const [filterSource, setFilterSource] = useState("");
    const [filterMethod, setFilterMethod] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [amountMin, setAmountMin] = useState("");
    const [amountMax, setAmountMax] = useState("");
    const [unassignedOnly, setUnassignedOnly] = useState(false);
    const [recurringOnly, setRecurringOnly] = useState(false);

    // ── Column visibility / order, persisted to localStorage ──
    const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
    const [hiddenColumns, setHiddenColumns] = useState(new Set(DEFAULT_HIDDEN_COLUMNS));
    const [columnsLoaded, setColumnsLoaded] = useState(false);

    useEffect(() => {
        const prefs = loadColumnPrefs();
        setColumnOrder(prefs.order);
        setHiddenColumns(new Set(prefs.hidden));
        setColumnsLoaded(true);
    }, []);

    useEffect(() => {
        if (!columnsLoaded || typeof window === "undefined") return;
        window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify({ order: columnOrder, hidden: [...hiddenColumns] }));
    }, [columnOrder, hiddenColumns, columnsLoaded]);

    const toggleColumn = (key) => setHiddenColumns(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });
    const moveColumn = (idx, dir) => setColumnOrder(prev => {
        const next = [...prev];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return prev;
        [next[idx], next[target]] = [next[target], next[idx]];
        return next;
    });
    const showAllColumns = () => setHiddenColumns(new Set());
    const resetColumns = () => { setColumnOrder(DEFAULT_COLUMN_ORDER); setHiddenColumns(new Set(DEFAULT_HIDDEN_COLUMNS)); };

    const visibleColumnDefs = columnOrder.map(k => COLUMN_DEF_MAP[k]).filter(Boolean).filter(c => !hiddenColumns.has(c.key));

    const handleColSort = (col) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    };
    const SortArrow = ({ col }) => sortCol !== col ? <span style={{ opacity: 0.3, fontSize: 9 }}>⇅</span> : sortDir === "asc" ? <span style={{ fontSize: 9 }}>▲</span> : <span style={{ fontSize: 9 }}>▼</span>;

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

    const staffPhotoMap = {};
    (fieldStaff || []).forEach(m => { if (m.uid) staffPhotoMap[m.uid] = m.photoURL || ""; });

    const sortAccessors = {
        client:     b => (b.clientName || "").toLowerCase(),
        phone:      b => b.phone || "",
        email:      b => (b.email || "").toLowerCase(),
        address:    b => formatAddress(b).toLowerCase(),
        service:    b => (b.service || "").toLowerCase(),
        amount:     b => parseFloat(b.price || b.totalAmount || 0),
        duration:   b => parseFloat(b.duration || 0),
        schedule:   b => `${b.date || ""} ${b.time || ""}`,
        staff:      b => (b.assignedStaff || []).length,
        status:     b => b.status || "",
        payment:    b => b.paymentStatus || "",
        method:     b => (b.paymentMethod || "").toLowerCase(),
        source:     b => (b.leadSource || "").toLowerCase(),
        frequency:  b => (b.frequency || "").toLowerCase(),
        notes:      b => (b.specialNotes || b.notes || "").toLowerCase(),
        created:    b => b.createdAt || "",
    };

    // All date comparisons use YYYY-MM-DD string order (lexicographic == chronological).
    // Booking dates are stored as plain YYYY-MM-DD strings so no timezone conversion is needed.
    const visibleBookings = useMemo(() => {
        const filtered = (filteredBookings || []).filter(b => {
            if (dateFrom && (!b.date || b.date < dateFrom)) return false;
            if (dateTo && (!b.date || b.date > dateTo)) return false;
            if (!dateFrom && !dateTo && dateFilter) {
                if (dateFilter === "today" && b.date !== todayStr) return false;
                if (dateFilter === "week" && !(b.date >= mondayStr && b.date <= sundayStr)) return false;
                if (dateFilter === "month" && !(b.date || "").startsWith(monthPrefix)) return false;
            }
            if (filterStaff) {
                const staffIds = (b.assignedStaffIds || b.assignedStaff || []).map(s => s.uid || s);
                if (!staffIds.includes(filterStaff)) return false;
            }
            if (filterSource && (b.leadSource || "") !== filterSource) return false;
            if (filterMethod && (b.paymentMethod || "") !== filterMethod) return false;
            const amount = parseFloat(b.price || b.totalAmount || 0);
            if (amountMin !== "" && amount < parseFloat(amountMin)) return false;
            if (amountMax !== "" && amount > parseFloat(amountMax)) return false;
            if (unassignedOnly && (b.assignedStaff || []).length > 0) return false;
            if (recurringOnly && !b.isRecurring) return false;
            return true;
        });
        if (!sortCol || !sortAccessors[sortCol]) return filtered;
        const accessor = sortAccessors[sortCol];
        return [...filtered].sort((a, b) => {
            const av = accessor(a), bv = accessor(b);
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredBookings, dateFilter, dateFrom, dateTo, filterStaff, filterSource, filterMethod, amountMin, amountMax, unassignedOnly, recurringOnly, sortCol, sortDir, todayStr, mondayStr, sundayStr, monthPrefix]);

    const exportToExcel = useCallback(() => {
        const METHOD_LABELS = { cash: "Cash", "e-transfer": "E-Transfer", "credit-card": "Card", "direct-deposit": "Direct Deposit", cheque: "Cheque" };
        const rows = visibleBookings.map(b => ({
            "Booking #":      b.bookingNumber || b.id || "",
            "Date":           b.date || "",
            "Shift(s)":       (b.shifts || []).join(", ") || b.time || "",
            "Client Name":    b.clientName || `${b.firstName || ""} ${b.lastName || ""}`.trim(),
            "Phone":          b.phone || "",
            "Email":          b.email || "",
            "Address":        [b.address1, b.address2, b.city, b.state, b.postalCode].filter(Boolean).join(", "),
            "Service":        b.service || "",
            "Duration (hrs)": b.duration || "",
            "Frequency":      b.frequency || "",
            "Status":         b.status || "",
            "Payment Status": b.paymentStatus || "",
            "Payment Method": METHOD_LABELS[b.paymentMethod] || b.paymentMethod || "",
            "Lead Source":    b.leadSource || "",
            "Subtotal":       parseFloat(b.subtotal || b.price || 0).toFixed(2),
            "Tax":            parseFloat(b.tax || 0).toFixed(2),
            "Total":          parseFloat(b.price || b.subtotal || 0).toFixed(2),
            "Discount $":     parseFloat(b.customDiscountAmount || 0).toFixed(2),
            "Promo Code":     b.promoCode || "",
            "Assigned Staff": (b.assignedStaff || []).map(s => s.name || s).join(", "),
            "Notes":          b.specialNotes || b.notes || "",
            "Created":        b.createdAt ? new Date(b.createdAt).toLocaleString() : "",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length, 14) }));
        ws["!cols"] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bookings");
        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `SmarTouch_Bookings_${dateStr}.xlsx`);
    }, [visibleBookings]);

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

    const clearAllFilters = () => {
        setFilterService(""); setFilterStatus("");
        setFilterTeam(""); setFilterPayment(""); setDateFilter("");
        setFilterStaff(""); setFilterSource(""); setFilterMethod("");
        setDateFrom(""); setDateTo("");
        setAmountMin(""); setAmountMax("");
        setUnassignedOnly(false); setRecurringOnly(false);
    };

    const activeFilterCount = [
        filterService, filterStatus, filterTeam, filterPayment, dateFilter,
        filterStaff, filterSource, filterMethod, dateFrom, dateTo, amountMin, amountMax,
    ].filter(Boolean).length + (unassignedOnly ? 1 : 0) + (recurringOnly ? 1 : 0);

    const moreFilterCount = [
        filterTeam, filterStaff, filterSource, filterMethod, dateFrom, dateTo, amountMin, amountMax,
    ].filter(Boolean).length + (unassignedOnly ? 1 : 0) + (recurringOnly ? 1 : 0);

    const renderCell = (col, b) => {
        switch (col.key) {
            case "phone":
                return <span style={{ fontSize: 12, color: "#475569" }}>{b.phone || "—"}</span>;
            case "email":
                return <span style={{ fontSize: 12, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 200 }} title={b.email}>{b.email || "—"}</span>;
            case "address":
                return (
                    <div style={{ fontSize: 12, color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatAddress(b)}>
                        {formatAddress(b)}
                    </div>
                );
            case "service":
                return <div style={{ fontWeight: 600, fontSize: 12, color: "#1e293b" }}>{b.service}</div>;
            case "amount":
                return <div style={{ fontSize: 12, fontWeight: 800, color: "#0891b2" }}>${parseFloat(b.price || b.totalAmount || 0).toFixed(2)}</div>;
            case "duration":
                return <span style={{ fontSize: 12, color: "#475569" }}>{b.duration ? `${b.duration} hr${b.duration === 1 ? "" : "s"}` : "—"}</span>;
            case "schedule":
                return (
                    <div style={{ position: "relative" }}>
                        {isEditing(b.id, "schedule") && (
                            <SchedulePopover booking={b} onSave={f => quickUpdate(b.id, f)} onClose={stopEditing} />
                        )}
                        <div onClick={() => startEditing(b.id, "schedule")} style={{ cursor: "pointer" }} title="Click to reschedule">
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}>{b.date || "—"}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{formatTimeWindow(b.time, b.duration)}</div>
                        </div>
                    </div>
                );
            case "staff": {
                const enrichedStaff = (b.assignedStaff || []).map(m => ({ ...m, photoURL: m.photoURL || staffPhotoMap[m.uid] || "" }));
                return (
                    <div style={{ position: "relative" }}>
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
                                        <div style={{ marginLeft: -7, width: 28, height: 28, borderRadius: "50%", background: "#e2e8f0", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#64748b" }}>
                                            +{enrichedStaff.length - 4}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span style={{ fontSize: 11, color: "#cbd5e1", fontStyle: "italic" }}>Unassigned</span>
                            )}
                        </div>
                    </div>
                );
            }
            case "status":
                return (
                    <div style={{ position: "relative" }}>
                        {isEditing(b.id, "status") ? (
                            <select autoFocus defaultValue={b.status}
                                onChange={async e => { await quickUpdate(b.id, { status: e.target.value }); }}
                                onBlur={stopEditing}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 7, border: "2px solid #818cf8", fontSize: 12, cursor: "pointer" }}>
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "status")} style={{ cursor: "pointer" }}>
                                <StatusBadge status={b.status} />
                            </div>
                        )}
                    </div>
                );
            case "payment":
                return (
                    <div style={{ position: "relative" }}>
                        {isEditing(b.id, "payment") ? (
                            <select autoFocus defaultValue={b.paymentStatus || "unpaid"}
                                onChange={async e => { await quickUpdate(b.id, { paymentStatus: e.target.value }); }}
                                onBlur={stopEditing}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 7, border: "2px solid #34d399", fontSize: 12, cursor: "pointer" }}>
                                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "payment")} style={{ cursor: "pointer" }}>
                                <PaymentBadge status={b.paymentStatus} />
                            </div>
                        )}
                    </div>
                );
            case "method":
                return (
                    <div style={{ position: "relative" }}>
                        {isEditing(b.id, "method") ? (
                            <select autoFocus defaultValue={b.paymentMethod || ""}
                                onChange={async e => { await quickUpdate(b.id, { paymentMethod: e.target.value }); }}
                                onBlur={stopEditing}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 7, border: "2px solid #818cf8", fontSize: 12, cursor: "pointer" }}>
                                {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "method")} style={{ cursor: "pointer" }}>
                                {b.paymentMethod ? (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                                        {METHOD_OPTIONS.find(o => o.value === b.paymentMethod)?.label || b.paymentMethod}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>— set</span>
                                )}
                            </div>
                        )}
                    </div>
                );
            case "source":
                return (
                    <div style={{ position: "relative" }}>
                        {isEditing(b.id, "source") ? (
                            <select autoFocus defaultValue={b.leadSource || ""}
                                onChange={async e => { await quickUpdate(b.id, { leadSource: e.target.value }); }}
                                onBlur={stopEditing}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 7, border: "2px solid #818cf8", fontSize: 12, cursor: "pointer" }}>
                                <option value="">— None —</option>
                                {leadSources.map(src => <option key={src} value={src}>{src}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "source")} style={{ cursor: "pointer" }}>
                                {b.leadSource ? (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>
                                        {b.leadSource}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>— set</span>
                                )}
                            </div>
                        )}
                    </div>
                );
            case "frequency":
                return <span style={{ fontSize: 12, color: "#475569" }}>{b.isRecurring ? (b.frequency || "Recurring") : "One-time"}</span>;
            case "notes":
                return (
                    <div style={{ fontSize: 12, color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.specialNotes || b.notes || ""}>
                        {b.specialNotes || b.notes || "—"}
                    </div>
                );
            case "created":
                return <span style={{ fontSize: 11, color: "#94a3b8" }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "—"}</span>;
            default:
                return null;
        }
    };

    return (
        <div className="animate-fade">
            {/* ── New Booking entry point (moved here from Dashboard) ── */}
            {openNewBookingCommand && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                    <button onClick={openNewBookingCommand} className="admin-primary-action" type="button">
                        {Icons.Plus()}
                        New Booking
                    </button>
                </div>
            )}
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

                {/* Row 2: primary dropdowns */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <select value={filterService} onChange={e => setFilterService(e.target.value)} style={{ flex: "1 1 160px" }}>
                        <option value="">All Services</option>
                        {Object.keys(pricingRates.services).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: "1 1 160px" }}>
                        <option value="">All Statuses</option>
                        <option value="Lead">Lead</option>
                        <option value="Follow Up">Follow Up</option>
                        <option value="Quote">💬 Quote</option>
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

                    <button onClick={() => setMoreFiltersOpen(v => !v)} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 8, border: moreFiltersOpen ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                        background: moreFiltersOpen ? "#ecfeff" : "#fff", color: moreFiltersOpen ? "#0891b2" : "#475569",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                        {moreFiltersOpen ? "▲" : "▼"} More Filters {moreFilterCount > 0 ? `(${moreFilterCount})` : ""}
                    </button>

                    {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} style={{
                            padding: "6px 14px", borderRadius: 8, border: "1.5px solid #fecaca",
                            background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", whiteSpace: "nowrap",
                        }}>✕ Clear filters ({activeFilterCount})</button>
                    )}
                </div>

                {/* Row 3: progressive-disclosure "more filters" panel */}
                {moreFiltersOpen && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        {teams && teams.length > 0 && (
                            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ flex: "1 1 150px" }}>
                                <option value="">All Teams</option>
                                {teams.map(t => <option key={t.id || t.name} value={t.name}>{t.name}</option>)}
                            </select>
                        )}
                        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ flex: "1 1 170px" }}>
                            <option value="">All Staff</option>
                            {(fieldStaff || []).map(m => <option key={m.uid} value={m.uid}>{m.name || m.displayName || m.email}</option>)}
                        </select>
                        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ flex: "1 1 150px" }}>
                            <option value="">All Lead Sources</option>
                            {leadSources.map(src => <option key={src} value={src}>{src}</option>)}
                        </select>
                        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ flex: "1 1 150px" }}>
                            <option value="">All Payment Methods</option>
                            {METHOD_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 220px" }}>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>to</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 180px" }}>
                            <input type="number" min="0" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="Min $" style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>–</span>
                            <input type="number" min="0" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="Max $" style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
                            <input type="checkbox" checked={unassignedOnly} onChange={e => setUnassignedOnly(e.target.checked)} />
                            Unassigned only
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
                            <input type="checkbox" checked={recurringOnly} onChange={e => setRecurringOnly(e.target.checked)} />
                            Recurring only
                        </label>
                    </div>
                )}
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
                        <button key={opt.key} onClick={() => { setDateFilter(opt.key); setDateFrom(""); setDateTo(""); }} style={{
                            padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            border: (!dateFrom && !dateTo && dateFilter === opt.key) ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                            background: (!dateFrom && !dateTo && dateFilter === opt.key) ? "#ecfeff" : "#fff",
                            color: (!dateFrom && !dateTo && dateFilter === opt.key) ? "#0891b2" : "#64748b",
                        }}>{opt.label}</button>
                    ))}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        Showing <strong>{visibleBookings.length}</strong> of <strong>{(filteredBookings || []).length}</strong> bookings
                    </span>
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setColumnManagerOpen(v => !v)}
                            style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                border: columnManagerOpen ? "1.5px solid #6366f1" : "1.5px solid #e2e8f0",
                                background: columnManagerOpen ? "#eef2ff" : "#fff", color: columnManagerOpen ? "#4f46e5" : "#475569",
                                cursor: "pointer", whiteSpace: "nowrap",
                            }}
                            title="Show, hide, and reorder columns"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="18" rx="1"></rect>
                                <rect x="14" y="3" width="7" height="18" rx="1"></rect>
                            </svg>
                            Columns
                        </button>
                        {columnManagerOpen && (
                            <ColumnManagerPopover
                                order={columnOrder}
                                hidden={hiddenColumns}
                                onToggle={toggleColumn}
                                onMove={moveColumn}
                                onShowAll={showAllColumns}
                                onReset={resetColumns}
                                onClose={() => setColumnManagerOpen(false)}
                            />
                        )}
                    </div>
                    <button
                        onClick={exportToExcel}
                        disabled={visibleBookings.length === 0}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "1.5px solid #16a34a", background: "#f0fdf4", color: "#16a34a",
                            cursor: visibleBookings.length === 0 ? "not-allowed" : "pointer",
                            opacity: visibleBookings.length === 0 ? 0.5 : 1,
                            whiteSpace: "nowrap",
                        }}
                        title="Export visible bookings to Excel"
                    >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M2 12l4-4 3 3 5-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="1" y="1" width="14" height="14" rx="2" stroke="#16a34a" strokeWidth="1.5"/>
                            <path d="M5 8l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Export Excel
                    </button>
                </div>
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
                                <th style={{ minWidth: 160, cursor: "pointer", userSelect: "none" }} onClick={() => handleColSort("client")}>Client <SortArrow col="client" /></th>
                                {visibleColumnDefs.map(col => (
                                    <th key={col.key} style={{ minWidth: col.minWidth, cursor: "pointer", userSelect: "none" }} onClick={() => handleColSort(col.key)}>
                                        {col.label} <SortArrow col={col.key} />
                                    </th>
                                ))}
                                <th style={{ minWidth: 100, textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleBookings.map(b => {
                                const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                const isSaving = saving === b.id;

                                return (
                                    <tr key={b.id} data-status={b.status} style={{ opacity: isSaving ? 0.5 : 1, transition: "opacity 0.15s" }}>

                                        {/* ── Checkbox ── */}
                                        <td style={{ width: 36 }}>
                                            <input type="checkbox" checked={selectedIds.has(b.id)}
                                                onChange={() => setSelectedIds(prev => {
                                                    const next = new Set(prev); next.has(b.id) ? next.delete(b.id) : next.add(b.id); return next;
                                                })} />
                                        </td>

                                        {/* ── Client (fixed, always shown) ── */}
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

                                        {/* ── Configurable columns ── */}
                                        {visibleColumnDefs.map(col => (
                                            <td key={col.key} style={{ position: "relative" }}>{renderCell(col, b)}</td>
                                        ))}

                                        {/* ── Actions (fixed, always shown) ── */}
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
