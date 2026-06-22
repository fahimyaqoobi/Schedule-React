"use client";

export default function EditRequestsTab({
    editRequests,
    editRequestResolutions,
    setEditRequestResolutions,
    handleResolveEdit,
    handleResolveJobCompletion,
}) {
    const pending = editRequests.filter(r => r.status === "Pending");
    const jobCompletions = pending.filter(r => r.requestedData?.cleanerChecklist?.tasks?.length > 0);
    const bookingEdits = pending.filter(r => !r.requestedData?.cleanerChecklist?.tasks?.length);

    return (
        <div className="animate-fade flex flex-col gap-8">

            {/* ── JOB COMPLETION REVIEWS ── */}
            <section>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 22, background: "#059669", borderRadius: 99 }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "#064e3b", margin: 0 }}>Job Completion Reviews</h3>
                    {jobCompletions.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: "#d1fae5", color: "#059669", padding: "2px 9px", borderRadius: 99 }}>{jobCompletions.length}</span>
                    )}
                </div>
                {jobCompletions.length === 0 ? (
                    <div className="panel-card p-8 text-center text-slate-400 text-sm">No job completion reviews pending.</div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {jobCompletions.map(req => {
                            const checklist = req.requestedData.cleanerChecklist;
                            const submittedDate = checklist.submittedAt ? new Date(checklist.submittedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : req.createdAt?.split("T")[0];
                            const totalTasks = checklist.tasks.length;
                            const completedTasks = checklist.tasks.filter(t => t.completed).length;
                            return (
                                <div key={req.id} style={{ background: "#fff", border: "1px solid #d1fae5", borderLeft: "4px solid #059669", borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                                    {/* Header */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Job Review — {req.clientName}</div>
                                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                                                Submitted by <strong>{req.requestedBy}</strong> · {submittedDate} · <span style={{ color: completedTasks === totalTasks ? "#059669" : "#d97706", fontWeight: 700 }}>{completedTasks}/{totalTasks} tasks done</span>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                            <button onClick={() => handleResolveJobCompletion(req.id, "approve")} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                                ✓ Approve &amp; Complete
                                            </button>
                                            <button onClick={() => handleResolveJobCompletion(req.id, "reject")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                                Reject
                                            </button>
                                        </div>
                                    </div>

                                    {/* Task cards */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {checklist.tasks.map(task => (
                                            <div key={task.id} style={{ background: task.completed ? "#f0fdf4" : "#f8fafc", border: `1px solid ${task.completed ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: 14, padding: "12px 14px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                                    <div style={{ width: 22, height: 22, borderRadius: 7, background: task.completed ? "#22c55e" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                        {task.completed && <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: task.completed ? "#15803d" : "#1e293b", flex: 1 }}>{task.label}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: task.completed ? "#059669" : "#94a3b8", background: task.completed ? "#d1fae5" : "#f1f5f9", padding: "2px 8px", borderRadius: 99 }}>
                                                        {task.completed ? "Done" : "Skipped"}
                                                    </span>
                                                </div>

                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                                    {[["Before", task.beforePhotos || []], ["After", task.afterPhotos || []]].map(([label, photos]) => (
                                                        <div key={label}>
                                                            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                                                                {label === "Before" ? "📷 Before" : "✅ After"}
                                                            </div>
                                                            {photos.length === 0 ? (
                                                                <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No photos</div>
                                                            ) : (
                                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                                    {photos.map(photo => (
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 4, height: 22, background: "#f59e0b", borderRadius: 99 }} />
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "#78350f", margin: 0 }}>Booking Edit Requests</h3>
                    {bookingEdits.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#b45309", padding: "2px 9px", borderRadius: 99 }}>{bookingEdits.length}</span>
                    )}
                </div>
                {bookingEdits.length === 0 ? (
                    <div className="panel-card p-8 text-center text-slate-400 text-sm">No booking edit requests pending.</div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {bookingEdits.map(req => {
                            const orig = req.originalData || {};
                            const reqd = req.requestedData || {};
                            const resolution = editRequestResolutions[req.id] || {
                                finalStatus: reqd.status || orig.status || "Confirmed",
                                paymentStatus: reqd.paymentStatus || orig.paymentStatus || "unpaid",
                            };
                            return (
                                <div key={req.id} style={{ background: "#fff", border: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                                    {/* Header */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Edit Request — {req.clientName}</div>
                                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                                                Submitted by <strong>{req.requestedBy}</strong> · {req.createdAt?.split("T")[0]}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                            <button onClick={() => handleResolveEdit(req.id, "approve")} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#1d4ed8", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                                ✓ Approve &amp; Merge
                                            </button>
                                            <button onClick={() => handleResolveEdit(req.id, "reject")} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                                Reject
                                            </button>
                                        </div>
                                    </div>

                                    {/* Before / After comparison */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        {/* Original */}
                                        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Original</div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: "#334155" }}>
                                                <div><strong>Client:</strong> {orig.clientName}</div>
                                                <div><strong>Service:</strong> {orig.service}</div>
                                                <div><strong>Date:</strong> {orig.date} · {orig.time}</div>
                                                <div><strong>Price:</strong> ${orig.price} / {orig.duration}h</div>
                                                <div><strong>Status:</strong> {orig.status}</div>
                                                <div><strong>Address:</strong> {orig.address1}, {orig.city}</div>
                                                <div><strong>Team:</strong> {orig.team}</div>
                                            </div>
                                        </div>

                                        {/* Requested */}
                                        <div style={{ background: "#fffbeb", borderRadius: 12, padding: "12px 14px", border: "1px solid #fde68a" }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Requested Changes</div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: "#334155" }}>
                                                {[
                                                    ["Client", orig.clientName, reqd.clientName],
                                                    ["Service", orig.service, reqd.service],
                                                    ["Date", `${orig.date} · ${orig.time}`, `${reqd.date} · ${reqd.time}`],
                                                    ["Price", `$${orig.price} / ${orig.duration}h`, `$${reqd.price} / ${reqd.duration}h`],
                                                    ["Status", orig.status, reqd.status],
                                                    ["Address", `${orig.address1}, ${orig.city}`, `${reqd.address1}, ${reqd.city}`],
                                                    ["Team", orig.team, reqd.team],
                                                ].map(([field, oldVal, newVal]) => (
                                                    <div key={field}>
                                                        <strong>{field}:</strong>{" "}
                                                        <span style={oldVal !== newVal ? { fontWeight: 700, background: "#fef08a", padding: "0 3px", borderRadius: 4 } : {}}>
                                                            {newVal}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Admin Decision */}
                                    <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Admin Final Decision</div>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                                                <strong>Final Job Status</strong>
                                                <select value={resolution.finalStatus} onChange={e => setEditRequestResolutions(prev => ({ ...prev, [req.id]: { ...resolution, finalStatus: e.target.value } }))} className="border border-slate-200 rounded-lg p-2">
                                                    <option value="Pending">Pending</option>
                                                    <option value="Confirmed">Confirmed</option>
                                                    <option value="Completed">Completed</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </label>
                                            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                                                <strong>Payment Status</strong>
                                                <select value={resolution.paymentStatus} onChange={e => setEditRequestResolutions(prev => ({ ...prev, [req.id]: { ...resolution, paymentStatus: e.target.value } }))} className="border border-slate-200 rounded-lg p-2">
                                                    <option value="unpaid">Unpaid</option>
                                                    <option value="paid">Paid</option>
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
