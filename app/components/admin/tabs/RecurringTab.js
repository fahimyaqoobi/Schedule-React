"use client";
import { useMemo, useState } from "react";

const FREQ_STYLES = {
    "Weekly":    { bg: "#ecfdf5", border: "#6ee7b7", text: "#047857", dot: "#10b981" },
    "Bi-Weekly": { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", dot: "#3b82f6" },
    "Monthly":   { bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9", dot: "#8b5cf6" },
};
const DEFAULT_FREQ_STYLE = { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", dot: "#94a3b8" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (str) => new Date(`${str}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); const dow = x.getDay(); x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1)); return x; };
const shortLabel = (d) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

function timeSortKey(timeStr = "") {
    const m = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 9999;
    let h = parseInt(m[1]);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + parseInt(m[2]);
}

function freqStyle(b) {
    return FREQ_STYLES[b.frequency] || DEFAULT_FREQ_STYLE;
}

export default function RecurringTab({
    bookings,
    Icons,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    branchTimezone,
}) {
    const [view, setView] = useState("week");
    const [anchor, setAnchor] = useState(() => new Date());

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: branchTimezone || "America/Toronto" });

    const recurringBookings = useMemo(() =>
        (bookings || []).filter(b => (b.isRecurring || b.recurringSeriesId) && b.status !== "Cancelled"),
        [bookings]
    );

    const byDate = useMemo(() => {
        const map = {};
        recurringBookings.forEach(b => {
            if (!b.date) return;
            (map[b.date] = map[b.date] || []).push(b);
        });
        Object.values(map).forEach(list => list.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time)));
        return map;
    }, [recurringBookings]);

    const seriesCount = useMemo(() => {
        const ids = new Set();
        recurringBookings.forEach(b => ids.add(b.recurringSeriesId || b.id));
        return ids.size;
    }, [recurringBookings]);

    const navigate = (dir) => {
        setAnchor(prev => {
            if (view === "day") return addDays(prev, dir);
            if (view === "week") return addDays(prev, dir * 7);
            const next = new Date(prev);
            next.setDate(1);
            next.setMonth(next.getMonth() + dir);
            return next;
        });
    };

    const openDetails = (b) => {
        setSelectedBooking(b);
        setDetailsModalOpen(true);
    };

    const rangeLabel = (() => {
        if (view === "day") return `${DAY_NAMES[(anchor.getDay() + 6) % 7]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
        if (view === "week") {
            const start = mondayOf(anchor);
            const end = addDays(start, 6);
            return `${shortLabel(start)} – ${shortLabel(end)}, ${end.getFullYear()}`;
        }
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    })();

    const BookingCard = ({ b, compact = false }) => {
        const st = freqStyle(b);
        return (
            <div
                onClick={() => openDetails(b)}
                style={{
                    background: st.bg, border: `1.5px solid ${st.border}`, borderLeft: `4px solid ${st.dot}`,
                    borderRadius: 10, padding: compact ? "6px 8px" : "10px 12px", cursor: "pointer", marginBottom: 6,
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: compact ? 11 : 12, fontWeight: 800, color: st.text }}>{b.time || "TBD"}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: st.text, background: "#ffffff", border: `1px solid ${st.border}`, borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        {b.frequency || "Recurring"}
                    </span>
                </div>
                <div style={{ fontSize: compact ? 11 : 13, fontWeight: 700, color: "#0f172a", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.clientName || `${b.firstName || ""} ${b.lastName || ""}`.trim() || "Client"}
                </div>
                {!compact && (
                    <>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.service || ""}</div>
                        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[b.address1, b.city].filter(Boolean).join(", ")}
                        </div>
                        {(b.assignedStaff || []).length > 0 && (
                            <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontWeight: 600 }}>
                                👤 {(b.assignedStaff || []).map(s => (s.name || "").split(" ")[0]).filter(Boolean).join(", ")}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // ── Week view ──
    const weekDays = (() => {
        const start = mondayOf(anchor);
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    })();

    // ── Month view grid ──
    const monthCells = (() => {
        const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
        const leading = (first.getDay() + 6) % 7; // Monday-start offset
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push(null);
        for (let day = 1; day <= daysInMonth; day++) {
            cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
        }
        return cells;
    })();

    const viewBtn = (id, label) => (
        <button key={id} onClick={() => setView(id)}
            style={{
                padding: "7px 16px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: view === id ? "#00426d" : "transparent",
                color: view === id ? "#ffffff" : "#475569",
            }}>
            {label}
        </button>
    );

    return (
        <div className="animate-fade">
            <div className="panel-card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #e2e8f0" }}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>🔁 Recurring Bookings</h4>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{seriesCount} active series · {recurringBookings.length} scheduled visits</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
                            {viewBtn("day", "Day")}
                            {viewBtn("week", "Week")}
                            {viewBtn("month", "Month")}
                        </div>
                        <button onClick={() => setAnchor(new Date())}
                            style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#ffffff", fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                            Today
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button onClick={() => navigate(-1)} className="action-btn">{Icons.ChevronLeft()}</button>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", minWidth: 170, textAlign: "center" }}>{rangeLabel}</span>
                            <button onClick={() => navigate(1)} className="action-btn">{Icons.ChevronRight()}</button>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 16, padding: "10px 18px", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                    {Object.entries(FREQ_STYLES).map(([freq, st]) => (
                        <span key={freq} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#475569" }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: st.dot, display: "inline-block" }} />
                            {freq}
                        </span>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: 16 }}>
                    {recurringBookings.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
                            <div style={{ fontSize: 34, marginBottom: 10 }}>🔁</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>No recurring bookings yet</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Turn on the “Recurring Booking” toggle on any booking or at checkout and it will appear here with its whole series.</div>
                        </div>
                    ) : view === "week" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, overflowX: "auto" }}>
                            {weekDays.map((d, i) => {
                                const dStr = toDateStr(d);
                                const isToday = dStr === todayStr;
                                const dayBookings = byDate[dStr] || [];
                                return (
                                    <div key={dStr} style={{ minWidth: 0 }}>
                                        <div style={{
                                            textAlign: "center", padding: "6px 4px", borderRadius: 10, marginBottom: 8,
                                            background: isToday ? "#00426d" : "#f8fafc",
                                            color: isToday ? "#ffffff" : "#334155",
                                        }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.75 }}>{DAY_NAMES[i]}</div>
                                            <div style={{ fontSize: 17, fontWeight: 800 }}>{d.getDate()}</div>
                                        </div>
                                        <div style={{ minHeight: 220 }}>
                                            {dayBookings.map(b => <BookingCard key={b.id} b={b} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : view === "day" ? (
                        <div style={{ maxWidth: 560, margin: "0 auto" }}>
                            {(byDate[toDateStr(anchor)] || []).length === 0 ? (
                                <div style={{ textAlign: "center", padding: "36px 16px", color: "#94a3b8", fontSize: 13 }}>
                                    No recurring visits scheduled for this day.
                                </div>
                            ) : (
                                (byDate[toDateStr(anchor)] || []).map(b => (
                                    <div key={b.id} style={{ position: "relative" }}>
                                        <BookingCard b={b} />
                                        <button onClick={(e) => { e.stopPropagation(); openEditBookingModal(b); }}
                                            style={{ position: "absolute", top: 10, right: 10, padding: "4px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", background: "#ffffff", fontSize: 11, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                                            Edit
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                                {DAY_NAMES.map(d => (
                                    <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{d}</div>
                                ))}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                                {monthCells.map((d, idx) => {
                                    if (!d) return <div key={`e-${idx}`} />;
                                    const dStr = toDateStr(d);
                                    const isToday = dStr === todayStr;
                                    const dayBookings = byDate[dStr] || [];
                                    return (
                                        <div key={dStr}
                                            onClick={() => { setAnchor(d); setView("day"); }}
                                            style={{
                                                minHeight: 84, border: `1.5px solid ${isToday ? "#00426d" : "#eef2f7"}`, borderRadius: 10,
                                                padding: "4px 6px", cursor: "pointer", background: isToday ? "#f0f7ff" : "#ffffff",
                                            }}>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: isToday ? "#00426d" : "#475569" }}>{d.getDate()}</div>
                                            {dayBookings.slice(0, 2).map(b => {
                                                const st = freqStyle(b);
                                                return (
                                                    <div key={b.id}
                                                        onClick={(e) => { e.stopPropagation(); openDetails(b); }}
                                                        style={{
                                                            fontSize: 9.5, fontWeight: 700, color: st.text, background: st.bg,
                                                            border: `1px solid ${st.border}`, borderRadius: 6, padding: "1px 5px",
                                                            marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                        }}>
                                                        {(b.clientName || "").split(" ")[0] || "Client"} · {b.time || ""}
                                                    </div>
                                                );
                                            })}
                                            {dayBookings.length > 2 && (
                                                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", marginTop: 2 }}>+{dayBookings.length - 2} more</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
