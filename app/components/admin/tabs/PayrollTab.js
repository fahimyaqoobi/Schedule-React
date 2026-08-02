"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { calculatePayrollBreakdown, getPayPeriod } from "../../../../lib/payroll";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight, ChevronRight as ExpandChevron, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtMin(mins) {
    if (!mins) return "0h";
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_STYLE = {
    pending: "border-amber-300 bg-amber-100 text-amber-800",
    processing: "border-blue-300 bg-blue-100 text-blue-800",
    paid: "border-emerald-300 bg-emerald-100 text-emerald-800",
};
const STATUS_LABEL = { pending: "Pending", processing: "Processing", paid: "Paid ✓" };

const COLS = "1fr 90px 90px 80px 110px 168px";

export default function PayrollTab({
    timeEntries,
    allFieldStaff,
    isSuperAdmin,
    getAuthHeaders,
    currentUser,
    syncDatabaseData,
}) {
    const [periodOffset, setPeriodOffset] = useState(0);
    const [expanded, setExpanded] = useState(new Set());
    const [statusMap, setStatusMap] = useState({});
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [downloadingUid, setDownloadingUid] = useState(null);

    const period = useMemo(() => getPayPeriod(periodOffset), [periodOffset]);

    const periodsBack = Math.abs(Math.min(0, periodOffset));
    const isVeryOld = periodsBack > 13; // > ~6 months

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

    const rows = useMemo(() => {
        const startMs = period.periodStart.getTime();
        const endMs = period.cutoffDate.getTime();

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
        headcount: rows.length,
        totalMinutes: rows.reduce((s, r) => s + r.totalMinutes, 0),
        totalGross: rows.reduce((s, r) => s + r.breakdown.grossPay, 0),
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

    const handleDownloadPaystub = useCallback(async (uid, name) => {
        setDownloadingUid(uid);
        setFeedback("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/payroll/paystub?cleanerUid=${encodeURIComponent(uid)}&periodKey=${encodeURIComponent(period.key)}`, { headers });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate paystub.");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const safeName = (name || "employee").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
            const link = document.createElement("a");
            link.href = url;
            link.download = `${safeName}-paystub-${period.key}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setFeedback(`Error: ${err.message}`);
        } finally {
            setDownloadingUid(null);
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
        <div className="animate-fade tc-page mx-auto max-w-360">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-xl font-bold text-foreground">Payroll</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Per-person biweekly compensation — hours pulled from approved time cards.</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button variant="outline" size="sm" onClick={handleExportCsv}><Download className="size-3.5" /> Export CSV</Button>
                    <Button variant="outline" size="sm" onClick={() => syncDatabaseData(currentUser)}>Refresh</Button>
                </div>
            </div>

            <Card className="mb-5">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2.5">
                        <Button variant="outline" size="icon-sm" onClick={() => setPeriodOffset(p => p - 1)} title="Previous period"><ChevronLeft className="size-4" /></Button>
                        <div className="min-w-50 text-center">
                            <p className="text-sm font-bold text-foreground">{period.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Pay date: {period.payDateFull}</p>
                        </div>
                        <Button
                            variant="outline" size="icon-sm"
                            onClick={() => setPeriodOffset(p => Math.min(0, p + 1))}
                            disabled={periodOffset >= 0}
                            title="Next period"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: "Current", offset: 0 },
                            { label: "−3 months", offset: -6 },
                            { label: "−6 months", offset: -13 },
                        ].map(q => (
                            <Button
                                key={q.label}
                                size="sm"
                                variant={periodOffset === q.offset ? "default" : "secondary"}
                                onClick={() => setPeriodOffset(q.offset)}
                            >
                                {q.label}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="mb-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {[
                    { label: "Total Payroll", value: `$${totals.totalGross.toFixed(2)}` },
                    { label: "Hours Tracked", value: fmtMin(totals.totalMinutes) },
                    { label: "Staff Count", value: `${totals.headcount} people` },
                    { label: "Pay Date", value: period.payDateFull },
                ].map(s => (
                    <Card key={s.label}>
                        <CardContent className="p-3.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                            <p className="mt-1 text-lg font-bold text-foreground">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isVeryOld && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                    This period is older than 6 months. Use Export CSV above for archival records.
                </div>
            )}

            {feedback && (
                <div className="mb-3.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
                    {feedback}
                </div>
            )}

            {rows.length === 0 ? (
                <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">No approved time entries for this period.</CardContent></Card>
            ) : (
                <Card className="overflow-hidden p-0">
                    <div
                        className="pr-head grid gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                        style={{ gridTemplateColumns: COLS }}
                    >
                        <span>Staff</span>
                        <span className="text-right">Reg Hrs</span>
                        <span className="text-right">OT Hrs</span>
                        <span className="text-right">Rate</span>
                        <span className="text-right">Gross Pay</span>
                        <span className="text-center">Status / Actions</span>
                    </div>

                    {rows.map((row, i) => {
                        const isExp = expanded.has(row.uid);
                        const statusKey = row.record?.status || "pending";

                        return (
                            <div key={row.uid} className={cn(i < rows.length - 1 && "border-b border-border")}>
                                <div
                                    className="pr-row grid cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-muted/40"
                                    style={{ gridTemplateColumns: COLS }}
                                    onClick={() => toggleExpand(row.uid)}
                                >
                                    <div className="pr-staff flex items-center gap-2.5">
                                        <ExpandChevron className={cn("size-3 shrink-0 text-muted-foreground transition-transform", isExp && "rotate-90")} />
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{row.name}</p>
                                            <p className="text-xs text-muted-foreground">{fmtMin(row.totalMinutes)} total</p>
                                        </div>
                                    </div>
                                    <span className="pr-reg text-right text-sm font-semibold text-foreground">{row.breakdown.regularHours.toFixed(1)}h</span>
                                    <span className={cn("pr-ot text-right text-sm font-semibold", row.breakdown.overtimeHours > 0 ? "text-amber-600" : "text-foreground")}>
                                        {row.breakdown.overtimeHours.toFixed(1)}h
                                    </span>
                                    <span className="pr-rate text-right text-xs text-muted-foreground">${row.payRate.toFixed(2)}/h</span>
                                    <span className="pr-gross text-right text-base font-bold text-foreground">${row.breakdown.grossPay.toFixed(2)}</span>

                                    <div className="pr-actions flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                                        <Badge variant="outline" className={cn("rounded-full", STATUS_STYLE[statusKey] || STATUS_STYLE.pending)}>
                                            {STATUS_LABEL[statusKey] || "Pending"}
                                        </Badge>
                                        {statusKey !== "paid" && (
                                            <Button size="sm" onClick={() => handleMarkStatus(row.uid, row.name, "paid")} disabled={saving}>Mark Paid</Button>
                                        )}
                                        {statusKey === "paid" && (
                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleMarkStatus(row.uid, row.name, "pending")} disabled={saving}>
                                                Undo
                                            </Button>
                                        )}
                                        <Button
                                            size="icon-sm"
                                            variant="outline"
                                            title={`Download ${row.name}'s paystub`}
                                            onClick={() => handleDownloadPaystub(row.uid, row.name)}
                                            disabled={downloadingUid === row.uid}
                                        >
                                            <FileDown className={cn("size-3.5", downloadingUid === row.uid && "animate-pulse")} />
                                        </Button>
                                    </div>
                                </div>

                                {isExp && (
                                    <div className="border-t border-border bg-muted/20 px-5 py-3.5 pl-12">
                                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Daily breakdown</p>
                                        {row.sortedDays.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No entries.</p>
                                        ) : row.sortedDays.map(([date, mins]) => (
                                            <div key={date} className="flex justify-between border-b border-border py-1.5 text-sm">
                                                <span className="text-foreground/80">
                                                    {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                                </span>
                                                <span className="font-semibold text-foreground">{fmtMin(mins)}</span>
                                            </div>
                                        ))}
                                        <div className="mt-3 flex justify-between border-t-2 border-border pt-2.5 text-sm font-bold">
                                            <span className="text-foreground">
                                                {row.breakdown.regularHours.toFixed(1)}h regular
                                                {row.breakdown.overtimeHours > 0 && ` + ${row.breakdown.overtimeHours.toFixed(1)}h overtime`}
                                            </span>
                                            <span className="text-foreground">${row.breakdown.grossPay.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="pr-foot grid items-center gap-4 border-t-2 border-border bg-muted/40 px-5 py-3.5" style={{ gridTemplateColumns: COLS }}>
                        <span className="pr-foot-label text-xs font-bold text-foreground/80">TOTAL — {totals.headcount} staff</span>
                        <span className="pr-foot-spacer" />
                        <span className="pr-foot-spacer" />
                        <span className="pr-foot-spacer" />
                        <span className="pr-foot-gross text-right text-base font-bold text-cyan-600">${totals.totalGross.toFixed(2)}</span>
                        <span className="pr-foot-spacer" />
                    </div>
                </Card>
            )}
        </div>
    );
}
