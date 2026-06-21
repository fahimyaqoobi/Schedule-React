"use client";

export default function JobsPayrollTab({
    isCleanerSelfServiceView,
    cleanerPayPeriod,
    weeklyTimeSummary,
    Icons,
    activeTimeEntry,
    timeEntrySaving,
    cleanerTodayConfirmedJobs,
    activeJobForCleaner,
    jobsNow,
    jobsFeedback,
    recentOwnTimeEntries,
    payrollSummary,
    payrollApprovedRows,
    payrollRejectedRows,
    timeEntryEditDrafts,
    setTimeEntryEditDrafts,
    manualTimeEntryForm,
    setManualTimeEntryForm,
    employeePayrollRoster,
    currentUser,
    formatDurationMinutes,
    formatRuntime,
    getBookingCustomerFirstName,
    getBookingLocationLabel,
    handleOpenCleanerJob,
    syncDatabaseData,
    handleReviewTimeEntry,
    handleCreateManualTimeEntry,
}) {
    return (
        <div className={`animate-fade ${isCleanerSelfServiceView ? "cleaner-jobs-shell" : "admin-payroll-shell"}`}>
            {isCleanerSelfServiceView ? (
                <div className="cleaner-jobs-mobile">
                    <section className="cleaner-payroll-summary-card">
                        <div className="cleaner-payroll-summary-head">
                            <div>
                                <span>Current Pay Period</span>
                                <h3>{cleanerPayPeriod.label}</h3>
                            </div>
                            <div className="cleaner-period-badge">Active Period</div>
                        </div>
                        <div className="cleaner-payroll-summary-stats">
                            <div>
                                <span>Total Hours</span>
                                <strong>{formatDurationMinutes(weeklyTimeSummary.totalMinutes)}</strong>
                            </div>
                            <div>
                                <span>Est. Gross Pay</span>
                                <strong>${weeklyTimeSummary.grossPay.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div className="cleaner-payroll-summary-foot">
                            <span>{Icons.Cash()}</span>
                            <strong>Cutoff {cleanerPayPeriod.cutoffLabel}</strong>
                            <em>Payday {cleanerPayPeriod.payDateLabel}</em>
                        </div>
                    </section>

                    <section className="cleaner-active-shift-card">
                        <button
                            type="button"
                            className={`cleaner-shift-button ${activeTimeEntry ? "clock-out" : "clock-in"}`}
                            disabled={timeEntrySaving || (!activeTimeEntry && cleanerTodayConfirmedJobs.length === 0)}
                            onClick={() => {
                                const targetJob = activeJobForCleaner || cleanerTodayConfirmedJobs[0];
                                if (targetJob) {
                                    handleOpenCleanerJob(targetJob, activeTimeEntry ? "task-list" : "overview");
                                }
                            }}
                        >
                            <span>{Icons.Clock()}</span>
                            <strong>{activeTimeEntry ? "End Job" : "Start Job"}</strong>
                            <em>{activeTimeEntry ? formatRuntime(activeTimeEntry.startedAt, jobsNow) : "Open workspace"}</em>
                        </button>
                        <div className="cleaner-active-shift-meta">
                            <h4>{activeJobForCleaner?.service || cleanerTodayConfirmedJobs[0]?.service || "No job for today"}</h4>
                            <p>
                                {activeJobForCleaner
                                    ? `${getBookingCustomerFirstName(activeJobForCleaner)} • ${getBookingLocationLabel(activeJobForCleaner)}`
                                    : cleanerTodayConfirmedJobs[0]
                                        ? `${getBookingCustomerFirstName(cleanerTodayConfirmedJobs[0])} • ${getBookingLocationLabel(cleanerTodayConfirmedJobs[0])}`
                                        : "Only confirmed jobs scheduled for today appear here."}
                            </p>
                            {activeTimeEntry && <span>Started at {new Date(activeTimeEntry.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                        {jobsFeedback && <div className="people-profile-message">{jobsFeedback}</div>}
                    </section>

                    <section className="cleaner-assigned-jobs-list">
                        <div className="cleaner-section-head">
                            <h4>Today&apos;s Confirmed Jobs</h4>
                            <span>{cleanerTodayConfirmedJobs.length}</span>
                        </div>
                        {cleanerTodayConfirmedJobs.length === 0 ? (
                            <div className="admin-cart-empty">No confirmed jobs scheduled for today.</div>
                        ) : cleanerTodayConfirmedJobs.map(job => {
                            const isCurrent = activeTimeEntry?.bookingId === job.id;
                            return (
                                <article key={job.id} className={`cleaner-job-card ${isCurrent ? "active" : ""}`}>
                                    <div className="cleaner-job-card-head">
                                        <div>
                                            <strong>{job.service}</strong>
                                            <span>{getBookingCustomerFirstName(job)} • {getBookingLocationLabel(job)}</span>
                                        </div>
                                        <em>{job.date}</em>
                                    </div>
                                    <div className="cleaner-job-card-foot">
                                        <span>{job.time} • {job.duration}h</span>
                                        <button type="button" onClick={() => handleOpenCleanerJob(job, isCurrent ? "task-list" : "overview")} disabled={timeEntrySaving}>
                                            {isCurrent ? "In Progress" : "Open Job"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <section className="cleaner-recent-time-list">
                        <div className="cleaner-section-head">
                            <h4>Recent Entries</h4>
                        </div>
                        {recentOwnTimeEntries.length === 0 ? (
                            <div className="admin-cart-empty">No completed time entries yet.</div>
                        ) : recentOwnTimeEntries.map(entry => (
                            <article key={entry.id} className="cleaner-recent-entry-card">
                                <div>
                                    <strong>{entry.serviceName}</strong>
                                    <span>{entry.bookingDate} • {formatDurationMinutes(entry.durationMinutes || 0)}</span>
                                </div>
                                <div className={`cleaner-entry-status status-${entry.status}`}>
                                    <strong>{entry.status.replace("_", " ")}</strong>
                                    <em>${Number(entry.grossPayEstimate || 0).toFixed(2)}</em>
                                </div>
                            </article>
                        ))}
                    </section>
                </div>
            ) : (
                <div className="admin-payroll-grid">
                    <div className="admin-payroll-main">
                        <div className="admin-payroll-hero">
                            <div>
                                <h3>Payroll & Time Hub</h3>
                                <p>Manage staff compensation and shift approvals for the current period.</p>
                            </div>
                            <div className="admin-payroll-actions">
                                <button type="button" className="team-secondary-action" onClick={() => syncDatabaseData(currentUser)}>Refresh</button>
                            </div>
                        </div>
                        <div className="admin-payroll-summary">
                            <article><span>Total Payroll</span><strong>${payrollSummary.totalPayroll.toFixed(2)}</strong></article>
                            <article><span>Hours Tracked</span><strong>{formatDurationMinutes(payrollSummary.trackedMinutes)}</strong></article>
                            <article><span>Pending Approvals</span><strong>{payrollSummary.pendingCount} entries</strong></article>
                            <article><span>Next Pay Date</span><strong>{payrollSummary.nextPayDate}</strong></article>
                        </div>
                        <section className="admin-payroll-queue">
                            <div className="cleaner-section-head">
                                <h4>Shift Approval Queue</h4>
                                <span>{payrollSummary.pendingEntries.length} pending</span>
                            </div>
                            <div className="admin-payroll-table">
                                <div className="admin-payroll-table-head">
                                    <span>Staff</span>
                                    <span>Date</span>
                                    <span>Service</span>
                                    <span>Duration</span>
                                    <span>Total Pay</span>
                                    <span>Status</span>
                                    <span>Actions</span>
                                </div>
                                {payrollSummary.pendingEntries.length === 0 ? (
                                    <div className="admin-cart-empty">No pending payroll approvals.</div>
                                ) : payrollSummary.pendingEntries.map(entry => (
                                    <div key={entry.id} className="admin-payroll-row">
                                        <span>{entry.cleanerName}</span>
                                        <span>{entry.bookingDate || entry.startedAt?.split("T")[0]}</span>
                                        <span>{entry.serviceName}</span>
                                        <span>{formatDurationMinutes(entry.durationMinutes || 0)}</span>
                                        <span>${Number(entry.grossPayEstimate || 0).toFixed(2)}</span>
                                        <span>{entry.status}</span>
                                        <div className="admin-payroll-row-actions">
                                            <button type="button" onClick={() => handleReviewTimeEntry(entry.id, "approve")} disabled={timeEntrySaving}>Approve</button>
                                            <button type="button" className="team-secondary-action" onClick={() => handleReviewTimeEntry(entry.id, "reject")} disabled={timeEntrySaving}>Reject</button>
                                        </div>
                                        <div className="md:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Start Time</strong>
                                                <input
                                                    type="datetime-local"
                                                    value={timeEntryEditDrafts[entry.id]?.startedAt || (entry.startedAt ? new Date(entry.startedAt).toISOString().slice(0, 16) : "")}
                                                    onChange={e => setTimeEntryEditDrafts(prev => ({
                                                        ...prev,
                                                        [entry.id]: {
                                                            ...(prev[entry.id] || {}),
                                                            startedAt: e.target.value
                                                        }
                                                    }))}
                                                    className="border border-slate-200 rounded-lg p-2"
                                                />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Finish Time</strong>
                                                <input
                                                    type="datetime-local"
                                                    value={timeEntryEditDrafts[entry.id]?.endedAt || (entry.endedAt ? new Date(entry.endedAt).toISOString().slice(0, 16) : "")}
                                                    onChange={e => setTimeEntryEditDrafts(prev => ({
                                                        ...prev,
                                                        [entry.id]: {
                                                            ...(prev[entry.id] || {}),
                                                            endedAt: e.target.value
                                                        }
                                                    }))}
                                                    className="border border-slate-200 rounded-lg p-2"
                                                />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Unpaid Break (mins)</strong>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={timeEntryEditDrafts[entry.id]?.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0}
                                                    onChange={e => setTimeEntryEditDrafts(prev => ({
                                                        ...prev,
                                                        [entry.id]: {
                                                            ...(prev[entry.id] || {}),
                                                            unpaidBreakMinutes: parseInt(e.target.value || "0", 10)
                                                        }
                                                    }))}
                                                    className="border border-slate-200 rounded-lg p-2"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="admin-payroll-queue">
                            <div className="cleaner-section-head">
                                <h4>Manual Time Card</h4>
                                <span>Employees only</span>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                                <label className="flex flex-col gap-1 text-xs text-slate-700">
                                    <strong>Employee</strong>
                                    <select value={manualTimeEntryForm.cleanerUid} onChange={e => setManualTimeEntryForm(prev => ({ ...prev, cleanerUid: e.target.value }))} className="border border-slate-200 rounded-lg p-2">
                                        <option value="">Select employee</option>
                                        {employeePayrollRoster.map(member => (
                                            <option key={member.uid} value={member.uid}>{member.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-slate-700">
                                    <strong>Booking Id</strong>
                                    <input value={manualTimeEntryForm.bookingId} onChange={e => setManualTimeEntryForm(prev => ({ ...prev, bookingId: e.target.value }))} className="border border-slate-200 rounded-lg p-2" placeholder="Optional" />
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-slate-700">
                                    <strong>Start Time</strong>
                                    <input type="datetime-local" value={manualTimeEntryForm.startedAt} onChange={e => setManualTimeEntryForm(prev => ({ ...prev, startedAt: e.target.value }))} className="border border-slate-200 rounded-lg p-2" />
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-slate-700">
                                    <strong>Finish Time</strong>
                                    <input type="datetime-local" value={manualTimeEntryForm.endedAt} onChange={e => setManualTimeEntryForm(prev => ({ ...prev, endedAt: e.target.value }))} className="border border-slate-200 rounded-lg p-2" />
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-slate-700">
                                    <strong>Unpaid Break (mins)</strong>
                                    <input type="number" min="0" step="1" value={manualTimeEntryForm.unpaidBreakMinutes} onChange={e => setManualTimeEntryForm(prev => ({ ...prev, unpaidBreakMinutes: parseInt(e.target.value || "0", 10) }))} className="border border-slate-200 rounded-lg p-2" />
                                </label>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button type="button" className="team-primary-action" onClick={handleCreateManualTimeEntry} disabled={timeEntrySaving}>Add Manual Hours</button>
                            </div>
                        </section>
                        <section className="admin-payroll-queue">
                            <div className="cleaner-section-head">
                                <h4>Approved Payroll Ledger</h4>
                                <span>{payrollApprovedRows.length} entries</span>
                            </div>
                            <div className="admin-payroll-table">
                                <div className="admin-payroll-table-head">
                                    <span>Staff</span>
                                    <span>Date</span>
                                    <span>Regular</span>
                                    <span>Overtime</span>
                                    <span>Rate</span>
                                    <span>Gross</span>
                                    <span>Status</span>
                                </div>
                                {payrollApprovedRows.length === 0 ? (
                                    <div className="admin-cart-empty">No approved payroll entries yet.</div>
                                ) : payrollApprovedRows.map(entry => (
                                    <div key={entry.id} className="admin-payroll-row">
                                        <span>{entry.cleanerName}</span>
                                        <span>{entry.bookingDate || entry.startedAt?.split("T")[0]}</span>
                                        <span>{entry.payrollBreakdown?.regularHours || 0}h</span>
                                        <span>{entry.payrollBreakdown?.overtimeHours || 0}h</span>
                                        <span>${Number(entry.payRate || 20).toFixed(2)}</span>
                                        <span>${Number(entry.grossPayEstimate || 0).toFixed(2)}</span>
                                        <span>{entry.status}</span>
                                        <div className="admin-payroll-row-actions">
                                            <button type="button" onClick={() => handleReviewTimeEntry(entry.id, "approve")} disabled={timeEntrySaving}>Update</button>
                                        </div>
                                        <div className="md:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Start Time</strong>
                                                <input type="datetime-local" value={timeEntryEditDrafts[entry.id]?.startedAt || (entry.startedAt ? new Date(entry.startedAt).toISOString().slice(0, 16) : "")} onChange={e => setTimeEntryEditDrafts(prev => ({ ...prev, [entry.id]: { ...(prev[entry.id] || {}), startedAt: e.target.value } }))} className="border border-slate-200 rounded-lg p-2" />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Finish Time</strong>
                                                <input type="datetime-local" value={timeEntryEditDrafts[entry.id]?.endedAt || (entry.endedAt ? new Date(entry.endedAt).toISOString().slice(0, 16) : "")} onChange={e => setTimeEntryEditDrafts(prev => ({ ...prev, [entry.id]: { ...(prev[entry.id] || {}), endedAt: e.target.value } }))} className="border border-slate-200 rounded-lg p-2" />
                                            </label>
                                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                                                <strong>Unpaid Break (mins)</strong>
                                                <input type="number" min="0" step="1" value={timeEntryEditDrafts[entry.id]?.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0} onChange={e => setTimeEntryEditDrafts(prev => ({ ...prev, [entry.id]: { ...(prev[entry.id] || {}), unpaidBreakMinutes: parseInt(e.target.value || "0", 10) } }))} className="border border-slate-200 rounded-lg p-2" />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="admin-payroll-queue">
                            <div className="cleaner-section-head">
                                <h4>Rejected Time Card Log</h4>
                                <span>{payrollRejectedRows.length} rejected</span>
                            </div>
                            <div className="admin-payroll-table">
                                <div className="admin-payroll-table-head">
                                    <span>Staff</span>
                                    <span>Date</span>
                                    <span>Service</span>
                                    <span>Hours</span>
                                    <span>Gross</span>
                                    <span>Status</span>
                                    <span>Reviewed</span>
                                </div>
                                {payrollRejectedRows.length === 0 ? (
                                    <div className="admin-cart-empty">No rejected time cards yet.</div>
                                ) : payrollRejectedRows.map(entry => (
                                    <div key={entry.id} className="admin-payroll-row">
                                        <span>{entry.cleanerName}</span>
                                        <span>{entry.bookingDate || entry.startedAt?.split("T")[0]}</span>
                                        <span>{entry.serviceName}</span>
                                        <span>{formatDurationMinutes(entry.durationMinutes || 0)}</span>
                                        <span>${Number(entry.grossPayEstimate || 0).toFixed(2)}</span>
                                        <span>{entry.status}</span>
                                        <span>{entry.reviewedAt ? entry.reviewedAt.split("T")[0] : "n/a"}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                    <aside className="admin-payroll-side">
                        <div className="admin-payroll-alert-card">
                            <span>Approval Deadline</span>
                            <strong>Wednesday at 5:00 PM</strong>
                            <p>All pending shifts must be approved before the cutoff for payroll processing.</p>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
