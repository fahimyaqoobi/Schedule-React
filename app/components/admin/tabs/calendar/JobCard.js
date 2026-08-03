"use client";
import { forwardRef } from "react";
import { MapPin, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStatusMeta } from "@/lib/bookingStatus";
import StaffAvatarStack from "./StaffAvatarStack";

// Shared presentational booking card used by both the Board (Kanban) and
// Timeline views. Colored by status per the request to color the whole
// card, not just a small badge — a status pill is still shown on top of
// that fill so the status reads clearly even for colorblind viewers or in
// a screenshot, and so it's legible in Timeline cells where several
// different statuses can appear side by side under one staff/day header.
//
// No drag logic lives here — the parent wraps this in dnd-kit's
// useDraggable and forwards {attributes, listeners} as `dragHandleProps`
// plus the ref/transform `style`. When `dragHandleProps` is omitted the
// card renders as a plain, non-draggable card (self-service views).
const JobCard = forwardRef(function JobCard({
    booking,
    variant = "board", // "board" | "timeline"
    isCleanerSelfServiceView,
    getBookingCustomerFirstName,
    setSelectedBooking,
    setDetailsModalOpen,
    openEditBookingModal,
    isDragging = false,
    dragHandleProps,
    style,
}, ref) {
    const meta = getStatusMeta(booking.status);
    const clientLabel = isCleanerSelfServiceView
        ? getBookingCustomerFirstName(booking)
        : (booking.clientName || getBookingCustomerFirstName(booking));
    const isCompact = variant === "timeline";

    return (
        <div
            ref={ref}
            style={{ background: meta.fill, borderColor: meta.fill, color: meta.fillText, ...style }}
            {...(dragHandleProps || {})}
            className={cn(
                "flex flex-col gap-1 rounded-lg border shadow-sm",
                isCompact ? "p-2" : "p-3",
                dragHandleProps && "cursor-grab touch-none active:cursor-grabbing",
                isDragging && "opacity-40"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate font-bold", isCompact ? "text-xs" : "text-sm")}>{clientLabel}</span>
                <span className={cn("shrink-0 font-semibold opacity-90", isCompact ? "text-[10px]" : "text-xs")}>{booking.time}</span>
            </div>

            <span
                className={cn("inline-flex w-fit items-center rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide", isCompact ? "text-[8px]" : "text-[9px]")}
                style={{ background: "rgba(255,255,255,0.25)" }}
            >
                {meta.label}
            </span>

            <div className={cn("opacity-90", isCompact ? "text-[10px]" : "text-xs")}>
                {booking.service}{!isCompact && booking.duration ? ` (${booking.duration} hrs)` : ""}
            </div>

            {!isCompact && booking.address1 && (
                <div className="flex items-center gap-1 text-xs opacity-80">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{booking.address1}</span>
                </div>
            )}

            <div className="mt-1 flex items-center justify-between gap-2 border-t pt-1.5" style={{ borderColor: "rgba(255,255,255,0.35)" }}>
                <StaffAvatarStack staff={booking.assignedStaff || []} size={isCompact ? 18 : 24} max={3} emptyLabel="" />
                <div className="flex items-center gap-0.5" onPointerDown={e => e.stopPropagation()}>
                    <Button
                        variant="ghost" size="icon-xs" className="text-current hover:bg-white/20 hover:text-current"
                        onClick={() => { setSelectedBooking(booking); setDetailsModalOpen(true); }}
                    >
                        <Eye className="size-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon-xs" className="text-current hover:bg-white/20 hover:text-current"
                        onClick={() => openEditBookingModal(booking)}
                    >
                        <Pencil className="size-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
});

export default JobCard;
