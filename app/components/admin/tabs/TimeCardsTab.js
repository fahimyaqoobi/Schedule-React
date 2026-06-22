"use client";
import { useState, useMemo } from "react";

function StatusBadge({ status }) {
    const MAP = {
        active:           { label: "Active",    bg: "#d1fae5", color: "#065f46", border: "#a7f3d0" },
        pending_approval: { label: "Pending",   bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
        approved:         { label: "Approved",  bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
        rejected:         { label: "Rejected",  bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
    };
    const c = MAP[status] || { label: status, bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
    return (
        <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}>
            {c.label}{status === "approved" && " 🔒"}
        </span>
    );
}

function fmtTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMin(mins) {
    if (!mins && mins !== 0) return "—";
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const S = {
    primaryBtn: { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    ghostBtn:   { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    dangerBtn:  { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "8px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
    label:      { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
    input:      { border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 10px", fontSize: "13px", color: "#0f172a", background: "#fff", width: "100%", boxSizing: "border-box" },
    card:       { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" },
    thCell:     { fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" },
};

const COLS_SUPER = "160px 80px 1fr 90px 90px 80px 120px 150px";
const COLS_ADMIN = "160px 80px 1fr 90px 90px 80px 120px 90px";

export default function TimeCardsTab({
    isSuperAdmin,
    timeEntries,
    timeEntrySaving,
    allFieldStaff,
    todayAllConfirmedJobs,
    adminClockForm, setAdminClockForm,
    activeTimeEntries,
    handleAdminClockInFor,
    handleAdminClockOutFor,
    handleReviewTimeEntry,
    handleEditTimeEntry,
    handleDeleteTimeEntry,
    handleCreateManualTimeEntry,
    manualTimeEntryForm, setManualTimeEntryForm,
    timeEntryEditDrafts, setTimeEntryEditDrafts,
    currentUser,
    syncDatabaseData,
    jobsFeedback,
}) {
    const [clockOutOverrides, setClockOutOverrides] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [filterStaff, setFilterStaff]       = useState("");
    const [filterStatus, setFilterStatus]     = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo]     = useState("");

    const COLS = isSuperAdmin ? COLS_SUPER : COLS_ADMIN;

    const stats = useMemo(() => ({
        active:   (activeTimeEntries || []).length,
        pending:  timeEntries.filter(e => e.status === "pending_approval").length,
        approved: timeEntries.filter(e => e.status === "approved").length,
        rejected: timeEntries.filter(e => e.status === "rejected").length,
    }), [timeEntries, activeTimeEntries]);

    const pendingEntries = useMemo(() =>
        timeEntries.filter(e => e.status === "pending_approval")
            .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)),
        [timeEntries]
    );

    const allCards = useMemo(() => {
        let list = timeEntries.filter(e => e.status !== "active" && e.status !== "pending_approval");
        if (filterStaff)    list = list.filter(e => e.cleanerUid === filterStaff);
        if (filterStatus)   list = list.filter(e => e.status === filterStatus);
        if (filterDateFrom) list = list.filter(e => (e.startedAt || "").slice(0, 10) >= filterDateFrom);
        if (filterDateTo)   list = list.filter(e => (e.startedAt || "").slice(0, 10) <= filterDateTo);
        return list.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)).slice(0, 300);
    }, [timeEntries, filterStaff, filterStatus, filterDateFrom, filterDateTo]);

    const hasFilters = filterStaff || filterStatus || filterDateFrom || filterDateTo;

    const toggleEdit = id => setExpandedId(p => p === id ? null : id);

    function TableHead() {
        return (
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "12px", padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Staff", "Date", "Job / Project", "In", "Out", "Duration", "Status", "Actions"].map(h => (
                    <span key={h} style={S.thCell}>{h}</span>
                ))}
            </div>
        );
    }

    return (
        <div className="animate-fade" style={{ padding: "24px 32px", maxWidth: "1440px", margin: "0 auto" }}>

            {/* ── PAGE HEADER ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                    <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Time Cards</h3>
                    <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>Proof of work per job. No pay rates shown here — that&apos;s in Payroll.</p>
                </div>
                <button onClick={() => syncDatabaseData(currentUser)} style={S.ghostBtn}>Refresh</button>
            </div>

            {/* ── STAT CHIPS ── */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
                {[
                    { label: "Active",   count: stats.active,   dot: "#10b981", bg: "#d1fae5" },
                    { label: "Pending",  count: stats.pending,  dot: "#f59e0b", bg: "#fef3c7" },
                    { label: "Approved", count: stats.approved, dot: "#3b82f6", bg: "#dbeafe" },
                    { label: "Rejected", count: stats.rejected, dot: "#ef4444", bg: "#fee2e2" },
                ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: "12px", padding: "7px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ width: "7px", height: "7px", background: s.dot, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{s.count}</span>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>{s.label}</span>
                    </div>
                ))}
            </div>

            {jobsFeedback && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 16px", marginBottom: "16px", fontSize: "13px", color: "#166534" }}>
                    {jobsFeedback}
                </div>
            )}

            {/* ── LIVE STAFF STATUS ── */}
            <section style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.07em" }}>Live Staff Status</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{stats.active} active shift{stats.active !== 1 ? "s" : ""}</span>
                </div>
                <div style={S.card}>
                    {(activeTimeEntries || []).length > 0 && (
                        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", borderBottom: "1px solid #f1f5f9" }}>
                            {(activeTimeEntries || []).map(entry => (
                                <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", padding: "14px 16px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#065f46" }}>
                                            <span style={{ color: "#10b981", marginRight: "6px" }}>●</span>
                                            {entry.cleanerName}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#047857", marginTop: "2px" }}>{entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}</div>
                                        <div style={{ fontSize: "11px", color: "#6ee7b7", marginTop: "2px" }}>
                                            Clocked in {fmtTime(entry.startedAt)}{entry.source?.includes("admin_override") ? " · entered by admin" : ""}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                                        <button
                                            onClick={() => handleAdminClockOutFor({ entryId: entry.id, endedAt: clockOutOverrides[entry.id] || undefined })}
                                            disabled={timeEntrySaving}
                                            style={S.dangerBtn}
                                        >
                                            Force Clock Out
                                        </button>
                                        <label style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span>Override end time:</span>
                                            <input
                                                type="datetime-local"
                                                value={clockOutOverrides[entry.id] || ""}
                                                onChange={e => setClockOutOverrides(p => ({ ...p, [entry.id]: e.target.value }))}
                                                style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "3px 8px", fontSize: "11px" }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Admin clock-in form */}
                    <div style={{ padding: "16px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", marginBottom: "12px" }}>
                            Clock In for a Staff Member
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px auto", gap: "12px", alignItems: "end" }}>
                            <label style={S.label}>
                                <span>Staff Member</span>
                                <select value={adminClockForm?.cleanerUid || ""} onChange={e => setAdminClockForm(p => ({ ...p, cleanerUid: e.target.value }))} style={S.input}>
                                    <option value="">Select staff…</option>
                                    {(allFieldStaff || []).map(m => <option key={m.uid} value={m.uid}>{m.name || m.email}</option>)}
                                </select>
                            </label>
                            <label style={S.label}>
                                <span>Today&apos;s Job</span>
                                <select value={adminClockForm?.bookingId || ""} onChange={e => setAdminClockForm(p => ({ ...p, bookingId: e.target.value }))} style={S.input}>
                                    <option value="">Select job…</option>
                                    {(todayAllConfirmedJobs || []).map(j => (
                                        <option key={j.id} value={j.id}>
                                            {j.service} — {j.firstName || j.clientName?.split(" ")[0] || "Client"}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label style={S.label}>
                                <span>Start Time (opt.)</span>
                                <input
                                    type="datetime-local"
                                    value={adminClockForm?.startedAt || ""}
                                    onChange={e => setAdminClockForm(p => ({ ...p, startedAt: e.target.value }))}
                                    style={S.input}
                                />
                            </label>
                            <button
                                onClick={() => handleAdminClockInFor(adminClockForm || {})}
                                disabled={timeEntrySaving || !adminClockForm?.cleanerUid || !adminClockForm?.bookingId}
                                style={{ ...S.primaryBtn, alignSelf: "flex-end" }}
                            >
                                Clock In
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── PENDING APPROVALS ── */}
            {pendingEntries.length > 0 && (
                <section style={{ marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pending Approval</span>
                        <span style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: "20px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                            {pendingEntries.length} waiting
                        </span>
                    </div>
                    <div style={S.card}>
                        <TableHead />
                        {pendingEntries.map((entry, i) => {
                            const isOpen = expandedId === `p-${entry.id}`;
                            const draft = timeEntryEditDrafts[entry.id] || {};
                            return (
                                <div key={entry.id} style={{ borderBottom: i < pendingEntries.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "12px", padding: "13px 20px", alignItems: "center", background: "#fffbeb" }}>
                                        <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{entry.cleanerName}</span>
                                        <span style={{ fontSize: "12px", color: "#64748b" }}>{fmtDate(entry.startedAt)}</span>
                                        <span style={{ fontSize: "12px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${entry.serviceName}${entry.locationLabel ? " · " + entry.locationLabel : ""}`}>
                                            {entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}
                                        </span>
                                        <span style={{ fontSize: "12px", color: "#475569" }}>{fmtTime(entry.startedAt)}</span>
                                        <span style={{ fontSize: "12px", color: "#475569" }}>{fmtTime(entry.endedAt)}</span>
                                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{fmtMin(entry.durationMinutes)}</span>
                                        <StatusBadge status={entry.status} />
                                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                                            <button onClick={() => handleReviewTimeEntry(entry.id, "approve")} disabled={timeEntrySaving} style={{ ...S.primaryBtn, padding: "5px 12px", fontSize: "11px" }}>Approve</button>
                                            <button onClick={() => handleReviewTimeEntry(entry.id, "reject")} disabled={timeEntrySaving} style={{ ...S.dangerBtn, padding: "5px 10px", fontSize: "11px" }}>Reject</button>
                                            <button onClick={() => toggleEdit(`p-${entry.id}`)} style={{ ...S.ghostBtn, padding: "5px 10px", fontSize: "11px" }}>{isOpen ? "▲" : "Edit ▼"}</button>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div style={{ padding: "14px 20px 16px", background: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: "12px" }}>
                                                <label style={S.label}>
                                                    <span>Adjust Start Time</span>
                                                    <input type="datetime-local" style={S.input}
                                                        value={draft.startedAt || (entry.startedAt ? new Date(entry.startedAt).toISOString().slice(0, 16) : "")}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), startedAt: e.target.value } }))}
                                                    />
                                                </label>
                                                <label style={S.label}>
                                                    <span>Adjust End Time</span>
                                                    <input type="datetime-local" style={S.input}
                                                        value={draft.endedAt || (entry.endedAt ? new Date(entry.endedAt).toISOString().slice(0, 16) : "")}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), endedAt: e.target.value } }))}
                                                    />
                                                </label>
                                                <label style={S.label}>
                                                    <span>Unpaid Break (min)</span>
                                                    <input type="number" min="0" style={S.input}
                                                        value={draft.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), unpaidBreakMinutes: parseInt(e.target.value || "0", 10) } }))}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── ALL TIME CARDS ── */}
            <section style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.07em" }}>All Time Cards</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{allCards.length} records</span>
                </div>

                {/* Filter bar */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
                    <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} style={{ ...S.input, width: "180px" }}>
                        <option value="">All Staff</option>
                        {(allFieldStaff || []).map(m => <option key={m.uid} value={m.uid}>{m.name || m.email}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.input, width: "150px" }}>
                        <option value="">All Statuses</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...S.input, width: "150px" }} />
                    <input type="date" value={filterDateTo}   onChange={e => setFilterDateTo(e.target.value)}   style={{ ...S.input, width: "150px" }} />
                    {hasFilters && (
                        <button onClick={() => { setFilterStaff(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); }} style={S.ghostBtn}>
                            Clear filters
                        </button>
                    )}
                </div>

                <div style={S.card}>
                    <TableHead />
                    {allCards.length === 0 ? (
                        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                            {hasFilters ? "No time cards match the current filters." : "No completed time cards yet."}
                        </div>
                    ) : allCards.map((entry, i) => {
                        const editKey = `e-${entry.id}`;
                        const isOpen  = expandedId === editKey;
                        const draft   = timeEntryEditDrafts[entry.id] || {};
                        return (
                            <div key={entry.id} style={{ borderBottom: i < allCards.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "12px", padding: "12px 20px", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>{entry.cleanerName}</span>
                                    <span style={{ fontSize: "12px", color: "#64748b" }}>{fmtDate(entry.startedAt)}</span>
                                    <span style={{ fontSize: "12px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${entry.serviceName}${entry.locationLabel ? " · " + entry.locationLabel : ""}`}>
                                        {entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}
                                    </span>
                                    <span style={{ fontSize: "12px", color: "#475569" }}>{fmtTime(entry.startedAt)}</span>
                                    <span style={{ fontSize: "12px", color: "#475569" }}>{fmtTime(entry.endedAt)}</span>
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{fmtMin(entry.durationMinutes)}</span>
                                    <StatusBadge status={entry.status} />
                                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                                        {isSuperAdmin && (
                                            <>
                                                <button onClick={() => toggleEdit(editKey)} style={{ ...S.ghostBtn, padding: "4px 10px", fontSize: "11px" }}>
                                                    {isOpen ? "Close" : "Edit"}
                                                </button>
                                                <button onClick={() => handleDeleteTimeEntry(entry.id)} disabled={timeEntrySaving} style={{ ...S.dangerBtn, padding: "4px 10px", fontSize: "11px" }}>
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isOpen && isSuperAdmin && (
                                    <div style={{ padding: "14px 20px 16px", background: "#fffbeb", borderTop: "1px solid #f1f5f9" }}>
                                        <div style={{ fontSize: "11px", color: "#d97706", fontWeight: 600, marginBottom: "10px" }}>
                                            ⚠ Super admin edit — changes apply immediately to this entry.
                                        </div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: "12px" }}>
                                            <label style={S.label}>
                                                <span>Start Time</span>
                                                <input type="datetime-local" style={S.input}
                                                    value={draft.startedAt || (entry.startedAt ? new Date(entry.startedAt).toISOString().slice(0, 16) : "")}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), startedAt: e.target.value } }))}
                                                />
                                            </label>
                                            <label style={S.label}>
                                                <span>End Time</span>
                                                <input type="datetime-local" style={S.input}
                                                    value={draft.endedAt || (entry.endedAt ? new Date(entry.endedAt).toISOString().slice(0, 16) : "")}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), endedAt: e.target.value } }))}
                                                />
                                            </label>
                                            <label style={S.label}>
                                                <span>Break (min)</span>
                                                <input type="number" min="0" style={S.input}
                                                    value={draft.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), unpaidBreakMinutes: parseInt(e.target.value || "0", 10) } }))}
                                                />
                                            </label>
                                            <div style={{ alignSelf: "flex-end" }}>
                                                <button
                                                    onClick={() => handleEditTimeEntry(entry.id, { startedAt: draft.startedAt, endedAt: draft.endedAt, unpaidBreakMinutes: draft.unpaidBreakMinutes })}
                                                    disabled={timeEntrySaving}
                                                    style={S.primaryBtn}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── MANUAL ENTRY ── */}
            <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.07em" }}>Add Manual Entry</span>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Employees & subcontractors</span>
                </div>
                <div style={{ ...S.card, padding: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 120px auto", gap: "12px", alignItems: "end" }}>
                        <label style={S.label}>
                            <span>Staff Member</span>
                            <select value={manualTimeEntryForm.cleanerUid} onChange={e => setManualTimeEntryForm(p => ({ ...p, cleanerUid: e.target.value }))} style={S.input}>
                                <option value="">Select staff</option>
                                {(allFieldStaff || []).map(m => <option key={m.uid} value={m.uid}>{m.name || m.email}</option>)}
                            </select>
                        </label>
                        <label style={S.label}>
                            <span>Start Time</span>
                            <input type="datetime-local" value={manualTimeEntryForm.startedAt} onChange={e => setManualTimeEntryForm(p => ({ ...p, startedAt: e.target.value }))} style={S.input} />
                        </label>
                        <label style={S.label}>
                            <span>End Time</span>
                            <input type="datetime-local" value={manualTimeEntryForm.endedAt} onChange={e => setManualTimeEntryForm(p => ({ ...p, endedAt: e.target.value }))} style={S.input} />
                        </label>
                        <label style={S.label}>
                            <span>Booking ID (opt.)</span>
                            <input value={manualTimeEntryForm.bookingId} onChange={e => setManualTimeEntryForm(p => ({ ...p, bookingId: e.target.value }))} placeholder="Optional" style={S.input} />
                        </label>
                        <label style={S.label}>
                            <span>Break (min)</span>
                            <input type="number" min="0" value={manualTimeEntryForm.unpaidBreakMinutes} onChange={e => setManualTimeEntryForm(p => ({ ...p, unpaidBreakMinutes: parseInt(e.target.value || "0", 10) }))} style={S.input} />
                        </label>
                        <button onClick={handleCreateManualTimeEntry} disabled={timeEntrySaving} style={{ ...S.primaryBtn, alignSelf: "flex-end" }}>
                            Add Hours
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
