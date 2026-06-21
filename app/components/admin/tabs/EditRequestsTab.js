"use client";

export default function EditRequestsTab({
    editRequests,
    editRequestResolutions,
    setEditRequestResolutions,
    handleResolveEdit,
}) {
    const pending = editRequests.filter(r => r.status === "Pending");

    return (
        <div className="animate-fade flex flex-col gap-6">
            {pending.length === 0 ? (
                <div className="panel-card p-12 text-center text-slate-400 text-sm">Review Inbox is clean. No cleaner modification requests pending.</div>
            ) : (
                pending.map(req => {
                    const orig = req.originalData || {};
                    const reqd = req.requestedData || {};
                    const resolution = editRequestResolutions[req.id] || {
                        finalStatus: reqd.status || orig.status || "Confirmed",
                        paymentStatus: reqd.paymentStatus || orig.paymentStatus || "unpaid",
                    };
                    return (
                        <div key={req.id} className="panel-card border-l-4 border-amber-500 p-6 flex flex-col gap-4 bg-white shadow rounded-2xl">
                            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                <div>
                                    <h4 className="font-extrabold text-sm text-slate-800">Booking Edit Request for {req.clientName}</h4>
                                    <span className="text-[10px] text-slate-400 block mt-1">Submitted by: <strong>{req.requestedBy}</strong> • {req.createdAt.split("T")[0]}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleResolveEdit(req.id, "approve")} className="btn btn-primary btn-sm">Approve &amp; Merge</button>
                                    <button onClick={() => handleResolveEdit(req.id, "reject")} className="btn btn-danger btn-sm">Reject Request</button>
                                </div>
                            </div>

                            <div className="comparison-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="comparison-column bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="comparison-title text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Original dispatch Details</div>
                                    <div className="flex flex-col gap-1.5 text-xs text-slate-700">
                                        <div><strong>Client:</strong> {orig.clientName}</div>
                                        <div><strong>Phone:</strong> {orig.phone}</div>
                                        <div><strong>Email:</strong> {orig.email}</div>
                                        <div><strong>Address 1:</strong> {orig.address1}</div>
                                        <div><strong>Address 2:</strong> {orig.address2 || "None"}</div>
                                        <div><strong>City:</strong> {orig.city} ({orig.postalCode})</div>
                                        <div><strong>Service:</strong> {orig.service}</div>
                                        <div><strong>Price / Duration:</strong> ${orig.price} / {orig.duration} hrs</div>
                                        {orig.customDiscountAmount > 0 && <div className="text-green-600 font-semibold"><strong>Special Discount:</strong> -${parseFloat(orig.customDiscountAmount).toFixed(2)}</div>}
                                        <div><strong>Schedule Date:</strong> {orig.date} • {orig.time}</div>
                                        <div><strong>Assigned Team:</strong> {orig.team}</div>
                                        <div><strong>Status:</strong> <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${orig.status === "Completed" ? "bg-green-100 text-green-700" : orig.status === "Cancelled" ? "bg-red-100 text-red-700" : orig.status === "Confirmed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{orig.status || "Pending"}</span></div>
                                        <div><strong>Payment:</strong> {orig.paymentStatus || "unpaid"}</div>
                                    </div>
                                </div>

                                <div className="comparison-column bg-amber-50 bg-opacity-30 border border-amber-200 p-4 rounded-xl">
                                    <div className="comparison-title text-[9px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-200 pb-1 mb-2">Requested Updates</div>
                                    <div className="flex flex-col gap-1.5 text-xs text-slate-700">
                                        <div><strong>Client:</strong> <span className={orig.clientName !== reqd.clientName ? "diff-highlight font-bold" : ""}>{reqd.clientName}</span></div>
                                        <div><strong>Phone:</strong> <span className={orig.phone !== reqd.phone ? "diff-highlight font-bold" : ""}>{reqd.phone}</span></div>
                                        <div><strong>Email:</strong> <span className={orig.email !== reqd.email ? "diff-highlight font-bold" : ""}>{reqd.email}</span></div>
                                        <div><strong>Address 1:</strong> <span className={orig.address1 !== reqd.address1 ? "diff-highlight font-bold" : ""}>{reqd.address1}</span></div>
                                        <div><strong>Address 2:</strong> <span className={orig.address2 !== reqd.address2 ? "diff-highlight font-bold" : ""}>{reqd.address2 || "None"}</span></div>
                                        <div><strong>City:</strong> <span className={(orig.city !== reqd.city || orig.postalCode !== reqd.postalCode) ? "diff-highlight font-bold" : ""}>{reqd.city} ({reqd.postalCode})</span></div>
                                        <div><strong>Service:</strong> <span className={orig.service !== reqd.service ? "diff-highlight font-bold" : ""}>{reqd.service}</span></div>
                                        <div><strong>Price / Duration:</strong> <span className={(orig.price !== reqd.price || orig.duration !== reqd.duration) ? "diff-highlight font-bold" : ""}>${reqd.price} / {reqd.duration} hrs</span></div>
                                        {reqd.customDiscountAmount > 0 && <div className="text-green-600 font-semibold"><strong>Special Discount:</strong> <span className={orig.customDiscountAmount !== reqd.customDiscountAmount ? "diff-highlight font-bold text-green-700" : ""}>-${parseFloat(reqd.customDiscountAmount).toFixed(2)}</span></div>}
                                        <div><strong>Schedule Date:</strong> <span className={(orig.date !== reqd.date || orig.time !== reqd.time) ? "diff-highlight font-bold" : ""}>{reqd.date} • {reqd.time}</span></div>
                                        <div><strong>Assigned Team:</strong> <span className={orig.team !== reqd.team ? "diff-highlight font-bold" : ""}>{reqd.team}</span></div>
                                        <div><strong>Status:</strong> <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${orig.status !== reqd.status ? "diff-highlight" : ""} ${reqd.status === "Completed" ? "bg-green-100 text-green-700" : reqd.status === "Cancelled" ? "bg-red-100 text-red-700" : reqd.status === "Confirmed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{reqd.status || "Pending"}</span></div>
                                        <div><strong>Payment:</strong> <span className={orig.paymentStatus !== reqd.paymentStatus ? "diff-highlight font-bold" : ""}>{reqd.paymentStatus || "unpaid"}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="comparison-column bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="comparison-title text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">Admin Final Decision</div>
                                    <div className="flex flex-col gap-3 text-xs text-slate-700">
                                        <label className="flex flex-col gap-1">
                                            <strong>Final Job Status</strong>
                                            <select
                                                value={resolution.finalStatus}
                                                onChange={e => setEditRequestResolutions(prev => ({ ...prev, [req.id]: { ...resolution, finalStatus: e.target.value } }))}
                                                className="border border-slate-200 rounded-lg p-2"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Confirmed">Confirmed</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <strong>Payment Status</strong>
                                            <select
                                                value={resolution.paymentStatus}
                                                onChange={e => setEditRequestResolutions(prev => ({ ...prev, [req.id]: { ...resolution, paymentStatus: e.target.value } }))}
                                                className="border border-slate-200 rounded-lg p-2"
                                            >
                                                <option value="unpaid">Unpaid</option>
                                                <option value="paid">Paid</option>
                                            </select>
                                        </label>
                                        <p className="text-[11px] text-slate-500">Payment is admin-only and does not have to match the operational job status.</p>
                                    </div>
                                </div>

                                {reqd.cleanerChecklist?.tasks?.length > 0 && (
                                    <div className="comparison-column bg-amber-50 bg-opacity-30 border border-amber-200 p-4 rounded-xl">
                                        <div className="comparison-title text-[9px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-200 pb-1 mb-2">Cleaner Completion Review</div>
                                        <div className="flex flex-col gap-2 text-xs text-slate-700">
                                            {reqd.cleanerChecklist.tasks.map(task => (
                                                <div key={task.id} className="rounded-xl border border-amber-200 bg-white p-3">
                                                    <strong>{task.label}</strong>
                                                    <div className="mt-2"><strong>Before photos:</strong> {(task.beforePhotos || []).length ? task.beforePhotos.join(", ") : "None submitted"}</div>
                                                    <div><strong>After photos:</strong> {(task.afterPhotos || []).length ? task.afterPhotos.join(", ") : "None submitted"}</div>
                                                </div>
                                            ))}
                                            <p className="text-[11px] text-slate-500">Photo files are not persistently reviewable across accounts yet until storage-backed uploads are completed.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
