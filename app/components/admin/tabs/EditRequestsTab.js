"use client";
import { useMemo, useState } from "react";

// Human-relevant booking fields to diff between originalData and requestedData.
const DIFF_FIELDS = [
    ["clientName", "Client"],
    ["service", "Service"],
    ["date", "Service Date"],
    ["time", "Arrival"],
    ["duration", "Hours", (v) => `${v}h`],
    ["price", "Total", (v) => `$${parseFloat(v || 0).toFixed(2)}`],
    ["status", "Status"],
    ["paymentStatus", "Payment"],
    ["paymentMethod", "Pay Method"],
    ["address1", "Address"],
    ["city", "City"],
    ["postalCode", "Postal Code"],
    ["frequency", "Frequency"],
    ["team", "Team"],
    ["specialNotes", "Notes"],
    ["accessDetails", "Access Notes"],
];

function normalizeValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function staffNames(booking = {}) {
    return (booking.assignedStaff || []).map((s) => s.name || s).filter(Boolean).join(", ");
}

function shiftsLabel(booking = {}) {
    return (booking.shifts || []).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" + ");
}

// Returns [{label, from, to}] for every field the requester actually changed.
function computeChanges(orig = {}, reqd = {}) {
    const changes = [];
    DIFF_FIELDS.forEach(([key, label, fmt]) => {
        const from = normalizeValue(orig[key]);
        const to = normalizeValue(reqd[key]);
        if (from !== to) {
            changes.push({
                label,
                from: from ? (fmt ? fmt(from) : from) : "—",
                to: to ? (fmt ? fmt(to) : to) : "—",
            });
        }
    });
    const fromStaff = staffNames(orig);
    const toStaff = staffNames(reqd);
    if (fromStaff !== toStaff) changes.push({ label: "Assigned Staff", from: fromStaff || "—", to: toStaff || "—" });
    const fromShifts = shiftsLabel(orig);
    const toShifts = shiftsLabel(reqd);
    if (fromShifts !== toShifts) changes.push({ label: "Shift(s)", from: fromShifts || "—", to: toShifts || "—" });
    return changes;
}

function formatWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.split("T")[0] || iso;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialsOf(nameOrEmail = "") {
    const base = String(nameOrEmail).split("@")[0].replace(/[._-]/g, " ");
    return base.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

const STATUS_CHIP = {
    Pending:  { bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
    Approved: { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
    Rejected: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
};

function StatusChip({ status }) {
    const st = STATUS_CHIP[status] || STATUS_CHIP.Pending;
    return (
        <span style={{ fontSize: 10, fontWeight: 800, background: st.bg, border: `1px solid ${st.border}`, color: st.color, borderRadius: 99, padding: "3px 10px", whiteSpace: "nowrap" }}>
            {status}
        </span>
    );
}

function RequesterLine({ req }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{
                width: 26, height: 26, borderRadius: "50%", background: "#e0e9ff", color: "#1d4ed8",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, flexShrink: 0,
            }}>
                {initialsOf(req.requestedBy)}
            </span>
            <span style={{ fontSize: 11, color: "#475569", minWidth: 0, overflowWrap: "anywhere" }}>
                <strong style={{ color: "#1e293b" }}>{req.requestedBy}</strong>
                {req.requestedByRole ? ` (${req.requestedByRole})` : ""} · {formatWhen(req.createdAt)}
            </span>
        </div>
    );
}

function ChangeDiff({ changes }) {
    if (changes.length === 0) {
        return <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic", padding: "6px 0" }}>No field changes detected — review checklist/photos or reject.</div>;
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {changes.map((c) => (
                <div key={c.label} className="edit-req-diff-row">
                    <span className="edit-req-diff-label">{c.label}</span>
                    <span className="edit-req-diff-from">{c.from}</span>
                    <span className="edit-req-diff-arrow">→</span>
                    <span className="edit-req-diff-to">{c.to}</span>
                </div>
            ))}
        </div>
    );
}

function BookingContext({ data = {} }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            <span>📅 {data.date || "No date"}{data.time ? ` · ${data.time}` : ""}</span>
            <span>📍 {[data.address1, data.city].filter(Boolean).join(", ") || "No address"}</span>
            <span>🧹 {data.service || "Service"}</span>
            {data.price !== undefined && <span>💲{parseFloat(data.price || 0).toFixed(2)}</span>}
        </div>
    );
}

export default function EditRequestsTab({
    editRequests,
    editRequestResolutions,
    setEditRequestResolutions,
    handleResolveEdit,
    handleResolveJobCompletion,
}) {
    const [filter, setFilter] = useState("Pending");
    const [resolving, setResolving] = useState(null);

    const counts = useMemo(() => ({
        Pending: editRequests.filter((r) => r.status === "Pending").length,
        Approved: editRequests.filter((r) => r.status === "Approved").length,
        Rejected: editRequests.filter((r) => r.status === "Rejected").length,
    }), [editRequests]);

    const isCompletion = (r) => (r.requestedData?.cleanerChecklist?.tasks?.length || 0) > 0;

    const pending = editRequests.filter((r) => r.status === "Pending");
    const jobCompletions = pending.filter(isCompletion);
    const bookingEdits = pending.filter((r) => !isCompletion(r));

    const history = useMemo(() =>
        editRequests
            .filter((r) => r.status === filter)
            .sort((a, b) => (b.resolvedAt || b.createdAt || "").localeCompare(a.resolvedAt || a.createdAt || "")),
        [editRequests, filter]
    );

    const resolveEdit = async (id, action) => {
        setResolving(id);
        await handleResolveEdit(id, action);
        setResolving(null);
    };
    const resolveCompletion = async (id, action) => {
        setResolving(id);
        await handleResolveJobCompletion(id, action);
        setResolving(null);
    };

    const filterPill = (name, count, color) => (
        <button key={name} onClick={() => setFilter(name)}
            style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 800, cursor: "pointer",
                border: `1.5px solid ${filter === name ? color : "#e2e8f0"}`,
                background: filter === name ? color : "#ffffff",
                color: filter === name ? "#ffffff" : "#475569",
            }}>
            {name}
            <span style={{
                fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "1px 7px",
                background: filter === name ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                color: filter === name ? "#ffffff" : "#64748b",
            }}>{count}</span>
        </button>
    );

    return (
        <div className="animate-fade flex flex-col gap-6">

            {/* ── Filters ── */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {filterPill("Pending", counts.Pending, "#b45309")}
                {filterPill("Approved", counts.Approved, "#15803d")}
                {filterPill("Rejected", counts.Rejected, "#dc2626")}
            </div>

            {filter !== "Pending" ? (
                /* ── RESOLVED HISTORY ── */
                history.length === 0 ? (
                    <div className="panel-card p-8 text-center text-slate-400 text-sm">No {filter.toLowerCase()} requests yet.</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {history.map((req) => {
                            const changes = computeChanges(req.originalData, req.requestedData);
                            return (
                                <div key={req.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>
                                                {isCompletion(req) ? "Job Review" : "Edit Request"} — {req.clientName}
                                            </div>
                                            <RequesterLine req={req} />
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <StatusChip status={req.status} />
                                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>
                                                {req.resolvedBy ? `by ${req.resolvedBy}` : ""}{req.resolvedAt ? ` · ${formatWhen(req.resolvedAt)}` : ""}
                                            </div>
                                        </div>
                                    </div>
                                    {!isCompletion(req) && changes.length > 0 && <ChangeDiff changes={changes} />}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                <>
                    {/* ── JOB COMPLETION REVIEWS ── */}
                    <section>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 4, height: 22, background: "#059669", borderRadius: 99 }} />
                            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#064e3b", margin: 0 }}>Job Completion Reviews</h3>
                            {jobCompletions.length > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, background: "#d1fae5", color: "#059669", padding: "2px 9px", borderRadius: 99 }}>{jobCompletions.length}</span>
                            )}
                        </div>
                        {jobCompletions.length === 0 ? (
                            <div className="panel-card p-6 text-center text-slate-400 text-sm">No job completion reviews pending.</div>
                        ) : (
                            <div className="flex flex-col gap-5">
                                {jobCompletions.map((req) => {
                                    const checklist = req.requestedData.cleanerChecklist;
                                    const totalTasks = checklist.tasks.length;
                                    const completedTasks = checklist.tasks.filter((t) => t.completed).length;
                                    const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
                                    const busy = resolving === req.id;
                                    return (
                                        <div key={req.id} style={{ background: "#fff", border: "1px solid #d1fae5", borderLeft: "4px solid #059669", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Job Review — {req.clientName}</div>
                                                    <RequesterLine req={{ ...req, createdAt: checklist.submittedAt || req.createdAt }} />
                                                    <div style={{ marginTop: 8 }}>
                                                        <BookingContext data={req.requestedData} />
                                                    </div>
                                                </div>
                                                <div className="edit-req-actions">
                                                    <button disabled={busy} onClick={() => resolveCompletion(req.id, "approve")}
                                                        style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: busy ? "#94a3b8" : "#059669", color: "#fff", fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
                                                        {busy ? "Saving…" : "✓ Approve & Complete"}
                                                    </button>
                                                    <button disabled={busy} onClick={() => resolveCompletion(req.id, "reject")}
                                                        style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Task progress */}
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                                                    <span>Checklist progress</span>
                                                    <span style={{ color: pct === 100 ? "#059669" : "#d97706" }}>{completedTasks}/{totalTasks} tasks · {pct}%</span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
                                                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: pct === 100 ? "#22c55e" : "#f59e0b", transition: "width 0.3s" }} />
                                                </div>
                                            </div>

                                            {/* Task cards */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                {checklist.tasks.map((task) => (
                                                    <div key={task.id} style={{ background: task.completed ? "#f0fdf4" : "#f8fafc", border: `1px solid ${task.completed ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: 14, padding: "12px 14px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                                            <div style={{ width: 22, height: 22, borderRadius: 7, background: task.completed ? "#22c55e" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                                {task.completed && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                            </div>
                                                            <span style={{ fontSize: 12, fontWeight: 700, color: task.completed ? "#15803d" : "#1e293b", flex: 1 }}>{task.label}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: task.completed ? "#059669" : "#94a3b8", background: task.completed ? "#d1fae5" : "#f1f5f9", padding: "2px 8px", borderRadius: 99 }}>
                                                                {task.completed ? "Done" : "Skipped"}
                                                            </span>
                                                        </div>
                                                        <div className="edit-req-photo-grid">
                                                            {[["📷 Before", task.beforePhotos || []], ["✅ After", task.afterPhotos || []]].map(([label, photos]) => (
                                                                <div key={label}>
                                                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label} ({photos.length})</div>
                                                                    {photos.length === 0 ? (
                                                                        <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No photos</div>
                                                                    ) : (
                                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                                            {photos.map((photo) => (
                                                                                photo.url ? (
                                                                                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                                                                                        <img src={photo.url} alt={photo.name || label} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0", cursor: "pointer" }} />
                                                                                    </a>
                                                                                ) : (
                                                                                    <div key={photo.id} style={{ width: 64, height: 64, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8" }}>No URL</div>
                                                                                )
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── BOOKING EDIT REQUESTS ── */}
                    <section>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 4, height: 22, background: "#f59e0b", borderRadius: 99 }} />
                            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#78350f", margin: 0 }}>Booking Edit Requests</h3>
                            {bookingEdits.length > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#b45309", padding: "2px 9px", borderRadius: 99 }}>{bookingEdits.length}</span>
                            )}
                        </div>
                        {bookingEdits.length === 0 ? (
                            <div className="panel-card p-6 text-center text-slate-400 text-sm">No booking edit requests pending.</div>
                        ) : (
                            <div className="flex flex-col gap-5">
                                {bookingEdits.map((req) => {
                                    const orig = req.originalData || {};
                                    const reqd = req.requestedData || {};
                                    const changes = computeChanges(orig, reqd);
                                    const busy = resolving === req.id;
                                    const resolution = editRequestResolutions[req.id] || {
                                        finalStatus: reqd.status || orig.status || "Confirmed",
                                        paymentStatus: reqd.paymentStatus || orig.paymentStatus || "unpaid",
                                    };
                                    return (
                                        <div key={req.id} style={{ background: "#fff", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                                            {/* Header */}
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                        <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Edit Request — {req.clientName}</span>
                                                        <span style={{ fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#b45309", borderRadius: 99, padding: "2px 9px" }}>
                                                            {changes.length} change{changes.length === 1 ? "" : "s"}
                                                        </span>
                                                    </div>
                                                    <RequesterLine req={req} />
                                                    <div style={{ marginTop: 8 }}>
                                                        <BookingContext data={orig} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Field-level diff */}
                                            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Requested Changes</div>
                                                <ChangeDiff changes={changes} />
                                            </div>

                                            {/* Admin Decision */}
                                            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                                                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Admin Final Decision</div>
                                                <div className="edit-req-decision-grid">
                                                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                                                        <strong>Final Job Status</strong>
                                                        <select value={resolution.finalStatus} onChange={(e) => setEditRequestResolutions((prev) => ({ ...prev, [req.id]: { ...resolution, finalStatus: e.target.value } }))} className="border border-slate-200 rounded-lg p-2 bg-white">
                                                            <option value="Pending">Pending</option>
                                                            <option value="Confirmed">Confirmed</option>
                                                            <option value="Completed">Completed</option>
                                                            <option value="Cancelled">Cancelled</option>
                                                        </select>
                                                    </label>
                                                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                                                        <strong>Payment Status</strong>
                                                        <select value={resolution.paymentStatus} onChange={(e) => setEditRequestResolutions((prev) => ({ ...prev, [req.id]: { ...resolution, paymentStatus: e.target.value } }))} className="border border-slate-200 rounded-lg p-2 bg-white">
                                                            <option value="unpaid">Unpaid</option>
                                                            <option value="paid">Paid</option>
                                                            <option value="pending">Pending</option>
                                                            <option value="redo">Redo</option>
                                                        </select>
                                                    </label>
                                                </div>
                                                <div className="edit-req-actions" style={{ marginTop: 12 }}>
                                                    <button disabled={busy} onClick={() => resolveEdit(req.id, "approve")}
                                                        style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: busy ? "#94a3b8" : "#1d4ed8", color: "#fff", fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
                                                        {busy ? "Saving…" : "✓ Approve & Merge"}
                                                    </button>
                                                    <button disabled={busy} onClick={() => resolveEdit(req.id, "reject")}
                                                        style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
