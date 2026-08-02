"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
    Plus, Search, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ArrowUpDown,
    Columns3, FileSpreadsheet, Eye, Pencil, Trash2, CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZonedDate, formatZonedDateTime } from "@/lib/timezone";

const STATUS_OPTIONS = [
    { value: "Lead", label: "Lead", color: "#78716c", bg: "#fafaf9", border: "#e7e5e4" },
    { value: "Follow Up", label: "Follow Up", color: "#a16207", bg: "#fefce8", border: "#fef08a" },
    { value: "Quote", label: "💬 Quote", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    { value: "awaiting_approval", label: "⏳ Awaiting Approval", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { value: "Pending", label: "Pending", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
    { value: "Confirmed", label: "✓ Confirmed", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
    { value: "Completed", label: "★ Completed", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "Cancelled", label: "✕ Cancelled", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
];

const PAYMENT_OPTIONS = [
    { value: "unpaid", label: "Unpaid", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    { value: "partial", label: "◐ Partial", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { value: "paid", label: "💳 Paid", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
    { value: "redo", label: "↩ Redo", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    { value: "pending", label: "Pending", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
];

const METHOD_OPTIONS = [
    { value: "", label: "— None —" },
    { value: "cash", label: "💵 Cash" },
    { value: "e-transfer", label: "📲 E-Transfer" },
    { value: "credit-card", label: "💳 Card" },
    { value: "direct-deposit", label: "🏦 Direct Deposit" },
    { value: "cheque", label: "📄 Cheque" },
];

const TIME_SLOTS = [
    "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
    "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
    "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM",
];

const COLUMN_STORAGE_KEY = "stc_bookings_columns_v1";

// Toggleable / reorderable columns. "client" and "actions" are fixed in place
// (first and last) so the table always has an identity anchor and row actions.
const COLUMN_DEFS = [
    { key: "phone", label: "Phone", minWidth: 130, defaultVisible: false },
    { key: "email", label: "Email", minWidth: 190, defaultVisible: false },
    { key: "address", label: "Address", minWidth: 190, defaultVisible: true },
    { key: "service", label: "Service", minWidth: 150, defaultVisible: true },
    { key: "amount", label: "Amount", minWidth: 100, defaultVisible: true },
    { key: "duration", label: "Duration", minWidth: 90, defaultVisible: false },
    { key: "schedule", label: "Schedule", minWidth: 150, defaultVisible: true },
    { key: "staff", label: "Staff", minWidth: 120, defaultVisible: true },
    { key: "status", label: "Status", minWidth: 140, defaultVisible: true },
    { key: "payment", label: "Payment", minWidth: 110, defaultVisible: true },
    { key: "method", label: "Method", minWidth: 120, defaultVisible: false },
    { key: "source", label: "Lead Source", minWidth: 120, defaultVisible: true },
    { key: "frequency", label: "Frequency", minWidth: 110, defaultVisible: false },
    { key: "notes", label: "Notes", minWidth: 180, defaultVisible: false },
    { key: "created", label: "Created", minWidth: 130, defaultVisible: false },
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

const AVATAR_COLORS = ["#6366f1", "#0891b2", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0d9488"];
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
        <div
            title={label}
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background ring-1 ring-border"
            style={{ width: size, height: size, background: hasPhoto ? "transparent" : avatarColor(member.uid || label) }}
        >
            {hasPhoto ? (
                <img src={member.photoURL} alt={label} onError={() => setImgError(true)} className="size-full object-cover" />
            ) : (
                <span className="font-bold text-white" style={{ fontSize: size * 0.36, lineHeight: 1 }}>{initials(label)}</span>
            )}
        </div>
    );
}

function ColorBadge({ opt }) {
    return (
        <span
            className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ border: `1px solid ${opt.border}`, color: opt.color, background: opt.bg }}
        >
            {opt.label}
        </span>
    );
}

function StatusBadge({ status }) {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || { label: status, color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0" };
    return <ColorBadge opt={opt} />;
}

function PaymentBadge({ status }) {
    const opt = PAYMENT_OPTIONS.find(o => o.value === (status || "unpaid")) || PAYMENT_OPTIONS[0];
    return <ColorBadge opt={opt} />;
}

function Popover({ innerRef, className, children }) {
    return (
        <div ref={innerRef} className={cn("absolute top-full left-0 z-50 mt-1.5 rounded-lg border border-border bg-popover p-3 shadow-lg ring-1 ring-foreground/5", className)}>
            {children}
        </div>
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
        <Popover innerRef={ref} className="min-w-58">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">Assign Staff</p>
            <div className="flex max-h-50 flex-col gap-1 overflow-y-auto">
                {(fieldStaff || []).length === 0 && <p className="text-[11px] text-muted-foreground">No staff loaded</p>}
                {(fieldStaff || []).map(m => (
                    <label key={m.uid} className="flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-1 hover:bg-muted/50">
                        <Checkbox checked={selected.has(m.uid)} onCheckedChange={() => toggle(m.uid)} />
                        <StaffAvatar member={m} size={24} />
                        <span className="text-xs">{m.name || m.displayName}</span>
                    </label>
                ))}
            </div>
            <div className="mt-2.5 flex gap-1.5">
                <Button size="sm" className="flex-1" onClick={save}>Save</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            </div>
        </Popover>
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
        <Popover innerRef={ref} className="min-w-55">
            <p className="mb-2.5 text-[11px] font-bold text-muted-foreground">Reschedule</p>
            <div className="flex flex-col gap-2">
                <div>
                    <p className="mb-1 text-[10px] text-muted-foreground">Date</p>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                    <p className="mb-1 text-[10px] text-muted-foreground">Start Time</p>
                    <Select value={time} onValueChange={setTime}>
                        <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="-- Select time --" /></SelectTrigger>
                        <SelectContent>{TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="mt-3 flex gap-1.5">
                <Button size="sm" className="flex-1" onClick={() => { if (date) onSave({ date, time }); }}>Save</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            </div>
        </Popover>
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
        <div ref={ref} className="absolute top-full right-0 z-50 mt-1.5 min-w-65 rounded-lg border border-border bg-popover p-3 shadow-lg ring-1 ring-foreground/5">
            <p className="text-[11px] font-bold text-muted-foreground">Table Columns</p>
            <p className="mb-2 text-[10px] text-muted-foreground/80">Show, hide, and reorder. Saved to this device.</p>
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                {order.map((key, idx) => {
                    const def = COLUMN_DEF_MAP[key];
                    if (!def) return null;
                    const isHidden = hidden.has(key);
                    return (
                        <div key={key} className={cn("flex items-center gap-2 rounded-md px-1 py-1", !isHidden && "bg-muted/40")}>
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                                <Checkbox checked={!isHidden} onCheckedChange={() => onToggle(key)} />
                                <span className={cn("text-xs font-semibold", isHidden ? "text-muted-foreground" : "text-foreground")}>{def.label}</span>
                            </label>
                            <div className="flex gap-0.5">
                                <button onClick={() => onMove(idx, -1)} disabled={idx === 0} title="Move up" className={cn("p-0.5 text-muted-foreground", idx === 0 && "opacity-25")}>
                                    <ChevronUp className="size-3" />
                                </button>
                                <button onClick={() => onMove(idx, 1)} disabled={idx === order.length - 1} title="Move down" className={cn("p-0.5 text-muted-foreground", idx === order.length - 1 && "opacity-25")}>
                                    <ChevronDown className="size-3" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2.5 flex gap-1.5 border-t border-border pt-2.5">
                <Button size="sm" variant="secondary" className="flex-1" onClick={onShowAll}>Show All</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={onReset}>Reset Default</Button>
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
    openCustomerProfile,
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
    const SortArrow = ({ col }) => {
        if (sortCol !== col) return <ArrowUpDown className="inline size-3 opacity-30" />;
        return sortDir === "asc" ? <ArrowUp className="inline size-3" /> : <ArrowDown className="inline size-3" />;
    };

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
        client: b => (b.clientName || "").toLowerCase(),
        phone: b => b.phone || "",
        email: b => (b.email || "").toLowerCase(),
        address: b => formatAddress(b).toLowerCase(),
        service: b => (b.service || "").toLowerCase(),
        amount: b => parseFloat(b.price || b.totalAmount || 0),
        duration: b => parseFloat(b.duration || 0),
        schedule: b => `${b.date || ""} ${b.time || ""}`,
        staff: b => (b.assignedStaff || []).length,
        status: b => b.status || "",
        payment: b => b.paymentStatus || "",
        method: b => (b.paymentMethod || "").toLowerCase(),
        source: b => (b.leadSource || "").toLowerCase(),
        frequency: b => (b.frequency || "").toLowerCase(),
        notes: b => (b.specialNotes || b.notes || "").toLowerCase(),
        created: b => b.createdAt || "",
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
            "Booking #": b.bookingNumber || b.id || "",
            "Date": b.date || "",
            "Shift(s)": (b.shifts || []).join(", ") || b.time || "",
            "Client Name": b.clientName || `${b.firstName || ""} ${b.lastName || ""}`.trim(),
            "Phone": b.phone || "",
            "Email": b.email || "",
            "Address": [b.address1, b.address2, b.city, b.state, b.postalCode].filter(Boolean).join(", "),
            "Service": b.service || "",
            "Duration (hrs)": b.duration || "",
            "Frequency": b.frequency || "",
            "Status": b.status || "",
            "Payment Status": b.paymentStatus || "",
            "Payment Method": METHOD_LABELS[b.paymentMethod] || b.paymentMethod || "",
            "Lead Source": b.leadSource || "",
            "Subtotal": parseFloat(b.subtotal || b.price || 0).toFixed(2),
            "Tax": parseFloat(b.tax || 0).toFixed(2),
            "Total": parseFloat(b.price || b.subtotal || 0).toFixed(2),
            "Discount $": parseFloat(b.customDiscountAmount || 0).toFixed(2),
            "Promo Code": b.promoCode || "",
            "Assigned Staff": (b.assignedStaff || []).map(s => s.name || s).join(", "),
            "Notes": b.specialNotes || b.notes || "",
            "Created": b.createdAt ? formatZonedDateTime(new Date(b.createdAt), {}, tz) : "",
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
                return <span className="text-xs text-muted-foreground">{b.phone || "—"}</span>;
            case "email":
                return <span className="block max-w-50 truncate text-xs text-muted-foreground" title={b.email}>{b.email || "—"}</span>;
            case "address":
                return <div className="max-w-50 truncate text-xs text-muted-foreground" title={formatAddress(b)}>{formatAddress(b)}</div>;
            case "service":
                return <div className="text-xs font-semibold text-foreground">{b.service}</div>;
            case "amount":
                return <div className="text-xs font-extrabold text-cyan-600">${parseFloat(b.price || b.totalAmount || 0).toFixed(2)}</div>;
            case "duration":
                return <span className="text-xs text-muted-foreground">{b.duration ? `${b.duration} hr${b.duration === 1 ? "" : "s"}` : "—"}</span>;
            case "schedule":
                return (
                    <div className="relative">
                        {isEditing(b.id, "schedule") && (
                            <SchedulePopover booking={b} onSave={f => quickUpdate(b.id, f)} onClose={stopEditing} />
                        )}
                        <div onClick={() => startEditing(b.id, "schedule")} className="cursor-pointer" title="Click to reschedule">
                            <div className="text-xs font-bold text-foreground">{b.date || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">{formatTimeWindow(b.time, b.duration)}</div>
                        </div>
                    </div>
                );
            case "staff": {
                const enrichedStaff = (b.assignedStaff || []).map(m => ({ ...m, photoURL: m.photoURL || staffPhotoMap[m.uid] || "" }));
                return (
                    <div className="relative">
                        {isEditing(b.id, "staff") && (
                            <StaffPopover booking={b} fieldStaff={fieldStaff} onSave={f => quickUpdate(b.id, f)} onClose={stopEditing} />
                        )}
                        <div onClick={() => startEditing(b.id, "staff")} className="cursor-pointer" title="Click to assign staff">
                            {enrichedStaff.length > 0 ? (
                                <div className="flex">
                                    {enrichedStaff.slice(0, 4).map((m, i) => (
                                        <div key={m.uid || i} style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 10 - i }}>
                                            <StaffAvatar member={m} size={28} />
                                        </div>
                                    ))}
                                    {enrichedStaff.length > 4 && (
                                        <div className="-ml-1.75 flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-extrabold text-muted-foreground">
                                            +{enrichedStaff.length - 4}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="text-[11px] italic text-muted-foreground/60">Unassigned</span>
                            )}
                        </div>
                    </div>
                );
            }
            case "status":
                return (
                    <div className="relative">
                        {isEditing(b.id, "status") ? (
                            <select autoFocus defaultValue={b.status}
                                onChange={async e => { await quickUpdate(b.id, { status: e.target.value }); }}
                                onBlur={stopEditing}
                                className="w-full cursor-pointer rounded-md border-2 border-primary px-1.5 py-1 text-xs">
                                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "status")} className="cursor-pointer">
                                <StatusBadge status={b.status} />
                            </div>
                        )}
                    </div>
                );
            case "payment":
                return (
                    <div className="relative">
                        {isEditing(b.id, "payment") ? (
                            <select autoFocus defaultValue={b.paymentStatus || "unpaid"}
                                onChange={async e => {
                                    const nextStatus = e.target.value;
                                    if (nextStatus === "partial") {
                                        const price = parseFloat(b.price || 0);
                                        const entered = window.prompt(`Amount received so far (of $${price.toFixed(2)}):`, b.amountReceived || "");
                                        if (entered === null) { stopEditing(); return; }
                                        const amount = Math.max(0, Math.min(price, parseFloat(entered) || 0));
                                        await quickUpdate(b.id, { paymentStatus: nextStatus, amountReceived: amount });
                                    } else {
                                        await quickUpdate(b.id, { paymentStatus: nextStatus });
                                    }
                                }}
                                onBlur={stopEditing}
                                className="w-full cursor-pointer rounded-md border-2 border-emerald-400 px-1.5 py-1 text-xs">
                                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "payment")} className="cursor-pointer">
                                <PaymentBadge status={b.paymentStatus} />
                                {b.paymentStatus === "partial" && (
                                    <div className="mt-0.5 text-[9px] text-muted-foreground">${parseFloat(b.amountReceived || 0).toFixed(2)} of ${parseFloat(b.price || 0).toFixed(2)}</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case "method":
                return (
                    <div className="relative">
                        {isEditing(b.id, "method") ? (
                            <select autoFocus defaultValue={b.paymentMethod || ""}
                                onChange={async e => { await quickUpdate(b.id, { paymentMethod: e.target.value }); }}
                                onBlur={stopEditing}
                                className="w-full cursor-pointer rounded-md border-2 border-primary px-1.5 py-1 text-xs">
                                {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "method")} className="cursor-pointer">
                                {b.paymentMethod ? (
                                    <span className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                                        {METHOD_OPTIONS.find(o => o.value === b.paymentMethod)?.label || b.paymentMethod}
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-muted-foreground/50">— set</span>
                                )}
                            </div>
                        )}
                    </div>
                );
            case "source":
                return (
                    <div className="relative">
                        {isEditing(b.id, "source") ? (
                            <select autoFocus defaultValue={b.leadSource || ""}
                                onChange={async e => { await quickUpdate(b.id, { leadSource: e.target.value }); }}
                                onBlur={stopEditing}
                                className="w-full cursor-pointer rounded-md border-2 border-primary px-1.5 py-1 text-xs">
                                <option value="">— None —</option>
                                {leadSources.map(src => <option key={src} value={src}>{src}</option>)}
                            </select>
                        ) : (
                            <div onClick={() => startEditing(b.id, "source")} className="cursor-pointer">
                                {b.leadSource ? (
                                    <Badge variant="secondary" className="whitespace-nowrap text-[11px]">{b.leadSource}</Badge>
                                ) : (
                                    <span className="text-[11px] text-muted-foreground/50">— set</span>
                                )}
                            </div>
                        )}
                    </div>
                );
            case "frequency":
                return <span className="text-xs text-muted-foreground">{b.isRecurring ? (b.frequency || "Recurring") : "One-time"}</span>;
            case "notes":
                return <div className="max-w-50 truncate text-xs text-muted-foreground" title={b.specialNotes || b.notes || ""}>{b.specialNotes || b.notes || "—"}</div>;
            case "created":
                return <span className="text-[11px] text-muted-foreground/70">{b.createdAt ? formatZonedDate(new Date(b.createdAt), {}, tz) : "—"}</span>;
            default:
                return null;
        }
    };

    return (
        <div className="animate-fade flex flex-col gap-3.5">
            {openNewBookingCommand && (
                <div className="flex justify-end">
                    <Button onClick={openNewBookingCommand}><Plus className="size-4" /> New Booking</Button>
                </div>
            )}

            <Card>
                <CardContent className="flex flex-col gap-2.5 p-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchVal} onChange={e => setSearchVal(e.target.value)}
                            placeholder="Search client name, address, email or phone…"
                            className="pl-8"
                        />
                        {searchVal && (
                            <button onClick={() => setSearchVal("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Select value={filterService || "all"} onValueChange={v => setFilterService(v === "all" ? "" : v)}>
                            <SelectTrigger className="flex-1 basis-40"><SelectValue placeholder="All Services" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Services</SelectItem>
                                {Object.keys(pricingRates.services).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
                            <SelectTrigger className="flex-1 basis-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filterPayment || "all"} onValueChange={v => setFilterPayment(v === "all" ? "" : v)}>
                            <SelectTrigger className="flex-1 basis-35"><SelectValue placeholder="All Payments" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                {PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={sortVal} onValueChange={setSortVal}>
                            <SelectTrigger className="flex-1 basis-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date-asc">↑ Date: Soonest First</SelectItem>
                                <SelectItem value="date-desc">↓ Date: Latest First</SelectItem>
                                <SelectItem value="name-asc">A–Z Client Name</SelectItem>
                                <SelectItem value="price-desc">$ Price: Highest First</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant={moreFiltersOpen ? "secondary" : "outline"} size="sm" onClick={() => setMoreFiltersOpen(v => !v)}>
                            {moreFiltersOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            More Filters {moreFilterCount > 0 ? `(${moreFilterCount})` : ""}
                        </Button>

                        {activeFilterCount > 0 && (
                            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:text-destructive" onClick={clearAllFilters}>
                                <X className="size-3.5" /> Clear filters ({activeFilterCount})
                            </Button>
                        )}
                    </div>

                    {moreFiltersOpen && (
                        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                            {teams && teams.length > 0 && (
                                <Select value={filterTeam || "all"} onValueChange={v => setFilterTeam(v === "all" ? "" : v)}>
                                    <SelectTrigger className="flex-1 basis-37"><SelectValue placeholder="All Teams" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Teams</SelectItem>
                                        {teams.map(t => <SelectItem key={t.id || t.name} value={t.name}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={filterStaff || "all"} onValueChange={v => setFilterStaff(v === "all" ? "" : v)}>
                                <SelectTrigger className="flex-1 basis-42"><SelectValue placeholder="All Staff" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Staff</SelectItem>
                                    {(fieldStaff || []).map(m => <SelectItem key={m.uid} value={m.uid}>{m.name || m.displayName || m.email}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterSource || "all"} onValueChange={v => setFilterSource(v === "all" ? "" : v)}>
                                <SelectTrigger className="flex-1 basis-37"><SelectValue placeholder="All Lead Sources" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Lead Sources</SelectItem>
                                    {leadSources.map(src => <SelectItem key={src} value={src}>{src}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterMethod || "all"} onValueChange={v => setFilterMethod(v === "all" ? "" : v)}>
                                <SelectTrigger className="flex-1 basis-37"><SelectValue placeholder="All Payment Methods" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Payment Methods</SelectItem>
                                    {METHOD_OPTIONS.filter(o => o.value).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex flex-1 basis-55 items-center gap-1">
                                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 flex-1 text-xs" />
                                <span className="text-[11px] text-muted-foreground">to</span>
                                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 flex-1 text-xs" />
                            </div>
                            <div className="flex flex-1 basis-45 items-center gap-1">
                                <Input type="number" min="0" value={amountMin} onChange={e => setAmountMin(e.target.value)} placeholder="Min $" className="h-8 flex-1 text-xs" />
                                <span className="text-[11px] text-muted-foreground">–</span>
                                <Input type="number" min="0" value={amountMax} onChange={e => setAmountMax(e.target.value)} placeholder="Max $" className="h-8 flex-1 text-xs" />
                            </div>
                            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                                <Checkbox checked={unassignedOnly} onCheckedChange={c => setUnassignedOnly(Boolean(c))} /> Unassigned only
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                                <Checkbox checked={recurringOnly} onCheckedChange={c => setRecurringOnly(Boolean(c))} /> Recurring only
                            </label>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5">
                    {[
                        { key: "", label: "All Dates" },
                        { key: "today", label: "Today" },
                        { key: "week", label: "This Week" },
                        { key: "month", label: "This Month" },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => { setDateFilter(opt.key); setDateFrom(""); setDateTo(""); }}
                            className={cn(
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                                (!dateFrom && !dateTo && dateFilter === opt.key) ? "border-cyan-600 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30" : "border-input bg-card text-muted-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2.5">
                    <span className="text-[11px] text-muted-foreground">
                        Showing <strong className="text-foreground">{visibleBookings.length}</strong> of <strong className="text-foreground">{(filteredBookings || []).length}</strong> bookings
                    </span>
                    <div className="relative">
                        <Button variant={columnManagerOpen ? "secondary" : "outline"} size="sm" onClick={() => setColumnManagerOpen(v => !v)} title="Show, hide, and reorder columns">
                            <Columns3 className="size-3.5" /> Columns
                        </Button>
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
                    <Button
                        variant="outline" size="sm"
                        className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                        onClick={exportToExcel}
                        disabled={visibleBookings.length === 0}
                        title="Export visible bookings to Excel"
                    >
                        <FileSpreadsheet className="size-3.5" /> Export Excel
                    </Button>
                </div>
            </div>

            {selectedIds.size > 0 && (
                <Card className="border-sky-300 bg-sky-50 dark:bg-sky-950/20">
                    <CardContent className="flex items-center gap-2.5 p-3">
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-400">{selectedIds.size} selected</span>
                        <Select value={bulkStatus} onValueChange={setBulkStatus}>
                            <SelectTrigger className="h-8 w-52 bg-card text-xs"><SelectValue placeholder="Change status to…" /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" disabled={!bulkStatus} onClick={applyBulkStatus}>Apply</Button>
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds(new Set())}>Clear</Button>
                    </CardContent>
                </Card>
            )}

            <Card className="p-0">
                {visibleBookings.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground">No scheduled cleanings match your filters.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-9">
                                    <Checkbox
                                        checked={selectedIds.size === visibleBookings.length && visibleBookings.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="min-w-40 cursor-pointer select-none" onClick={() => handleColSort("client")}>Client <SortArrow col="client" /></TableHead>
                                {visibleColumnDefs.map(col => (
                                    <TableHead key={col.key} className="cursor-pointer select-none" style={{ minWidth: col.minWidth }} onClick={() => handleColSort(col.key)}>
                                        {col.label} <SortArrow col={col.key} />
                                    </TableHead>
                                ))}
                                <TableHead className="min-w-25 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleBookings.map(b => {
                                const hasPendingEdit = editRequests.some(r => r.bookingId === b.id && r.status === "Pending");
                                const isSaving = saving === b.id;

                                return (
                                    <TableRow key={b.id} data-status={b.status} className={cn(isSaving && "opacity-50")}>
                                        <TableCell className="w-9">
                                            <Checkbox
                                                checked={selectedIds.has(b.id)}
                                                onCheckedChange={() => setSelectedIds(prev => {
                                                    const next = new Set(prev); next.has(b.id) ? next.delete(b.id) : next.add(b.id); return next;
                                                })}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            {openCustomerProfile ? (
                                                <button onClick={() => openCustomerProfile(b)} title="View customer profile" className="whitespace-nowrap text-xs font-bold text-primary hover:underline">
                                                    {b.clientName}
                                                </button>
                                            ) : (
                                                <div className="text-xs font-bold whitespace-nowrap text-foreground">{b.clientName}</div>
                                            )}
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{b.phone}</div>
                                            <div className="mt-1 flex gap-1">
                                                {(b.customerConfirmed && b.status === "Pending") && (
                                                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] text-emerald-700 dark:bg-emerald-950/30">
                                                        <CircleCheck className="size-2.5" /> Confirmed
                                                    </Badge>
                                                )}
                                                {hasPendingEdit && (
                                                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[9px] text-amber-700 dark:bg-amber-950/30">● Review</Badge>
                                                )}
                                            </div>
                                        </TableCell>

                                        {visibleColumnDefs.map(col => (
                                            <TableCell key={col.key} className="relative">{renderCell(col, b)}</TableCell>
                                        ))}

                                        <TableCell className="text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon-xs" onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }} title="Details"><Eye className="size-3.5" /></Button>
                                                <Button variant="ghost" size="icon-xs" onClick={() => openEditBookingModal(b)} title="Edit"><Pencil className="size-3.5" /></Button>
                                                {canManagePermissions && (
                                                    <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive" onClick={() => handleDeleteBooking(b.id)} title="Cancel"><Trash2 className="size-3.5" /></Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
