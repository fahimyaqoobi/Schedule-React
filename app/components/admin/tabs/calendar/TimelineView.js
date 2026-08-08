"use client";
import { useState, useMemo, useEffect, Fragment } from "react";
import {
    DndContext, DragOverlay, useDraggable, useDroppable,
    PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import {
    ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
    ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { ChevronLeft, ChevronRight, Pencil, Ban, UserRoundCog, CircleDollarSign, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import JobCard from "./JobCard";
import StaffAvatarStack from "./StaffAvatarStack";
import { applyTimelineDrag, applyStaffReassignDrag, applyStatusDrag } from "./dragHandlers";
import { checkStaffAvailability, isStaffWorkingOnDate } from "@/lib/staffAvailability";
import { timeSortKey } from "@/lib/bookingTime";
import { BOOKING_STATUSES } from "@/lib/bookingStatus";
import { PAYMENT_STATUSES } from "@/lib/paymentStatus";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const UNASSIGNED_KEY = "__unassigned__";

const pad = n => String(n).padStart(2, "0");
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => { const x = new Date(d); const dow = x.getDay(); x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1)); return x; };
const shortLabel = d => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

function DraggableTimelineCard({ booking, staffUid, fieldStaff, handleQuickBookingUpdate, ...cardProps }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `${booking.id}::${staffUid || UNASSIGNED_KEY}`,
        data: { bookingId: booking.id, fromUid: staffUid || null, fromDate: booking.date },
    });
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
        : undefined;

    const card = (
        <JobCard
            ref={setNodeRef} booking={booking} variant="timeline" style={style}
            dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} {...cardProps}
        />
    );

    if (!handleQuickBookingUpdate) return card;

    return (
        <ContextMenu>
            {/* Only swallow a right-click's pointerdown (button 2) — a plain
                left-click pointerdown must still reach dnd-kit's listeners
                spread onto the card by JobCard, or dragging breaks. */}
            <ContextMenuTrigger className="contents" onPointerDown={(e) => { if (e.button === 2) e.stopPropagation(); }}>
                {card}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => cardProps.openEditBookingModal(booking)}>
                    <Pencil /> Edit Booking
                </ContextMenuItem>
                <ContextMenuSub>
                    <ContextMenuSubTrigger><Tag /> Change Status</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        {BOOKING_STATUSES.map(s => (
                            <ContextMenuItem key={s.value} onClick={() => applyStatusDrag(booking, s.value, handleQuickBookingUpdate)}>
                                {s.label}
                            </ContextMenuItem>
                        ))}
                    </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSub>
                    <ContextMenuSubTrigger><CircleDollarSign /> Payment Status</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                        {PAYMENT_STATUSES.map(p => (
                            <ContextMenuItem key={p.value} onClick={() => handleQuickBookingUpdate(booking.id, { paymentStatus: p.value })}>
                                {p.label}
                            </ContextMenuItem>
                        ))}
                    </ContextMenuSubContent>
                </ContextMenuSub>
                {fieldStaff && fieldStaff.length > 0 && (
                    <ContextMenuSub>
                        <ContextMenuSubTrigger><UserRoundCog /> Reassign Staff</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                            {fieldStaff.map(m => (
                                <ContextMenuItem
                                    key={m.uid}
                                    disabled={m.uid === staffUid}
                                    onClick={() => applyStaffReassignDrag(booking, staffUid || null, m.uid, fieldStaff, handleQuickBookingUpdate)}
                                >
                                    {m.name || m.displayName || m.email}
                                </ContextMenuItem>
                            ))}
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                        if (window.confirm("Cancel this booking?")) applyStatusDrag(booking, "Cancelled", handleQuickBookingUpdate);
                    }}
                >
                    <Ban /> Cancel Booking
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

// A cell is "off" when the staff member's own weekly schedule doesn't work
// this date at all (day disabled, or the date is in their blockedDates) —
// shift-specific mismatches (e.g. works mornings, card is an evening job)
// are still caught at drop-time in handleDragEnd, since that depends on the
// specific booking being dragged, not the cell itself. The Unassigned
// column is never "off" — it's not a real person's schedule.
function TimelineCell({ staffUid, staffMember, dateStr, bookings, cardProps, draggable, openNewBookingCommand }) {
    const dayCheck = staffUid ? isStaffWorkingOnDate(staffMember, dateStr) : { available: true };
    const isOff = !dayCheck.available;
    const { setNodeRef, isOver } = useDroppable({ id: `${staffUid || UNASSIGNED_KEY}::${dateStr}`, disabled: !draggable || isOff });
    // Empty cells double as an "Add Booking" target — click gets the wizard's
    // checkout step to open pre-scoped to this exact date + staff, matching
    // what a sales rep scanning the Timeline for an open slot actually wants.
    const isEmptyAddable = draggable && !isOff && bookings.length === 0 && Boolean(openNewBookingCommand);
    return (
        <div
            ref={draggable ? setNodeRef : undefined}
            title={isOff ? dayCheck.reason : (isEmptyAddable ? "Click to add a booking" : undefined)}
            onClick={isEmptyAddable ? () => openNewBookingCommand(dateStr, staffUid || undefined) : undefined}
            className={cn(
                "flex min-h-20 flex-col gap-1.5 rounded-lg border border-dashed border-border/60 p-1.5 transition-colors",
                isOver && "border-primary bg-primary/5",
                isEmptyAddable && "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
                isOff && "cursor-not-allowed border-none bg-[repeating-linear-gradient(135deg,var(--color-muted-foreground)_0px,var(--color-muted-foreground)_5px,var(--color-muted)_5px,var(--color-muted)_10px)] opacity-80 dark:opacity-90"
            )}
        >
            {bookings.map(b => (
                draggable
                    ? <DraggableTimelineCard key={b.id} booking={b} staffUid={staffUid} {...cardProps} />
                    : <JobCard key={b.id} booking={b} variant="timeline" {...cardProps} />
            ))}
        </div>
    );
}

// Staff × day scheduling grid — drag a card to a different staff column
// and/or date row to reassign staff and/or reschedule. Rows are the branch
// calendar days in the selected Day/Week/Month range; columns are field
// staff plus a synthetic "Unassigned" column first. Cards are grouped into
// each cell as a simple time-ordered stack rather than pixel-positioned by
// exact minute — this app's real scheduling granularity is a date + a
// discrete time slot, not continuous minutes, so a stacked list carries the
// same information with far less layout complexity and degrades to mobile
// trivially.
export default function TimelineView({
    bookings,
    fieldStaff,
    isCleanerSelfServiceView,
    currentUser,
    handleQuickBookingUpdate,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    openNewBookingCommand,
    pendingTimelineAnchor,
    clearPendingTimelineAnchor,
    branchTimezone,
}) {
    const [nav, setNav] = useState("week");
    const [anchor, setAnchor] = useState(() => new Date());
    const [activeDrag, setActiveDrag] = useState(null);
    const [mobileStaffKey, setMobileStaffKey] = useState(UNASSIGNED_KEY);
    const isMobile = useIsMobile();

    // Consumes a "Go to Day" request from MonthView's context menu — jumps
    // the Day/Week/Month nav to Day mode anchored on that date, then clears
    // the request so re-visiting this tab later doesn't keep re-anchoring.
    useEffect(() => {
        if (!pendingTimelineAnchor) return;
        const [y, m, d] = pendingTimelineAnchor.split("-").map(Number);
        setAnchor(new Date(y, m - 1, d));
        setNav("day");
        clearPendingTimelineAnchor?.();
    }, [pendingTimelineAnchor, clearPendingTimelineAnchor]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: branchTimezone || "America/Toronto" });
    const draggable = !isCleanerSelfServiceView;

    const navigate = dir => {
        setAnchor(prev => {
            if (nav === "day") return addDays(prev, dir);
            if (nav === "week") return addDays(prev, dir * 7);
            const next = new Date(prev);
            next.setDate(1);
            next.setMonth(next.getMonth() + dir);
            return next;
        });
    };

    const dateRange = useMemo(() => {
        if (nav === "day") return [new Date(anchor)];
        if (nav === "week") {
            const start = mondayOf(anchor);
            return Array.from({ length: 7 }, (_, i) => addDays(start, i));
        }
        const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1));
    }, [nav, anchor]);

    const rangeLabel = useMemo(() => {
        if (nav === "day") return `${DAY_NAMES[(anchor.getDay() + 6) % 7]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
        if (nav === "week") {
            const start = mondayOf(anchor);
            const end = addDays(start, 6);
            return `${shortLabel(start)} – ${shortLabel(end)}, ${end.getFullYear()}`;
        }
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
    }, [nav, anchor]);

    const staffColumns = useMemo(() => {
        const base = (fieldStaff || []).map(m => ({ uid: m.uid, name: m.name || m.displayName || m.email || "Staff", photoURL: m.photoURL || "" }));
        return [{ uid: null, name: "Unassigned", photoURL: "" }, ...base];
    }, [fieldStaff]);

    // Full member records (with staffProfile.availability), keyed by uid —
    // staffColumns above is a stripped-down {uid,name,photoURL} shape for
    // headers/avatars, but availability checks need the real profile.
    const staffByUid = useMemo(() => {
        const map = {};
        (fieldStaff || []).forEach(m => { map[m.uid] = m; });
        return map;
    }, [fieldStaff]);

    const scopedStaffColumns = useMemo(() => {
        if (!isCleanerSelfServiceView) return staffColumns;
        return staffColumns.filter(s => s.uid === currentUser?.uid);
    }, [staffColumns, isCleanerSelfServiceView, currentUser]);

    // grid[staffKey][dateStr] = [bookings...] — a multi-assigned booking
    // appears once per assigned staff member, since each staff column is
    // that person's own day, not a shared view of the booking.
    const grid = useMemo(() => {
        const map = {};
        staffColumns.forEach(s => { map[s.uid || UNASSIGNED_KEY] = {}; });
        const rangeSet = new Set(dateRange.map(toDateStr));
        (bookings || []).forEach(b => {
            if (!rangeSet.has(b.date) || b.status === "Cancelled" || b.archived) return;
            const staffIds = (b.assignedStaffIds && b.assignedStaffIds.length) ? b.assignedStaffIds : [null];
            staffIds.forEach(uid => {
                const key = uid || UNASSIGNED_KEY;
                if (!map[key]) map[key] = {};
                (map[key][b.date] = map[key][b.date] || []).push(b);
            });
        });
        Object.values(map).forEach(byDate => Object.values(byDate).forEach(list => list.sort((a, b) => timeSortKey(a.time) - timeSortKey(b.time))));
        return map;
    }, [bookings, staffColumns, dateRange]);

    // Staff rows sort assigned-first, then open (working but idle), then
    // unavailable — each bucket judged across the WHOLE visible Day/Week/
    // Month range, not just a single day, since a person's schedule can
    // vary day to day: someone with a job on any visible day is "assigned",
    // someone with none but who works at least one visible day is "open",
    // and someone off every visible day (e.g. on leave that week) sorts
    // last. Recomputes automatically when the range or view changes.
    // Unassigned is a bucket, not a person — always pinned first.
    const sortedStaffRows = useMemo(() => {
        const unassignedRow = scopedStaffColumns.filter(s => !s.uid);
        const dayKeys = dateRange.map(toDateStr);
        const staffRows = scopedStaffColumns
            .filter(s => s.uid)
            .map(s => {
                const hasAssignment = dayKeys.some(dStr => (grid[s.uid]?.[dStr] || []).length > 0);
                const worksAnyDay = dayKeys.some(dStr => isStaffWorkingOnDate(staffByUid[s.uid], dStr).available);
                const bucket = hasAssignment ? 0 : worksAnyDay ? 1 : 2;
                return { ...s, bucket };
            })
            .sort((a, b) => a.bucket - b.bucket || a.name.localeCompare(b.name));
        return [...unassignedRow, ...staffRows];
    }, [scopedStaffColumns, grid, dateRange, staffByUid]);

    const cardProps = {
        isCleanerSelfServiceView, getBookingCustomerFirstName, setSelectedBooking, setDetailsModalOpen, openEditBookingModal,
        fieldStaff, handleQuickBookingUpdate,
    };

    function handleDragStart(event) {
        const { bookingId, fromUid } = event.active.data.current;
        const booking = (bookings || []).find(b => b.id === bookingId);
        setActiveDrag(booking ? { booking, staffUid: fromUid } : null);
    }

    async function handleDragEnd(event) {
        setActiveDrag(null);
        const { active, over } = event;
        if (!over) return;
        const { bookingId, fromUid, fromDate } = active.data.current;
        const [toUidRaw, toDate] = String(over.id).split("::");
        const toUid = toUidRaw === UNASSIGNED_KEY ? null : toUidRaw;
        if (toUid === fromUid && toDate === fromDate) return;
        const booking = (bookings || []).find(b => b.id === bookingId);
        if (!booking) return;

        // Block the drop if the target staff member's own weekly schedule
        // has this day/shift off, or they've blocked this specific date —
        // dropping a job on an off day should never silently assign it.
        if (toUid) {
            const targetStaff = (fieldStaff || []).find(m => m.uid === toUid);
            const result = checkStaffAvailability(targetStaff, { ...booking, date: toDate });
            if (!result.available) {
                toast.error(result.reason || "This staff member isn't available then.");
                return;
            }
        }

        await applyTimelineDrag(booking, { fromUid, toUid, newDate: toDate }, fieldStaff || [], handleQuickBookingUpdate);
    }

    const NavHeader = (
        <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
                {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, label]) => (
                    <button
                        key={id} onClick={() => setNav(id)}
                        className={cn("rounded-md px-3.5 py-1.5 text-xs font-bold", nav === id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
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
    );

    // Mobile: a wide multi-staff-column grid doesn't work on a phone —
    // swap for a staff picker + that staff's day-by-day agenda list.
    if (isMobile) {
        const pickable = sortedStaffRows;
        const activeKey = isCleanerSelfServiceView ? (currentUser?.uid || UNASSIGNED_KEY) : mobileStaffKey;
        const hasAny = dateRange.some(d => (grid[activeKey]?.[toDateStr(d)] || []).length > 0);
        return (
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {!isCleanerSelfServiceView && (
                        <Select value={activeKey} onValueChange={setMobileStaffKey}>
                            <SelectTrigger className="w-44">
                                {/* Rendered explicitly rather than via SelectValue's
                                    auto-lookup, which only resolves a label once the
                                    popup has opened at least once — this needs to show
                                    the right name immediately on first paint. */}
                                <span data-slot="select-value" className="flex flex-1 text-left">
                                    {pickable.find(s => (s.uid || UNASSIGNED_KEY) === activeKey)?.name || "Select staff"}
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                {pickable.map(s => <SelectItem key={s.uid || UNASSIGNED_KEY} value={s.uid || UNASSIGNED_KEY}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                {NavHeader}
                <div className="flex flex-col gap-3">
                    {!hasAny && <div className="py-10 text-center text-xs text-muted-foreground">No jobs in this range.</div>}
                    {dateRange.map(d => {
                        const dStr = toDateStr(d);
                        const dayBookings = grid[activeKey]?.[dStr] || [];
                        if (dayBookings.length === 0) return null;
                        return (
                            <div key={dStr}>
                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    {shortLabel(d)}{dStr === todayStr ? " · Today" : ""}
                                </p>
                                <div className="flex flex-col gap-2">
                                    {dayBookings.map(b => <JobCard key={b.id} booking={b} variant="board" {...cardProps} />)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const gridContent = (
        <div className="overflow-x-auto">
            <div className="grid gap-1" style={{ gridTemplateColumns: `170px repeat(${dateRange.length}, minmax(150px, 1fr))` }}>
                <div className="sticky left-0 z-10 bg-card" />
                {dateRange.map(d => {
                    const dStr = toDateStr(d);
                    const isToday = dStr === todayStr;
                    return (
                        <div key={dStr} className={cn(
                            "flex flex-col items-center justify-center gap-0.5 rounded-t-lg border-b-2 border-border bg-muted/50 px-1 py-2 text-center",
                            isToday && "text-primary"
                        )}>
                            <span className="text-[10px] font-bold uppercase tracking-wide">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                            <span className={cn("text-sm font-extrabold", isToday && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{d.getDate()}</span>
                        </div>
                    );
                })}
                {sortedStaffRows.map(s => (
                    <Fragment key={s.uid || UNASSIGNED_KEY}>
                        <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-border bg-card px-2.5 py-2">
                            <StaffAvatarStack staff={s.uid ? [s] : []} size={22} max={1} emptyLabel="—" />
                            <span className="truncate text-xs font-bold text-foreground">{s.name}</span>
                        </div>
                        {dateRange.map(d => {
                            const dStr = toDateStr(d);
                            return (
                                <div key={dStr} className="border-b border-border pb-1">
                                    <TimelineCell
                                        staffUid={s.uid} staffMember={staffByUid[s.uid]} dateStr={dStr}
                                        bookings={grid[s.uid || UNASSIGNED_KEY]?.[dStr] || []}
                                        cardProps={cardProps} draggable={draggable}
                                        openNewBookingCommand={openNewBookingCommand}
                                    />
                                </div>
                            );
                        })}
                    </Fragment>
                ))}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            {NavHeader}
            {draggable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    {gridContent}
                    <DragOverlay>
                        {activeDrag ? <JobCard booking={activeDrag.booking} variant="timeline" {...cardProps} /> : null}
                    </DragOverlay>
                </DndContext>
            ) : gridContent}
        </div>
    );
}
