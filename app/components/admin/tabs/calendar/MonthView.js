"use client";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight, CalendarX2, CalendarPlus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { getStatusMeta } from "@/lib/bookingStatus";
import { getZonedDateKey, formatZonedDate, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { timeSortKey } from "@/lib/bookingTime";
import JobCard from "./JobCard";

const MAX_DOTS = 4;

// Calendar-grid days from react-day-picker are plain local Date objects with
// no real "instant" meaning — just a Y/M/D box on a grid. Reading/writing
// them via their local getters (not any UTC/zone conversion) is the correct
// way to match them against booking.date's "YYYY-MM-DD" keys, which are
// already branch-local per lib/timezone.js. This sidesteps timezone bugs
// entirely rather than risking one.
function dateToKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function keyToDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// Module-level, not inline JSX — react-day-picker treats `components.*`
// values as component TYPES, so a fresh function reference on every render
// (which an inline arrow inside MonthView's JSX would be) makes it remount
// every day cell on every render, not just re-render them.
function MonthChevron({ orientation, ...p }) {
    return orientation === "left" ? <ChevronLeft className="size-4" {...p} /> : <ChevronRight className="size-4" {...p} />;
}

function MonthDayButton({ day, modifiers, className, bookingsByDate, openNewBookingCommand, onGoToDay, ...props }) {
    const dateKey = dateToKey(day.date);
    const dayBookings = bookingsByDate.get(dateKey) || [];
    const dots = dayBookings.slice(0, MAX_DOTS);
    const overflow = dayBookings.length - dots.length;

    const button = (
        <button
            type="button"
            data-day={dateKey}
            className={cn(
                "flex size-full min-h-14 flex-col items-start gap-1.5 p-1.5 text-left transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 sm:min-h-20 sm:p-2 lg:min-h-24 lg:p-2.5",
                modifiers.selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                modifiers.today && !modifiers.selected && "bg-accent font-bold text-accent-foreground",
                modifiers.outside && "text-muted-foreground/40",
                className
            )}
            {...props}
        >
            <span className="text-sm font-semibold sm:text-base lg:text-lg">{day.date.getDate()}</span>
            {dots.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                    {dots.map((b, i) => (
                        <span
                            key={b.id || i}
                            className="size-1.5 rounded-full sm:size-2"
                            style={{ background: modifiers.selected ? "currentColor" : getStatusMeta(b.status).fill }}
                        />
                    ))}
                    {overflow > 0 && (
                        <span className="text-[10px] font-semibold leading-none opacity-80">+{overflow}</span>
                    )}
                </span>
            )}
        </button>
    );

    if (!openNewBookingCommand) return button;

    return (
        <ContextMenu>
            <ContextMenuTrigger className="contents">{button}</ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => openNewBookingCommand(dateKey)}>
                    <CalendarPlus /> New Booking
                </ContextMenuItem>
                {onGoToDay && (
                    <ContextMenuItem onClick={() => onGoToDay(dateKey)}>
                        <CalendarDays /> Go to Day
                    </ContextMenuItem>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
}

// Third Calendar tab — a big month grid (status-colored dots per day) with a
// side panel listing that day's jobs as cards. Read-only browse/lookup view,
// not a dispatch tool (no drag) — Board and Timeline already cover dispatch.
// Defaults to the branch's "today", not the viewer's device today, per this
// app's standing rule that anything tied to where the work happens must
// render in branch time.
export default function MonthView({
    bookings,
    isCleanerSelfServiceView,
    currentUser,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    openNewBookingCommand,
    onGoToDay,
    branchTimezone = DEFAULT_TIMEZONE,
}) {
    const todayKey = useMemo(() => getZonedDateKey(new Date(), branchTimezone), [branchTimezone]);
    const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
    const [month, setMonth] = useState(() => keyToDate(todayKey));

    const scopedBookings = useMemo(() => {
        const notArchived = bookings.filter(b => !b.archived && b.status !== "Cancelled");
        if (!isCleanerSelfServiceView) return notArchived;
        return notArchived.filter(b => (b.assignedStaffIds || []).includes(currentUser?.uid));
    }, [bookings, isCleanerSelfServiceView, currentUser]);

    const bookingsByDate = useMemo(() => {
        const map = new Map();
        scopedBookings.forEach(b => {
            const list = map.get(b.date) || [];
            list.push(b);
            map.set(b.date, list);
        });
        map.forEach(list => list.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time)));
        return map;
    }, [scopedBookings]);

    const selectedBookings = bookingsByDate.get(selectedDateKey) || [];
    const selectedDate = useMemo(() => keyToDate(selectedDateKey), [selectedDateKey]);
    const isToday = selectedDateKey === todayKey;

    const dayPickerComponents = useMemo(() => ({
        Chevron: MonthChevron,
        DayButton: (p) => (
            <MonthDayButton
                {...p}
                bookingsByDate={bookingsByDate}
                openNewBookingCommand={!isCleanerSelfServiceView ? openNewBookingCommand : undefined}
                onGoToDay={!isCleanerSelfServiceView ? onGoToDay : undefined}
            />
        ),
    }), [bookingsByDate, openNewBookingCommand, onGoToDay, isCleanerSelfServiceView]);

    return (
        <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative rounded-lg border border-border bg-card p-3 sm:p-4 lg:flex-1">
                <DayPicker
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDateKey(dateToKey(d))}
                    today={keyToDate(todayKey)}
                    showOutsideDays
                    className="w-full"
                    classNames={{
                        months: "w-full",
                        month: "w-full flex flex-col gap-3",
                        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-9 z-10 px-0.5",
                        month_caption: "flex h-9 items-center justify-center text-base font-bold sm:text-lg",
                        button_previous: "flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted",
                        button_next: "flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted",
                        month_grid: "w-full table-fixed border-collapse",
                        weekday: "border-b border-border pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs",
                        day: "border border-border/60 p-0 align-top",
                    }}
                    components={dayPickerComponents}
                />
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-80 lg:shrink-0">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">
                        {formatZonedDate(new Date(`${selectedDateKey}T12:00:00`), { weekday: "long", month: "long", day: "numeric" }, branchTimezone)}
                    </h4>
                    {isToday && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Today</span>}
                </div>

                <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto lg:max-h-[36rem]">
                    {selectedBookings.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
                            <CalendarX2 className="size-6" />
                            <p className="text-xs">No jobs on this date.</p>
                        </div>
                    ) : (
                        selectedBookings.map(b => (
                            <JobCard
                                key={b.id}
                                booking={b}
                                variant="board"
                                isCleanerSelfServiceView={isCleanerSelfServiceView}
                                getBookingCustomerFirstName={getBookingCustomerFirstName}
                                setSelectedBooking={setSelectedBooking}
                                setDetailsModalOpen={setDetailsModalOpen}
                                openEditBookingModal={openEditBookingModal}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
