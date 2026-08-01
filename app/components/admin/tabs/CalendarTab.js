"use client";
import { ChevronLeft, ChevronRight, MapPin, Eye, Pencil } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function CalendarTab({
    monthNames,
    currentCalMonth,
    calendarDays,
    bookings,
    selectedCalDate,
    isCleanerSelfServiceView,
    teams,
    agendaBookings,
    changeMonth,
    setSelectedCalDate,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
}) {
    return (
        <div className="animate-fade grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="gap-3">
                <CardHeader className="flex-row items-center justify-between gap-3">
                    <CardTitle className="text-base">Calendar Dispatch Matrix</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => changeMonth(-1)}><ChevronLeft className="size-4" /></Button>
                        <span className="min-w-32 text-center text-sm font-bold text-foreground">{monthNames[currentCalMonth.getMonth()]} {currentCalMonth.getFullYear()}</span>
                        <Button variant="outline" size="icon-sm" onClick={() => changeMonth(1)}><ChevronRight className="size-4" /></Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1 border-t border-border pt-2">
                        {calendarDays.map((cell, idx) => {
                            if (!cell.day) return <div key={`empty-${idx}`} className="aspect-square" />;

                            // Admin calendar shows Confirmed (upcoming) and Completed (done)
                            // bookings — Cancelled or anything still Pending/Lead/Quote stays
                            // off the grid (this is a live filter, not a stored flag).
                            const dayBookings = bookings.filter(b => b.date === cell.dateStr && (isCleanerSelfServiceView ? true : ["Confirmed", "Completed"].includes(b.status)));
                            const isSelected = cell.dateStr === selectedCalDate;
                            const isToday = cell.dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });

                            return (
                                <button
                                    key={cell.dateStr}
                                    type="button"
                                    onClick={() => setSelectedCalDate(cell.dateStr)}
                                    className={cn(
                                        "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors",
                                        isSelected ? "border-primary bg-primary/10 font-bold text-primary" : "border-transparent hover:bg-muted",
                                        isToday && !isSelected && "border-primary/40 font-semibold text-primary"
                                    )}
                                >
                                    <span>{cell.day}</span>
                                    <div className="flex items-center gap-0.5">
                                        {dayBookings.slice(0, 3).map(b => (
                                            <span
                                                key={b.id}
                                                title={`${isCleanerSelfServiceView ? getBookingCustomerFirstName(b) : b.clientName} - ${b.service}${b.status === "Completed" ? " (Completed)" : ""}`}
                                                className={cn(
                                                    "size-1.5 rounded-full",
                                                    b.status === "Completed" ? "bg-muted-foreground/50" : "bg-primary"
                                                )}
                                            />
                                        ))}
                                        {dayBookings.length > 3 && <span className="text-[9px] font-bold text-muted-foreground">+{dayBookings.length - 3}</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card className="gap-3">
                <CardHeader className="flex-row items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Day agenda list</p>
                        <CardTitle className="text-sm">{selectedCalDate}</CardTitle>
                    </div>
                    <Badge variant="secondary">{agendaBookings.length} Job{agendaBookings.length === 1 ? '' : 's'}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    {agendaBookings.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">No dispatches scheduled on this date.</div>
                    ) : (
                        agendaBookings.map(b => (
                            <div key={b.id} className="rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-foreground">{isCleanerSelfServiceView ? getBookingCustomerFirstName(b) : b.clientName}</span>
                                    <span className="text-xs font-semibold text-muted-foreground">{b.time}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{b.service} ({b.duration} hrs)</div>
                                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="size-3 shrink-0" />
                                    <span className="truncate">{b.address1}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                                    <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon-xs" onClick={() => { setSelectedBooking(b); setDetailsModalOpen(true); }}><Eye className="size-3.5" /></Button>
                                        <Button variant="ghost" size="icon-xs" onClick={() => openEditBookingModal(b)}><Pencil className="size-3.5" /></Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
