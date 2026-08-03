"use client";
import { forwardRef } from "react";
import { Mail, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStageMeta, WORKER_TYPE_OPTIONS } from "@/lib/hiringPipeline";

function roleLabel(value) {
    return WORKER_TYPE_OPTIONS.find(o => o.value === value)?.label || value;
}

// Candidate card for the Hiring Pipeline board — mirrors calendar/JobCard.js
// (full-card status coloring, no drag logic inside; the parent wraps this in
// dnd-kit's useDraggable and forwards dragHandleProps/style).
const ApplicationCard = forwardRef(function ApplicationCard({
    application,
    onOpen,
    isDragging = false,
    dragHandleProps,
    style,
}, ref) {
    const meta = getStageMeta(application.status);

    return (
        <div
            ref={ref}
            style={{ background: meta.fill, borderColor: meta.fill, color: meta.fillText, ...style }}
            {...(dragHandleProps || {})}
            onClick={() => onOpen?.(application)}
            className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 shadow-sm",
                dragHandleProps && "cursor-grab touch-none active:cursor-grabbing",
                isDragging && "opacity-40"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold">{application.personal?.legalName || "Unnamed candidate"}</span>
            </div>
            <span
                className="inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: "rgba(255,255,255,0.25)" }}
            >
                {roleLabel(application.workerTypeInterest)}
            </span>
            <div className="mt-0.5 flex flex-col gap-0.5 text-xs opacity-90">
                {application.personal?.email && (
                    <div className="flex items-center gap-1"><Mail className="size-3 shrink-0" /><span className="truncate">{application.personal.email}</span></div>
                )}
                {application.personal?.phone && (
                    <div className="flex items-center gap-1"><Phone className="size-3 shrink-0" /><span className="truncate">{application.personal.phone}</span></div>
                )}
                {application.personal?.city && (
                    <div className="flex items-center gap-1"><MapPin className="size-3 shrink-0" /><span className="truncate">{application.personal.city}</span></div>
                )}
            </div>
        </div>
    );
});

export default ApplicationCard;
