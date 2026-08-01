"use client";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
    active: "border-emerald-300 bg-emerald-100 text-emerald-800",
    pending_approval: "border-amber-300 bg-amber-100 text-amber-800",
    approved: "border-blue-300 bg-blue-100 text-blue-800",
    rejected: "border-red-300 bg-red-100 text-red-800",
};
const STATUS_LABEL = { active: "Active", pending_approval: "Pending", approved: "Approved", rejected: "Rejected" };

function StatusBadge({ status }) {
    return (
        <Badge variant="outline" className={cn("rounded-full whitespace-nowrap", STATUS_STYLE[status] || "border-border bg-muted text-muted-foreground")}>
            {STATUS_LABEL[status] || status}{status === "approved" && " 🔒"}
        </Badge>
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

// Convert a UTC ISO string → "YYYY-MM-DDTHH:MM" in the browser's local timezone
// so datetime-local inputs show the correct local time rather than UTC.
function toLocalDatetimeInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMin(mins) {
    if (!mins && mins !== 0) return "—";
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const COLS_SUPER = "160px 80px 1fr 90px 90px 80px 120px 150px";
const COLS_ADMIN = "160px 80px 1fr 90px 90px 80px 120px 90px";

const STAT_DOTS = { Active: "bg-emerald-500", Pending: "bg-amber-500", Approved: "bg-blue-500", Rejected: "bg-red-500" };
const STAT_BG = { Active: "bg-emerald-100 dark:bg-emerald-950/30", Pending: "bg-amber-100 dark:bg-amber-950/30", Approved: "bg-blue-100 dark:bg-blue-950/30", Rejected: "bg-red-100 dark:bg-red-950/30" };

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
    const [filterStaff, setFilterStaff] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");

    const COLS = isSuperAdmin ? COLS_SUPER : COLS_ADMIN;

    const stats = useMemo(() => ({
        Active: (activeTimeEntries || []).length,
        Pending: timeEntries.filter(e => e.status === "pending_approval").length,
        Approved: timeEntries.filter(e => e.status === "approved").length,
        Rejected: timeEntries.filter(e => e.status === "rejected").length,
    }), [timeEntries, activeTimeEntries]);

    const pendingEntries = useMemo(() =>
        timeEntries.filter(e => e.status === "pending_approval")
            .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)),
        [timeEntries]
    );

    const allCards = useMemo(() => {
        let list = timeEntries.filter(e => e.status !== "active" && e.status !== "pending_approval");
        if (filterStaff) list = list.filter(e => e.cleanerUid === filterStaff);
        if (filterStatus) list = list.filter(e => e.status === filterStatus);
        if (filterDateFrom) list = list.filter(e => (e.startedAt || "").slice(0, 10) >= filterDateFrom);
        if (filterDateTo) list = list.filter(e => (e.startedAt || "").slice(0, 10) <= filterDateTo);
        return list.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)).slice(0, 300);
    }, [timeEntries, filterStaff, filterStatus, filterDateFrom, filterDateTo]);

    const hasFilters = filterStaff || filterStatus || filterDateFrom || filterDateTo;

    const toggleEdit = id => setExpandedId(p => p === id ? null : id);

    function TableHead() {
        return (
            <div className="tc-head grid gap-3 border-b border-border bg-muted/40 px-5 py-2.5" style={{ gridTemplateColumns: COLS }}>
                {["Staff", "Date", "Job / Project", "In", "Out", "Duration", "Status", "Actions"].map(h => (
                    <span key={h} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{h}</span>
                ))}
            </div>
        );
    }

    return (
        <div className="animate-fade tc-page mx-auto max-w-360">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold text-foreground">Time Cards</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Proof of work per job. No pay rates shown here — that&apos;s in Payroll.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => syncDatabaseData(currentUser)}>Refresh</Button>
            </div>

            <div className="mb-6 flex flex-wrap gap-2.5">
                {Object.entries(stats).map(([label, count]) => (
                    <div key={label} className={cn("flex items-center gap-2 rounded-lg px-3.5 py-1.5", STAT_BG[label])}>
                        <span className={cn("size-1.5 shrink-0 rounded-full", STAT_DOTS[label])} />
                        <span className="text-sm font-bold text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                ))}
            </div>

            {jobsFeedback && (
                <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                    {jobsFeedback}
                </div>
            )}

            <section className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">Live Staff Status</span>
                    <span className="text-xs text-muted-foreground">{stats.Active} active shift{stats.Active !== 1 ? "s" : ""}</span>
                </div>
                <Card className="overflow-hidden p-0">
                    {(activeTimeEntries || []).length > 0 && (
                        <div className="flex flex-col gap-2.5 border-b border-border p-4">
                            {(activeTimeEntries || []).map(entry => (
                                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/20">
                                    <div>
                                        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                            <span className="size-2 rounded-full bg-emerald-500" /> {entry.cleanerName}
                                        </p>
                                        <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">{entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}</p>
                                        <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-500">
                                            Clocked in {fmtTime(entry.startedAt)}{entry.source?.includes("admin_override") ? " · entered by admin" : ""}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Button
                                            size="sm" variant="outline" className="text-destructive hover:text-destructive"
                                            onClick={() => handleAdminClockOutFor({ entryId: entry.id, endedAt: clockOutOverrides[entry.id] || undefined })}
                                            disabled={timeEntrySaving}
                                        >
                                            Force Clock Out
                                        </Button>
                                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <span>Override end time:</span>
                                            <Input
                                                type="datetime-local"
                                                value={clockOutOverrides[entry.id] || ""}
                                                onChange={e => setClockOutOverrides(p => ({ ...p, [entry.id]: e.target.value }))}
                                                className="h-7 w-auto text-[11px]"
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <CardContent className="p-4">
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clock In for a Staff Member</p>
                        <div className="tc-form-grid grid items-end gap-3" style={{ gridTemplateColumns: "1fr 1fr 180px auto" }}>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Staff Member</Label>
                                <Select value={adminClockForm?.cleanerUid || ""} onValueChange={v => setAdminClockForm(p => ({ ...p, cleanerUid: v }))}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select staff…" /></SelectTrigger>
                                    <SelectContent>{(allFieldStaff || []).map(m => <SelectItem key={m.uid} value={m.uid}>{m.name || m.email}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Today&apos;s Job</Label>
                                <Select value={adminClockForm?.bookingId || ""} onValueChange={v => setAdminClockForm(p => ({ ...p, bookingId: v }))}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select job…" /></SelectTrigger>
                                    <SelectContent>
                                        {(todayAllConfirmedJobs || []).map(j => (
                                            <SelectItem key={j.id} value={j.id}>{j.service} — {j.firstName || j.clientName?.split(" ")[0] || "Client"}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Start Time (opt.)</Label>
                                <Input
                                    type="datetime-local"
                                    value={adminClockForm?.startedAt || ""}
                                    onChange={e => setAdminClockForm(p => ({ ...p, startedAt: e.target.value }))}
                                />
                            </div>
                            <Button
                                onClick={() => handleAdminClockInFor(adminClockForm || {})}
                                disabled={timeEntrySaving || !adminClockForm?.cleanerUid || !adminClockForm?.bookingId}
                            >
                                Clock In
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {pendingEntries.length > 0 && (
                <section className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">Pending Approval</span>
                        <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-100 text-amber-800">{pendingEntries.length} waiting</Badge>
                    </div>
                    <Card className="overflow-hidden p-0">
                        <TableHead />
                        {pendingEntries.map((entry, i) => {
                            const isOpen = expandedId === `p-${entry.id}`;
                            const draft = timeEntryEditDrafts[entry.id] || {};
                            return (
                                <div key={entry.id} className={cn(i < pendingEntries.length - 1 && "border-b border-border")}>
                                    <div className="tc-row grid items-center gap-3 bg-amber-50/50 px-5 py-3.5 dark:bg-amber-950/10" style={{ gridTemplateColumns: COLS }}>
                                        <span className="tc-name text-sm font-semibold text-foreground">{entry.cleanerName}</span>
                                        <span className="tc-date text-xs text-muted-foreground">{fmtDate(entry.startedAt)}</span>
                                        <span className="tc-service truncate text-xs text-foreground/80" title={`${entry.serviceName}${entry.locationLabel ? " · " + entry.locationLabel : ""}`}>
                                            {entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}
                                        </span>
                                        <span className="tc-in text-xs text-foreground/80">{fmtTime(entry.startedAt)}</span>
                                        <span className="tc-out text-xs text-foreground/80">{fmtTime(entry.endedAt)}</span>
                                        <span className="tc-dur text-sm font-semibold text-foreground">{fmtMin(entry.durationMinutes)}</span>
                                        <span className="tc-status"><StatusBadge status={entry.status} /></span>
                                        <div className="tc-actions flex flex-wrap gap-1.5">
                                            <Button size="sm" onClick={() => handleReviewTimeEntry(entry.id, "approve")} disabled={timeEntrySaving}>Approve</Button>
                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleReviewTimeEntry(entry.id, "reject")} disabled={timeEntrySaving}>Reject</Button>
                                            <Button size="sm" variant="ghost" onClick={() => toggleEdit(`p-${entry.id}`)}>{isOpen ? "▲" : "Edit ▼"}</Button>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="border-t border-border bg-muted/20 px-5 py-4">
                                            <div className="tc-form-grid grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 140px" }}>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Adjust Start Time</Label>
                                                    <Input type="datetime-local"
                                                        value={draft.startedAt || toLocalDatetimeInput(entry.startedAt)}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), startedAt: e.target.value } }))}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Adjust End Time</Label>
                                                    <Input type="datetime-local"
                                                        value={draft.endedAt || toLocalDatetimeInput(entry.endedAt)}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), endedAt: e.target.value } }))}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Unpaid Break (min)</Label>
                                                    <Input type="number" min="0"
                                                        value={draft.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0}
                                                        onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), unpaidBreakMinutes: parseInt(e.target.value || "0", 10) } }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Card>
                </section>
            )}

            <section className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">All Time Cards</span>
                    <span className="text-xs text-muted-foreground">{allCards.length} records</span>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                    <Select value={filterStaff || "all"} onValueChange={v => setFilterStaff(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-45"><SelectValue placeholder="All Staff" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            {(allFieldStaff || []).map(m => <SelectItem key={m.uid} value={m.uid}>{m.name || m.email}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-38"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-38" />
                    <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-38" />
                    {hasFilters && (
                        <Button variant="outline" size="sm" onClick={() => { setFilterStaff(""); setFilterStatus(""); setFilterDateFrom(""); setFilterDateTo(""); }}>
                            Clear filters
                        </Button>
                    )}
                </div>

                <Card className="overflow-hidden p-0">
                    <TableHead />
                    {allCards.length === 0 ? (
                        <div className="p-10 text-center text-sm text-muted-foreground">
                            {hasFilters ? "No time cards match the current filters." : "No completed time cards yet."}
                        </div>
                    ) : allCards.map((entry, i) => {
                        const editKey = `e-${entry.id}`;
                        const isOpen = expandedId === editKey;
                        const draft = timeEntryEditDrafts[entry.id] || {};
                        return (
                            <div key={entry.id} className={cn(i < allCards.length - 1 && "border-b border-border")}>
                                <div className="tc-row grid items-center gap-3 px-5 py-3" style={{ gridTemplateColumns: COLS }}>
                                    <span className="tc-name text-sm font-semibold text-foreground">{entry.cleanerName}</span>
                                    <span className="tc-date text-xs text-muted-foreground">{fmtDate(entry.startedAt)}</span>
                                    <span className="tc-service truncate text-xs text-foreground/80" title={`${entry.serviceName}${entry.locationLabel ? " · " + entry.locationLabel : ""}`}>
                                        {entry.serviceName}{entry.locationLabel ? ` · ${entry.locationLabel}` : ""}
                                    </span>
                                    <span className="tc-in text-xs text-foreground/80">{fmtTime(entry.startedAt)}</span>
                                    <span className="tc-out text-xs text-foreground/80">{fmtTime(entry.endedAt)}</span>
                                    <span className="tc-dur text-sm font-semibold text-foreground">{fmtMin(entry.durationMinutes)}</span>
                                    <span className="tc-status"><StatusBadge status={entry.status} /></span>
                                    <div className="tc-actions flex flex-wrap gap-1.5">
                                        {isSuperAdmin && (
                                            <>
                                                <Button size="sm" variant="ghost" onClick={() => toggleEdit(editKey)}>{isOpen ? "Close" : "Edit"}</Button>
                                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTimeEntry(entry.id)} disabled={timeEntrySaving}>Delete</Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isOpen && isSuperAdmin && (
                                    <div className="border-t border-border bg-amber-50/50 px-5 py-4 dark:bg-amber-950/10">
                                        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                            <TriangleAlert className="size-3.5" /> Super admin edit — changes apply immediately to this entry.
                                        </p>
                                        <div className="tc-form-grid grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 140px auto" }}>
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Start Time</Label>
                                                <Input type="datetime-local"
                                                    value={draft.startedAt || toLocalDatetimeInput(entry.startedAt)}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), startedAt: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">End Time</Label>
                                                <Input type="datetime-local"
                                                    value={draft.endedAt || toLocalDatetimeInput(entry.endedAt)}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), endedAt: e.target.value } }))}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Break (min)</Label>
                                                <Input type="number" min="0"
                                                    value={draft.unpaidBreakMinutes ?? entry.unpaidBreakMinutes ?? 0}
                                                    onChange={e => setTimeEntryEditDrafts(p => ({ ...p, [entry.id]: { ...(p[entry.id] || {}), unpaidBreakMinutes: parseInt(e.target.value || "0", 10) } }))}
                                                />
                                            </div>
                                            <Button
                                                onClick={() => handleEditTimeEntry(entry.id, { startedAt: draft.startedAt, endedAt: draft.endedAt, unpaidBreakMinutes: draft.unpaidBreakMinutes })}
                                                disabled={timeEntrySaving}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Card>
            </section>

            <section>
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">Add Manual Entry</span>
                    <span className="text-[11px] text-muted-foreground">Employees &amp; subcontractors</span>
                </div>
                <Card>
                    <CardContent className="p-5">
                        <div className="tc-form-grid grid items-end gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 120px auto" }}>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Staff Member</Label>
                                <Select value={manualTimeEntryForm.cleanerUid} onValueChange={v => setManualTimeEntryForm(p => ({ ...p, cleanerUid: v }))}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select staff" /></SelectTrigger>
                                    <SelectContent>{(allFieldStaff || []).map(m => <SelectItem key={m.uid} value={m.uid}>{m.name || m.email}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Start Time</Label>
                                <Input type="datetime-local" value={manualTimeEntryForm.startedAt} onChange={e => setManualTimeEntryForm(p => ({ ...p, startedAt: e.target.value }))} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">End Time</Label>
                                <Input type="datetime-local" value={manualTimeEntryForm.endedAt} onChange={e => setManualTimeEntryForm(p => ({ ...p, endedAt: e.target.value }))} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Booking ID (opt.)</Label>
                                <Input value={manualTimeEntryForm.bookingId} onChange={e => setManualTimeEntryForm(p => ({ ...p, bookingId: e.target.value }))} placeholder="Optional" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Break (min)</Label>
                                <Input type="number" min="0" value={manualTimeEntryForm.unpaidBreakMinutes} onChange={e => setManualTimeEntryForm(p => ({ ...p, unpaidBreakMinutes: parseInt(e.target.value || "0", 10) }))} />
                            </div>
                            <Button onClick={handleCreateManualTimeEntry} disabled={timeEntrySaving}>Add Hours</Button>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
