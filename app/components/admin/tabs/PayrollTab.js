"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { calculatePayrollBreakdown } from "../../../../lib/payroll";

const ANCHOR = "2026-06-14T23:59:59-04:00";
const MS_DAY  = 86400000;
const PERIOD_MS = 14 * MS_DAY;

function getPayPeriod(offset = 0) {
    const now = new Date();
    let cutoff = new Date(ANCHOR);
    while (cutoff < now) cutoff = new Date(cutoff.getTime() + PERIOD_MS);
    cutoff = new Date(cutoff.getTime() + offset * PERIOD_MS);
    const periodStart = new Date(cutoff.getTime() - 13 * MS_DAY);
    periodStart.setHours(0, 0, 0, 0);
    const payDate = new Date(cutoff.getTime() + 5 * MS_DAY);
    payDate.setHours(0, 0, 0, 0);
    const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
        periodStart,
        cutoffDate: cutoff,
        payDate,
        key: periodStart.toISOString().split("T")[0],
        label: `${fmt(periodStart)} – ${fmt(cutoff)}`,
        payDateFull: payDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
}

function fmtMin(mins) {
    if (!mins) return "0h";
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const S = {
    primaryBtn: { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    ghostBtn:   { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    undoBtn:    { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    navBtn:     { width: "34px", height: "34px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer", fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
    statCard:   { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 18px" },
};

const STATUS_STYLE = {
    pending:    { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "Pending" },
    processing: { bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe", label: "Processing" },
    paid:       { bg: "#d1fae5", color: "#065f46", border: "#a7f3d0", label: "Paid ✓" },
};

const COLS = "1fr 90px 90px 80px 110px 110px";

export default function PayrollTab({
    timeEntries,
    allFieldStaff,
    isSuperAdmin,
    getAuthHeaders,
    currentUser,
    syncDatabaseData,
}) {
    const [periodOffset, setPeriodOffset] = useState(0);
    const [expanded, setExpanded]         = useState(new Set());
    const [statusMap, setStatusMap]       = useState({});
    const [saving, setSaving]             = useState(false);
    const [feedback, setFeedback]         = useState("");

    const period = useMemo(() => getPayPeriod(periodOffset), [periodOffset]);

    // Approximate how many periods back we are — used to flag old data
    const periodsBack = Math.abs(Math.min(0, periodOffset));
    const isVeryOld   = periodsBack > 13; // > ~6 months

    // Fetch payroll status records whenever period changes
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/payroll-periods?periodKey=${encodeURIComponent(period.key)}`, { headers });
                if (!res.ok || cancelled) return;
                const records = await res.json();
                if (cancelled) return;
                const map = {};
                records.forEach(r => { map[r.cleanerUid] = r; });
                setStatusMap(map);
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
    }, [period.key, getAuthHeaders]);

    // Aggregate approved entries for this period by person
    const rows = useMemo(() => {
        const startMs = period.periodStart.getTime();
        const endMs   = period.cutoffDate.getTime();

        const inPeriod = timeEntries.filter(e => {
            if (e.status !== "approved") return false;
            const d = new Date(e.startedAt || e.bookingDate || 0).getTime();
            return d >= startMs && d <= endMs;
        });

        const byPerson = {};
        inPeriod.forEach(e => {
            const uid = e.cleanerUid;
            if (!byPerson[uid]) {
                byPerson[uid] = {
                    uid,
                    name: e.cleanerName || "Unknown",
                    payRate: Number(e.payRate || 20),
                    overtimeRate: Number(e.overtimeRate || 30),
                    overtimeAfterHours: Number(e.overtimeAfterHours || 44),
                    totalMinutes: 0,
                    byDate: {},
                };
            }
            byPerson[uid].totalMinutes += Number(e.durationMinutes || 0);
            const date = (e.startedAt || e.bookingDate || "").slice(0, 10);
            if (date) byPerson[uid].byDate[date] = (byPerson[uid].byDate[date] || 0) + Number(e.durationMinutes || 0);
        });

        return Object.values(byPerson).map(p => {
            const breakdown = calculatePayrollBreakdown(p.totalMinutes, {
                hourlyRate: p.payRate,
                overtimeRate: p.overtimeRate,
                overtimeAfterHours: p.overtimeAfterHours,
            });
            const sortedDays = Object.entries(p.byDate).sort(([a], [b]) => a.localeCompare(b));
            return { ...p, breakdown, sortedDays, record: statusMap[p.uid] || null };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [timeEntries, period, statusMap]);

    const totals = useMemo(() => ({
        headcount:    rows.length,
        totalMinutes: rows.reduce((s, r) => s + r.totalMinutes, 0),
        totalGross:   rows.reduce((s, r) => s + r.breakdown.grossPay, 0),
    }), [rows]);

    const handleMarkStatus = useCallback(async (uid, name, status) => {
        setSaving(true);
        setFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/payroll-periods", {
                method: "POST",
                headers,
                body: JSON.stringify({ cleanerUid: uid, cleanerName: name, periodKey: period.key, periodLabel: period.label, status }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed to update."); }
            const d = await res.json();
            setStatusMap(prev => ({ ...prev, [uid]: d.record }));
            setFeedback(`${name} marked as ${status}.`);
        } catch (err) {
            setFeedback(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }, [getAuthHeaders, period]);

    const handleExportCsv = useCallback(() => {
        const lines = [
            ["Staff", "Regular Hours", "OT Hours", "Rate ($/hr)", "Gross Pay", "Status"].join(","),
            ...rows.map(r => [
                `"${r.name}"`,
                r.breakdown.regularHours.toFixed(2),
                r.breakdown.overtimeHours.toFixed(2),
                r.payRate.toFixed(2),
                r.breakdown.grossPay.toFixed(2),
                r.record?.status || "pending",
            ].join(",")),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `payroll-${period.key}.csv`;
        a.click();
    }, [rows, period]);

    const toggleExpand = uid => setExpanded(prev => {
        const next = new Set(prev);
        next.has(uid) ? next.delete(uid) : next.add(uid);
        return next;
    });

    return (
        <div className="animate-fade" style={{ padding: "24px 32px", maxWidth: "1440px", margin: "0 auto" }}>

            {/* ── HEADER ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Payroll</h3>
                    <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>Per-person biweekly compensation — hours pulled from approved time cards.</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button onClick={handleExportCsv} style={{ ...S.ghostBtn, display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                    </button>
                    <button onClick={() => syncDatabaseData(currentUser)} style={S.ghostBtn}>Refresh</button>
                </div>
            </div>

            {/* ── PERIOD NAVIGATOR ── */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px 20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button onClick={() => setPeriodOffset(p => p - 1)} style={S.navBtn} title="Previous period">←</button>
                        <div style={{ textAlign: "center", minWidth: "200px" }}>
                            <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>{period.label}</div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Pay date: {period.payDateFull}</div>
                        </div>
                        <button
                            onClick={() => setPeriodOffset(p => Math.min(0, p + 1))}
                            disabled={periodOffset >= 0}
                            style={{ ...S.navBtn, opacity: periodOffset >= 0 ? 0.3 : 1, cursor: periodOffset >= 0 ? "not-allowed" : "pointer" }}
                            title="Next period"
                        >→</button>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {[
                            { label: "Current",  offset: 0 },
                            { label: "−3 months", offset: -6 },
                            { label: "−6 months", offset: -13 },
                        ].map(q => (
                            <button
                                key={q.label}
                                onClick={() => setPeriodOffset(q.offset)}
                                style={{ background: periodOffset === q.offset ? "#0ea5e9" : "#f1f5f9", color: periodOffset === q.offset ? "#fff" : "#475569", border: "none", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                            >
                                {q.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── SUMMARY STATS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
                {[
                    { label: "Total Payroll",  value: `$${totals.totalGross.toFixed(2)}` },
                    { label: "Hours Tracked",  value: fmtMin(totals.totalMinutes) },
                    { label: "Staff Count",    value: `${totals.headcount} people` },
                    { label: "Pay Date",       value: period.payDateFull },
                ].map(s => (
                    <div key={s.label} style={S.statCard}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                        <div style={{ fontSize: "19px", fontWeight: 700, color: "#0f172a", marginTop: "5px" }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {isVeryOld && (
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#92400e" }}>
                    This period is older than 6 months. Use Export CSV above for archival records.
                </div>
            )}

            {feedback && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: "#166534" }}>
                    {feedback}
                </div>
            )}

            {/* ── PAYROLL TABLE ── */}
            {rows.length === 0 ? (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "56px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                    No approved time entries for this period.
                </div>
            ) : (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "16px", padding: "11px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        <span>Staff</span>
                        <span style={{ textAlign: "right" }}>Reg Hrs</span>
                        <span style={{ textAlign: "right" }}>OT Hrs</span>
                        <span style={{ textAlign: "right" }}>Rate</span>
                        <span style={{ textAlign: "right" }}>Gross Pay</span>
                        <span style={{ textAlign: "center" }}>Status / Actions</span>
                    </div>

                    {rows.map((row, i) => {
                        const isExp    = expanded.has(row.uid);
                        const statusKey = row.record?.status || "pending";
                        const sc        = STATUS_STYLE[statusKey] || STATUS_STYLE.pending;

                        return (
                            <div key={row.uid} style={{ borderBottom: i < rows.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                                {/* Row */}
                                <div
                                    style={{ display: "grid", gridTemplateColumns: COLS, gap: "16px", padding: "15px 20px", alignItems: "center", cursor: "pointer", transition: "background 0.1s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                                    onMouseLeave={e => e.currentTarget.style.background = ""}
                                    onClick={() => toggleExpand(row.uid)}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ color: "#94a3b8", fontSize: "11px", transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", minWidth: "10px" }}>▶</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>{row.name}</div>
                                            <div style={{ fontSize: "11px", color: "#64748b" }}>{fmtMin(row.totalMinutes)} total</div>
                                        </div>
                                    </div>
                                    <span style={{ textAlign: "right", fontWeight: 600, fontSize: "14px", color: "#0f172a" }}>{row.breakdown.regularHours.toFixed(1)}h</span>
                                    <span style={{ textAlign: "right", fontWeight: 600, fontSize: "14px", color: row.breakdown.overtimeHours > 0 ? "#d97706" : "#0f172a" }}>
                                        {row.breakdown.overtimeHours.toFixed(1)}h
                                    </span>
                                    <span style={{ textAlign: "right", fontSize: "13px", color: "#64748b" }}>${row.payRate.toFixed(2)}/h</span>
                                    <span style={{ textAlign: "right", fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>${row.breakdown.grossPay.toFixed(2)}</span>

                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }} onClick={e => e.stopPropagation()}>
                                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: "20px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                                            {sc.label}
                                        </span>
                                        {statusKey !== "paid" && (
                                            <button onClick={() => handleMarkStatus(row.uid, row.name, "paid")} disabled={saving} style={S.primaryBtn}>
                                                Mark Paid
                                            </button>
                                        )}
                                        {statusKey === "paid" && (
                                            <button onClick={() => handleMarkStatus(row.uid, row.name, "pending")} disabled={saving} style={S.undoBtn}>
                                                Undo
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Daily breakdown drawer */}
                                {isExp && (
                                    <div style={{ padding: "0 20px 18px 48px", background: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", paddingTop: "14px", marginBottom: "10px" }}>
                                            Daily breakdown
                                        </div>
                                        {row.sortedDays.length === 0 ? (
                                            <div style={{ color: "#94a3b8", fontSize: "12px" }}>No entries.</div>
                                        ) : row.sortedDays.map(([date, mins]) => (
                                            <div key={date} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                                                <span style={{ color: "#475569" }}>
                                                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                                </span>
                                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{fmtMin(mins)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", paddingTop: "10px", borderTop: "2px solid #e2e8f0", fontSize: "13px", fontWeight: 700 }}>
                                            <span style={{ color: "#0f172a" }}>
                                                {row.breakdown.regularHours.toFixed(1)}h regular
                                                {row.breakdown.overtimeHours > 0 && ` + ${row.breakdown.overtimeHours.toFixed(1)}h overtime`}
                                            </span>
                                            <span style={{ color: "#0f172a" }}>${row.breakdown.grossPay.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Footer totals */}
                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "16px", padding: "14px 20px", background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>TOTAL — {totals.headcount} staff</span>
                        <span />
                        <span />
                        <span />
                        <span style={{ textAlign: "right", fontWeight: 700, fontSize: "16px", color: "#0ea5e9" }}>${totals.totalGross.toFixed(2)}</span>
                        <span />
                    </div>
                </div>
            )}
        </div>
    );
}
