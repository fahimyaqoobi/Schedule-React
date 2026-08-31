"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

function dateKeyToDate(key) {
    if (!key) return undefined;
    const [y, m, d] = key.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
}

function dateToDateKey(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(key) {
    const d = dateKeyToDate(key);
    if (!d) return "Pick a date";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Replaces the old silent "auto-book the next 3 months" behavior. A
// recurring booking no longer generates future occurrences on its own —
// instead, the moment one is marked Completed, this asks for exactly one
// next date and creates exactly one new occurrence for it. Skipping just
// closes the prompt; nothing is created and nothing else changes.
export default function RecurringNextVisitDialog({ prompt, onOpenChange, onConfirm }) {
    const [dateKey, setDateKey] = useState("");
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDateKey(prompt?.suggestedDate || "");
        setDatePickerOpen(false);
        setSaving(false);
    }, [prompt]);

    const booking = prompt?.booking;
    if (!booking) return null;

    const handleConfirm = async () => {
        if (!dateKey) {
            toast.error("Pick a date for the next visit first.");
            return;
        }
        setSaving(true);
        try {
            await onConfirm(dateKey);
        } catch (err) {
            toast.error(`Couldn't schedule the next visit: ${err.message || "Unknown error"}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={Boolean(prompt)} onOpenChange={(open) => { if (!open) onOpenChange(false); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Schedule the next visit?</DialogTitle>
                    <DialogDescription>
                        {`${booking.clientName || "This customer"}'s ${(booking.frequency || "recurring").toLowerCase()} job on ${booking.date} is marked Completed. Pick the next date to book just that one visit — or skip if this customer isn't continuing right now.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 py-2">
                    <span className="text-sm font-medium text-foreground">Next visit date</span>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
                                <CalendarIcon className="size-4" />
                                {formatDateLabel(dateKey)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={dateKeyToDate(dateKey)}
                                onSelect={(d) => { if (d) setDateKey(dateToDateKey(d)); setDatePickerOpen(false); }}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                        Not now
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={saving || !dateKey}>
                        {saving ? "Scheduling…" : "Schedule Visit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
