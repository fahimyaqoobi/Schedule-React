"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Repeat, ChevronLeft, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

const FREQ_STYLES = {
    "Weekly": { badge: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30", dot: "bg-emerald-500" },
    "Bi-Weekly": { badge: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30", dot: "bg-blue-500" },
    "Monthly": { badge: "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30", dot: "bg-violet-500" },
};
const DEFAULT_FREQ_STYLE = { badge: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); const dow = x.getDay(); x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1)); return x; };
const shortLabel = (d) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

function timeSortKey(timeStr = "") {
    const m = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 9999;
    let h = parseInt(m[1]);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + parseInt(m[2]);
}

function freqStyle(b) {
    return FREQ_STYLES[b.frequency] || DEFAULT_FREQ_STYLE;
}

export default function RecurringTab({
    bookings,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    branchTimezone,
}) {
    const [view, setView] = useState("week");
    const [anchor, setAnchor] = useState(() => new Date());

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: branchTimezone || "America/Toronto" });

    const recurringBookings = useMemo(() =>
        (bookings || []).filter(b => (b.isRecurring || b.recurringSeriesId) && b.status !== "Cancelled"),
        [bookings]
    );

    const byDate = useMemo(() => {
        const map = {};
        recurringBookings.forEach(b => {
            if (!b.date) return;
            (map[b.date] = map[b.date] || []).push(b);
        });
        Object.values(map).forEach(list => list.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time)));
        return map;
    }, [recurringBookings]);

    const seriesCount = useMemo(() => {
        const ids = new Set();
        recurringBookings.forEach(b => ids.add(b.recurringSeriesId || b.id));
        return ids.size;
    }, [recurringBookings]);

    const navigate = (dir) => {
        setAnchor(prev => {
            if (view === "day") return addDays(prev, dir);
            if (view === "week") return addDays(prev, dir * 7);
            const next = new Date(prev);
            next.setDate(1);
            next.setMonth(next.getMonth() + dir);
            return next;
        });
    };

    const openDetails = (b) => {
        setSelectedBooking(b);
        setDetailsModalOpen(true);
    };

    const rangeLabel = (() => {
        if (view === "day") return `${DAY_NAMES[(anchor.getDay() + 6) % 7]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
        if (view === "week") {
            const start = mondayOf(anchor);
            const end = addDays(start, 6);
            return `${shortLabel(start)} – ${shortLabel(end)}, ${end.getFullYear()}`;
        }
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    })();

    const BookingCard = ({ b, compact = false }) => {
        const st = freqStyle(b);
        return (
            <button
                type="button"
                onClick={() => openDetails(b)}
                className={cn("mb-1.5 w-full rounded-lg border-l-4 text-left", st.badge, compact ? "px-2 py-1.5" : "px-3 py-2.5")}
            >
                <div className="flex items-center justify-between gap-1.5">
                    <span className={cn("font-extrabold", compact ? "text-[11px]" : "text-xs")}>{b.time || "TBD"}</span>
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-card text-[9px]">{b.frequency || "Recurring"}</Badge>
                </div>
                <div className={cn("mt-0.5 truncate font-bold text-foreground", compact ? "text-[11px]" : "text-[13px]")}>
                    {b.clientName || `${b.firstName || ""} ${b.lastName || ""}`.trim() || "Client"}
                </div>
                {!compact && (
                    <>
                        <div className="mt-0.5 truncate text-[11px] text-foreground/70">{b.service || ""}</div>
                        <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                            {[b.address1, b.city].filter(Boolean).join(", ")}
                        </div>
                        {(b.assignedStaff || []).length > 0 && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                                <User className="size-2.5" /> {(b.assignedStaff || []).map(s => (s.name || "").split(" ")[0]).filter(Boolean).join(", ")}
                            </div>
                        )}
                    </>
                )}
            </button>
        );
    };

    const weekDays = (() => {
        const start = mondayOf(anchor);
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    })();

    const monthCells = (() => {
        const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
        const leading = (first.getDay() + 6) % 7; // Monday-start offset
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push(null);
        for (let day = 1; day <= daysInMonth; day++) {
            cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
        }
        return cells;
    })();

    return (
        <div className="animate-fade">
            <Card className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                    <div>
                        <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-foreground"><Repeat className="size-4" /> Recurring Bookings</h4>
                        <p className="text-xs font-semibold text-muted-foreground">{seriesCount} active series · {recurringBookings.length} scheduled visits</p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2.5">
                        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                            {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setView(id)}
                                    className={cn(
                                        "rounded-md px-3.5 py-1.5 text-xs font-bold",
                                        view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
                        <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}><ChevronLeft className="size-4" /></Button>
                            <span className="min-w-42.5 text-center text-sm font-extrabold text-foreground">{rangeLabel}</span>
                            <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)}><ChevronRight className="size-4" /></Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 border-b border-border px-4 py-2.5">
                    {Object.entries(FREQ_STYLES).map(([freq, st]) => (
                        <span key={freq} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            <span className={cn("inline-block size-2.5 rounded-sm", st.dot)} />
                            {freq}
                        </span>
                    ))}
                </div>

                <CardContent className="p-4">
                    {recurringBookings.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Repeat className="mx-auto mb-2.5 size-8 opacity-50" />
                            <p className="text-sm font-bold text-foreground">No recurring bookings yet</p>
                            <p className="mt-1 text-xs">Turn on the "Recurring Booking" toggle on any booking or at checkout and it will appear here with its whole series.</p>
                        </div>
                    ) : view === "week" ? (
                        <div className="grid grid-cols-7 gap-2 overflow-x-auto">
                            {weekDays.map((d, i) => {
                                const dStr = toDateStr(d);
                                const isToday = dStr === todayStr;
                                const dayBookings = byDate[dStr] || [];
                                return (
                                    <div key={dStr} className="min-w-0">
                                        <div className={cn("mb-2 rounded-lg p-1.5 text-center", isToday ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground")}>
                                            <div className="text-[10px] font-bold uppercase opacity-75">{DAY_NAMES[i]}</div>
                                            <div className="text-lg font-extrabold">{d.getDate()}</div>
                                        </div>
                                        <div className="min-h-55">
                                            {dayBookings.map(b => <BookingCard key={b.id} b={b} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : view === "day" ? (
                        <div className="mx-auto max-w-xl">
                            {(byDate[toDateStr(anchor)] || []).length === 0 ? (
                                <div className="py-9 text-center text-sm text-muted-foreground">No recurring visits scheduled for this day.</div>
                            ) : (
                                (byDate[toDateStr(anchor)] || []).map(b => (
                                    <div key={b.id} className="relative">
                                        <BookingCard b={b} />
                                        <Button
                                            variant="outline" size="sm"
                                            className="absolute top-2.5 right-2.5"
                                            onClick={(e) => { e.stopPropagation(); openEditBookingModal(b); }}
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="mb-1.5 grid grid-cols-7 gap-1">
                                {DAY_NAMES.map(d => (
                                    <div key={d} className="text-center text-[10.5px] font-extrabold uppercase text-muted-foreground">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {monthCells.map((d, idx) => {
                                    if (!d) return <div key={`e-${idx}`} />;
                                    const dStr = toDateStr(d);
                                    const isToday = dStr === todayStr;
                                    const dayBookings = byDate[dStr] || [];
                                    return (
                                        <button
                                            key={dStr}
                                            type="button"
                                            onClick={() => { setAnchor(d); setView("day"); }}
                                            className={cn(
                                                "min-h-21 rounded-lg border p-1.5 text-left",
                                                isToday ? "border-primary bg-primary/5" : "border-border bg-card"
                                            )}
                                        >
                                            <div className={cn("text-[11px] font-extrabold", isToday ? "text-primary" : "text-foreground/70")}>{d.getDate()}</div>
                                            {dayBookings.slice(0, 2).map(b => {
                                                const st = freqStyle(b);
                                                return (
                                                    <div
                                                        key={b.id}
                                                        onClick={(e) => { e.stopPropagation(); openDetails(b); }}
                                                        className={cn("mt-0.5 truncate rounded border px-1 py-0.5 text-[9.5px] font-bold", st.badge)}
                                                    >
                                                        {(b.clientName || "").split(" ")[0] || "Client"} · {b.time || ""}
                                                    </div>
                                                );
                                            })}
                                            {dayBookings.length > 2 && (
                                                <div className="mt-0.5 text-[9px] font-bold text-muted-foreground">+{dayBookings.length - 2} more</div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
