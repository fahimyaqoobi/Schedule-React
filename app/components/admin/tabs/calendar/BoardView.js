"use client";
import { useState, useMemo } from "react";
import {
    DndContext, DragOverlay, useDraggable, useDroppable,
    PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOKING_STATUSES, getStatusMeta } from "@/lib/bookingStatus";
import { DATE_FILTER_OPTIONS, getDateRangeForPeriod, DEFAULT_TIMEZONE } from "@/lib/timezone";
import JobCard from "./JobCard";
import { applyStatusDrag } from "./dragHandlers";

function DraggableCard({ booking, ...cardProps }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: booking.id,
        data: { type: "board-card" },
    });
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
        : undefined;
    return (
        <JobCard
            ref={setNodeRef}
            booking={booking}
            style={style}
            dragHandleProps={{ ...attributes, ...listeners }}
            isDragging={isDragging}
            {...cardProps}
        />
    );
}

function StatusColumn({ status, bookings, cardProps, draggable }) {
    const meta = getStatusMeta(status.value);
    const { setNodeRef, isOver } = useDroppable({ id: status.value, disabled: !draggable });
    return (
        <div className="flex w-[82vw] max-w-96 shrink-0 snap-start flex-col rounded-xl border border-border bg-muted/30 sm:w-72 lg:w-80">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.fill }} />
                    <span className="text-xs font-bold text-foreground">{status.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{bookings.length}</Badge>
            </div>
            <div
                ref={draggable ? setNodeRef : undefined}
                className={cn(
                    "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2.5 transition-colors",
                    isOver && "bg-primary/10"
                )}
                style={{ maxHeight: "min(calc(100vh - 340px), 60vh)" }}
            >
                {bookings.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-6 text-center text-[11px] text-muted-foreground">No jobs</div>
                ) : bookings.map(b => (
                    draggable
                        ? <DraggableCard key={b.id} booking={b} {...cardProps} />
                        : <JobCard key={b.id} booking={b} {...cardProps} />
                ))}
            </div>
        </div>
    );
}

// Kanban-style status board — one column per real booking status, drag a
// card between columns to change status. Cleaner self-service view gets a
// read-only variant (own jobs only, no DndContext/drag at all) — status
// changes for field staff belong to the job clock-in/clock-out flow, not
// free-form dispatch.
export default function BoardView({
    bookings,
    isCleanerSelfServiceView,
    currentUser,
    handleQuickBookingUpdate,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    branchTimezone = DEFAULT_TIMEZONE,
}) {
    const [hideCancelled, setHideCancelled] = useState(true);
    const [dateFilter, setDateFilter] = useState("all");
    const [activeBooking, setActiveBooking] = useState(null);
    const [pendingMessage, setPendingMessage] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const draggable = !isCleanerSelfServiceView;

    const scopedBookings = useMemo(() => {
        const base = isCleanerSelfServiceView
            ? bookings.filter(b => (b.assignedStaffIds || []).includes(currentUser?.uid))
            : bookings;
        const range = getDateRangeForPeriod(dateFilter, branchTimezone);
        if (!range) return base;
        return base.filter(b => b.date >= range.startKey && b.date <= range.endKey);
    }, [bookings, isCleanerSelfServiceView, currentUser, dateFilter, branchTimezone]);

    const columns = useMemo(
        () => BOOKING_STATUSES.filter(s => !(hideCancelled && s.value === "Cancelled")),
        [hideCancelled]
    );

    const byStatus = useMemo(() => {
        const map = Object.fromEntries(BOOKING_STATUSES.map(s => [s.value, []]));
        scopedBookings.forEach(b => { if (map[b.status]) map[b.status].push(b); });
        Object.values(map).forEach(list => list.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
        return map;
    }, [scopedBookings]);

    const cardProps = { variant: "board", isCleanerSelfServiceView, getBookingCustomerFirstName, setSelectedBooking, setDetailsModalOpen, openEditBookingModal };

    function handleDragStart(event) {
        setActiveBooking(scopedBookings.find(b => b.id === event.active.id) || null);
    }

    async function handleDragEnd(event) {
        setActiveBooking(null);
        const { active, over } = event;
        if (!over) return;
        const booking = scopedBookings.find(b => b.id === active.id);
        if (!booking || booking.status === over.id) return;
        const result = await applyStatusDrag(booking, over.id, handleQuickBookingUpdate);
        if (result?.pending) {
            setPendingMessage(result.message || "Change sent to Admin inbox for approval.");
            setTimeout(() => setPendingMessage(""), 4000);
        }
    }

    const columnsRow = (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {columns.map(status => (
                <StatusColumn key={status.value} status={status} bookings={byStatus[status.value] || []} cardProps={cardProps} draggable={draggable} />
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="h-8 w-full min-w-[9.5rem] text-xs sm:w-auto">
                            <div className="flex items-center gap-1.5">
                                <CalendarRange className="size-3.5 text-muted-foreground" />
                                <span data-slot="select-value">
                                    {DATE_FILTER_OPTIONS.find(o => o.value === dateFilter)?.label || "All Time"}
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent align="start" alignItemWithTrigger={false}>
                            {DATE_FILTER_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Switch checked={!hideCancelled} onCheckedChange={v => setHideCancelled(!v)} />
                        Show Cancelled
                    </label>
                </div>
                {pendingMessage && <span className="text-xs font-semibold text-amber-600">{pendingMessage}</span>}
            </div>

            {draggable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    {columnsRow}
                    <DragOverlay>
                        {activeBooking ? <JobCard booking={activeBooking} {...cardProps} /> : null}
                    </DragOverlay>
                </DndContext>
            ) : columnsRow}
        </div>
    );
}
