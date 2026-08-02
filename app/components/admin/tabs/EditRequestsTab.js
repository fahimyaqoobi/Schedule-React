"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Sparkles, DollarSign, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZonedDate } from "@/lib/timezone";

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
    return formatZonedDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }, undefined, "en-CA");
}

function initialsOf(nameOrEmail = "") {
    const base = String(nameOrEmail).split("@")[0].replace(/[._-]/g, " ");
    return base.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

const STATUS_STYLE = {
    Pending: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30",
    Approved: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30",
    Rejected: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30",
};

function StatusChip({ status }) {
    return <Badge variant="outline" className={cn("rounded-full whitespace-nowrap", STATUS_STYLE[status] || STATUS_STYLE.Pending)}>{status}</Badge>;
}

function RequesterLine({ req }) {
    return (
        <div className="mt-1.5 flex items-center gap-2">
            <Avatar size="sm"><AvatarFallback className="text-[10px]">{initialsOf(req.requestedBy)}</AvatarFallback></Avatar>
            <span className="min-w-0 text-xs text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
                <strong className="text-foreground">{req.requestedBy}</strong>
                {req.requestedByRole ? ` (${req.requestedByRole})` : ""} · {formatWhen(req.createdAt)}
            </span>
        </div>
    );
}

function ChangeDiff({ changes }) {
    if (changes.length === 0) {
        return <p className="py-1.5 text-xs italic text-muted-foreground">No field changes detected — review checklist/photos or reject.</p>;
    }
    return (
        <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="size-3" /> {data.date || "No date"}{data.time ? ` · ${data.time}` : ""}</span>
            <span className="flex items-center gap-1"><MapPin className="size-3" /> {[data.address1, data.city].filter(Boolean).join(", ") || "No address"}</span>
            <span className="flex items-center gap-1"><Sparkles className="size-3" /> {data.service || "Service"}</span>
            {data.price !== undefined && <span className="flex items-center gap-1"><DollarSign className="size-3" />{parseFloat(data.price || 0).toFixed(2)}</span>}
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

    return (
        <div className="animate-fade flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
                {[
                    ["Pending", counts.Pending],
                    ["Approved", counts.Approved],
                    ["Rejected", counts.Rejected],
                ].map(([name, count]) => (
                    <button
                        key={name}
                        onClick={() => setFilter(name)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-extrabold",
                            filter === name ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-muted-foreground"
                        )}
                    >
                        {name}
                        <span className={cn("rounded-full px-1.5 py-px text-[10px] font-extrabold", filter === name ? "bg-white/25" : "bg-muted text-muted-foreground")}>{count}</span>
                    </button>
                ))}
            </div>

            {filter !== "Pending" ? (
                history.length === 0 ? (
                    <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No {filter.toLowerCase()} requests yet.</CardContent></Card>
                ) : (
                    <div className="flex flex-col gap-4">
                        {history.map((req) => {
                            const changes = computeChanges(req.originalData, req.requestedData);
                            return (
                                <Card key={req.id}>
                                    <CardContent className="flex flex-col gap-2.5 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-2.5">
                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold text-foreground">
                                                    {isCompletion(req) ? "Job Review" : "Edit Request"} — {req.clientName}
                                                </p>
                                                <RequesterLine req={req} />
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <StatusChip status={req.status} />
                                                <p className="mt-1 text-[10px] text-muted-foreground">
                                                    {req.resolvedBy ? `by ${req.resolvedBy}` : ""}{req.resolvedAt ? ` · ${formatWhen(req.resolvedAt)}` : ""}
                                                </p>
                                            </div>
                                        </div>
                                        {!isCompletion(req) && changes.length > 0 && <ChangeDiff changes={changes} />}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )
            ) : (
                <>
                    <section>
                        <div className="mb-3.5 flex items-center gap-2.5">
                            <div className="h-5.5 w-1 rounded-full bg-emerald-600" />
                            <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-300">Job Completion Reviews</h3>
                            {jobCompletions.length > 0 && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{jobCompletions.length}</Badge>}
                        </div>
                        {jobCompletions.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No job completion reviews pending.</CardContent></Card>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {jobCompletions.map((req) => {
                                    const checklist = req.requestedData.cleanerChecklist;
                                    const totalTasks = checklist.tasks.length;
                                    const completedTasks = checklist.tasks.filter((t) => t.completed).length;
                                    const pct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
                                    const busy = resolving === req.id;
                                    return (
                                        <Card key={req.id} className="border-l-4 border-l-emerald-600">
                                            <CardContent className="flex flex-col gap-3.5 p-4.5">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-foreground">Job Review — {req.clientName}</p>
                                                        <RequesterLine req={{ ...req, createdAt: checklist.submittedAt || req.createdAt }} />
                                                        <div className="mt-2"><BookingContext data={req.requestedData} /></div>
                                                    </div>
                                                    <div className="edit-req-actions">
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-600/90" disabled={busy} onClick={() => resolveCompletion(req.id, "approve")}>
                                                            {busy ? "Saving…" : <><Check className="size-3.5" /> Approve &amp; Complete</>}
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => resolveCompletion(req.id, "reject")}>
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="mb-1.5 flex justify-between text-xs font-bold text-muted-foreground">
                                                        <span>Checklist progress</span>
                                                        <span className={pct === 100 ? "text-emerald-600" : "text-amber-600"}>{completedTasks}/{totalTasks} tasks · {pct}%</span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                        <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2.5">
                                                    {checklist.tasks.map((task) => (
                                                        <div key={task.id} className={cn("rounded-lg border p-3.5", task.completed ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-border bg-muted/30")}>
                                                            <div className="mb-2.5 flex items-center gap-2.5">
                                                                <div className={cn("flex size-5.5 shrink-0 items-center justify-center rounded-md", task.completed ? "bg-emerald-500" : "bg-muted")}>
                                                                    {task.completed && <Check className="size-3 text-white" />}
                                                                </div>
                                                                <span className={cn("flex-1 text-xs font-bold", task.completed ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>{task.label}</span>
                                                                <Badge variant="secondary" className="text-[10px]">{task.completed ? "Done" : "Skipped"}</Badge>
                                                            </div>
                                                            <div className="edit-req-photo-grid">
                                                                {[["Before", task.beforePhotos || []], ["After", task.afterPhotos || []]].map(([label, photos]) => (
                                                                    <div key={label}>
                                                                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label} ({photos.length})</p>
                                                                        {photos.length === 0 ? (
                                                                            <p className="text-[11px] italic text-muted-foreground">No photos</p>
                                                                        ) : (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {photos.map((photo) => (
                                                                                    photo.url ? (
                                                                                        <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                                                                                            <img src={photo.url} alt={photo.name || label} className="size-16 rounded-lg border border-border object-cover" />
                                                                                        </a>
                                                                                    ) : (
                                                                                        <div key={photo.id} className="flex size-16 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">No URL</div>
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
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="mb-3.5 flex items-center gap-2.5">
                            <div className="h-5.5 w-1 rounded-full bg-amber-500" />
                            <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-300">Booking Edit Requests</h3>
                            {bookingEdits.length > 0 && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{bookingEdits.length}</Badge>}
                        </div>
                        {bookingEdits.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No booking edit requests pending.</CardContent></Card>
                        ) : (
                            <div className="flex flex-col gap-4">
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
                                        <Card key={req.id} className="border-l-4 border-l-amber-500">
                                            <CardContent className="flex flex-col gap-3.5 p-4.5">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-black text-foreground">Edit Request — {req.clientName}</span>
                                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{changes.length} change{changes.length === 1 ? "" : "s"}</Badge>
                                                        </div>
                                                        <RequesterLine req={req} />
                                                        <div className="mt-2"><BookingContext data={orig} /></div>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 dark:bg-amber-950/20">
                                                    <p className="mb-2.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">Requested Changes</p>
                                                    <ChangeDiff changes={changes} />
                                                </div>

                                                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                                                    <p className="mb-2.5 text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground">Admin Final Decision</p>
                                                    <div className="edit-req-decision-grid">
                                                        <div className="flex flex-col gap-1">
                                                            <Label className="text-xs font-bold">Final Job Status</Label>
                                                            <Select value={resolution.finalStatus} onValueChange={(v) => setEditRequestResolutions((prev) => ({ ...prev, [req.id]: { ...resolution, finalStatus: v } }))}>
                                                                <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <Label className="text-xs font-bold">Payment Status</Label>
                                                            <Select value={resolution.paymentStatus} onValueChange={(v) => setEditRequestResolutions((prev) => ({ ...prev, [req.id]: { ...resolution, paymentStatus: v } }))}>
                                                                <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                                                    <SelectItem value="paid">Paid</SelectItem>
                                                                    <SelectItem value="pending">Pending</SelectItem>
                                                                    <SelectItem value="redo">Redo</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <div className="edit-req-actions mt-3">
                                                        <Button size="sm" disabled={busy} onClick={() => resolveEdit(req.id, "approve")}>
                                                            {busy ? "Saving…" : <><Check className="size-3.5" /> Approve &amp; Merge</>}
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => resolveEdit(req.id, "reject")}>
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
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
