"use client";
import { useState } from "react";
import { Clock, Banknote, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    handleAdminClockInFor,
    handleAdminClockOutFor,
    activeTimeEntries,
    allFieldStaff,
    todayAllConfirmedJobs,
    adminClockForm,
    setAdminClockForm,
}) {
    const [adminClockOutOverride, setAdminClockOutOverride] = useState({});
    return (
        <div className={`animate-fade ${isCleanerSelfServiceView ? "cleaner-jobs-shell" : "admin-payroll-shell"}`}>
            {isCleanerSelfServiceView ? (
                <div className="flex flex-col gap-4">
                    <Card className="overflow-hidden border-none bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                        <CardContent className="flex flex-col gap-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Current Pay Period</p>
                                    <h3 className="mt-1 text-xl font-extrabold">{cleanerPayPeriod.label}</h3>
                                </div>
                                <Badge className="border-none bg-white/20 text-primary-foreground hover:bg-white/20">Active Period</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs opacity-80">Total Hours</p>
                                    <p className="text-lg font-bold">{formatDurationMinutes(weeklyTimeSummary.totalMinutes)}</p>
                                </div>
                                <div>
                                    <p className="text-xs opacity-80">Est. Gross Pay</p>
                                    <p className="text-lg font-bold">${weeklyTimeSummary.grossPay.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-t border-white/20 pt-3 text-xs opacity-90">
                                <Banknote className="size-4" />
                                <strong>Cutoff {cleanerPayPeriod.cutoffLabel}</strong>
                                <span className="italic">Payday {cleanerPayPeriod.payDateLabel}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                            <button
                                type="button"
                                disabled={timeEntrySaving || (!activeTimeEntry && cleanerTodayConfirmedJobs.length === 0)}
                                onClick={() => {
                                    const targetJob = activeJobForCleaner || cleanerTodayConfirmedJobs[0];
                                    if (targetJob) {
                                        handleOpenCleanerJob(targetJob, activeTimeEntry ? "task-list" : "overview");
                                    }
                                }}
                                className={cn(
                                    "flex size-40 flex-col items-center justify-center gap-1 rounded-full text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
                                    activeTimeEntry ? "bg-gradient-to-br from-destructive to-destructive/80 shadow-destructive/30" : "bg-gradient-to-br from-primary to-primary/80 shadow-primary/30"
                                )}
                            >
                                <Clock className="size-6" />
                                <strong className="text-lg font-extrabold">{activeTimeEntry ? "End Job" : "Start Job"}</strong>
                                <em className="text-xs not-italic opacity-90">{activeTimeEntry ? formatRuntime(activeTimeEntry.startedAt, jobsNow) : "Open workspace"}</em>
                            </button>
                            <div>
                                <h4 className="font-bold text-foreground">{activeJobForCleaner?.service || cleanerTodayConfirmedJobs[0]?.service || "No job for today"}</h4>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    {activeJobForCleaner
                                        ? `${getBookingCustomerFirstName(activeJobForCleaner)} • ${getBookingLocationLabel(activeJobForCleaner)}`
                                        : cleanerTodayConfirmedJobs[0]
                                            ? `${getBookingCustomerFirstName(cleanerTodayConfirmedJobs[0])} • ${getBookingLocationLabel(cleanerTodayConfirmedJobs[0])}`
                                            : "Only confirmed jobs scheduled for today appear here."}
                                </p>
                                {activeTimeEntry && <p className="mt-1 text-xs text-muted-foreground">Started at {new Date(activeTimeEntry.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>}
                            </div>
                            {jobsFeedback && <div className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{jobsFeedback}</div>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-foreground">Today&apos;s Confirmed Jobs</h4>
                                <Badge variant="secondary">{cleanerTodayConfirmedJobs.length}</Badge>
                            </div>
                            {cleanerTodayConfirmedJobs.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">No confirmed jobs scheduled for today.</div>
                            ) : cleanerTodayConfirmedJobs.map(job => {
                                const isCurrent = activeTimeEntry?.bookingId === job.id;
                                return (
                                    <div key={job.id} className={cn("rounded-lg border p-3", isCurrent ? "border-primary bg-primary/5" : "border-border")}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{job.service}</p>
                                                <p className="text-xs text-muted-foreground">{getBookingCustomerFirstName(job)} • {getBookingLocationLabel(job)}</p>
                                            </div>
                                            <span className="text-xs italic text-muted-foreground">{job.date}</span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">{job.time} • {job.duration}h</span>
                                            <Button
                                                size="sm"
                                                variant={isCurrent ? "secondary" : "default"}
                                                onClick={() => handleOpenCleanerJob(job, isCurrent ? "task-list" : "overview")}
                                                disabled={timeEntrySaving}
                                            >
                                                {isCurrent ? "In Progress" : "Open Job"} <ChevronRight className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <h4 className="text-sm font-bold text-foreground">Recent Entries</h4>
                            {recentOwnTimeEntries.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">No completed time entries yet.</div>
                            ) : recentOwnTimeEntries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                                    <div>
                                        <p className="text-sm font-bold text-foreground">{entry.serviceName}</p>
                                        <p className="text-xs text-muted-foreground">{entry.bookingDate} • {formatDurationMinutes(entry.durationMinutes || 0)}</p>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={entry.status === "approved" ? "default" : entry.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                                            {entry.status.replace("_", " ")}
                                        </Badge>
                                        <p className="mt-1 text-xs font-semibold text-muted-foreground">${Number(entry.grossPayEstimate || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
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
                        {/* ── LIVE STAFF STATUS & ADMIN CLOCK CONTROLS ── */}
                        <section className="admin-payroll-queue">
                            <div className="cleaner-section-head">
                                <h4>Live Staff Status</h4>
                                <span>{(activeTimeEntries || []).length} active shift{(activeTimeEntries || []).length !== 1 ? "s" : ""}</span>
                            </div>

                            {/* Active shifts — admin can force clock out */}
                            {(activeTimeEntries || []).length > 0 && (
                                <div className="flex flex-col gap-2 mb-4">
                                    {(activeTimeEntries || []).map(entry => (
                                        <div key={entry.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex flex-col gap-2">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div>
                                                    <div className="font-semibold text-sm text-emerald-800">🟢 {entry.cleanerName}</div>
                                                    <div className="text-[11px] text-emerald-700">{entry.serviceName} · {entry.locationLabel}</div>
                                                    <div className="text-[11px] text-emerald-600">Clocked in: {entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}{entry.source?.includes("admin_override") ? " (admin)" : ""}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="team-secondary-action"
                                                    style={{ background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}
                                                    onClick={() => handleAdminClockOutFor({
                                                        entryId: entry.id,
                                                        endedAt: adminClockOutOverride[entry.id] || undefined
                                                    })}
                                                    disabled={timeEntrySaving}
                                                >
                                                    Force Clock Out
                                                </button>
                                            </div>
                                            <label className="flex items-center gap-2 text-[11px] text-slate-500">
                                                <span>Override end time (optional):</span>
                                                <input
                                                    type="datetime-local"
                                                    className="border border-slate-200 rounded-lg p-1 text-[11px]"
                                                    value={adminClockOutOverride[entry.id] || ""}
                                                    onChange={e => setAdminClockOutOverride(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                                />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Admin clock-in form */}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Clock In for a Staff Member</div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <label className="flex flex-col gap-1 text-xs text-slate-700">
                                        <strong>Staff Member</strong>
                                        <select
                                            value={adminClockForm?.cleanerUid || ""}
                                            onChange={e => setAdminClockForm(prev => ({ ...prev, cleanerUid: e.target.value }))}
                                            className="border border-slate-200 rounded-lg p-2"
                                        >
                                            <option value="">Select staff…</option>
                                            {(allFieldStaff || []).map(m => (
                                                <option key={m.uid} value={m.uid}>{m.name || m.email}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs text-slate-700">
                                        <strong>Today&apos;s Job</strong>
                                        <select
                                            value={adminClockForm?.bookingId || ""}
                                            onChange={e => setAdminClockForm(prev => ({ ...prev, bookingId: e.target.value }))}
                                            className="border border-slate-200 rounded-lg p-2"
                                        >
                                            <option value="">Select job…</option>
                                            {(todayAllConfirmedJobs || []).map(job => (
                                                <option key={job.id} value={job.id}>{job.service} — {job.firstName || "Client"} ({job.date})</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs text-slate-700">
                                        <strong>Start Time (optional)</strong>
                                        <input
                                            type="datetime-local"
                                            value={adminClockForm?.startedAt || ""}
                                            onChange={e => setAdminClockForm(prev => ({ ...prev, startedAt: e.target.value }))}
                                            className="border border-slate-200 rounded-lg p-2"
                                        />
                                    </label>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            className="team-primary-action w-full"
                                            onClick={() => handleAdminClockInFor(adminClockForm || {})}
                                            disabled={timeEntrySaving || !adminClockForm?.cleanerUid || !adminClockForm?.bookingId}
                                        >
                                            Clock In for Staff
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

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
