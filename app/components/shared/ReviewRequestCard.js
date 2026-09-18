"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Review-request tracking + actions for a Completed job. Two fields drive
// everything: reviewAsked and reviewReceived (yes/no each) — the ask rate
// dashboard metric is built from these. Sending is always an explicit admin
// action (the "Ask for Review" / "Send Reminder" buttons here) — nothing
// about reviews goes out to a customer automatically. The one reminder a
// job can ever get is nudged by an in-app notification 3 days after the
// ask (see app/api/cron/review-reminders), never sent by that cron itself.
export default function ReviewRequestCard({ booking, getAuthHeaders, onUpdate }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (booking.status !== "Completed") return null;

    const post = async (path) => {
        setBusy(true);
        setError("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(path, {
                method: "POST", headers,
                body: JSON.stringify({ bookingId: booking.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Request failed.");
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const handleAskForReview = async () => {
        const ok = await post("/api/bookings/request-review");
        if (ok) onUpdate({ reviewAsked: true, reviewAskedAt: new Date().toISOString(), reviewReminderNotified: false });
    };

    const handleSendReminder = async () => {
        const ok = await post("/api/bookings/send-review-reminder");
        if (ok) onUpdate({ reviewReminderSent: true, reviewReminderSentAt: new Date().toISOString() });
    };

    const handleToggleReceived = (checked) => {
        onUpdate({ reviewReceived: checked, reviewReceivedAt: checked ? new Date().toISOString() : "" }, /* persist */ true);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">⭐ Review</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {error && <p className="text-sm text-destructive">{error}</p>}

                {!booking.reviewAsked ? (
                    <>
                        <p className="text-sm text-muted-foreground">Not asked yet — send a review request by email and text.</p>
                        <Button size="sm" className="w-fit" disabled={busy} onClick={handleAskForReview}>
                            {busy ? "Sending…" : "Ask for Review"}
                        </Button>
                    </>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground">Asked on {formatDate(booking.reviewAskedAt)}</p>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`review-received-${booking.id}`}
                                checked={Boolean(booking.reviewReceived)}
                                onCheckedChange={handleToggleReceived}
                            />
                            <Label htmlFor={`review-received-${booking.id}`} className="text-sm font-normal">
                                Review received{booking.reviewReceivedAt ? ` (marked ${formatDate(booking.reviewReceivedAt)})` : ""}
                            </Label>
                        </div>

                        {!booking.reviewReceived && (
                            booking.reviewReminderSent ? (
                                <p className="text-xs text-muted-foreground">Reminder already sent on {formatDate(booking.reviewReminderSentAt)} — that's the one allowed reminder for this job.</p>
                            ) : (
                                <Button size="sm" variant="secondary" className="w-fit" disabled={busy} onClick={handleSendReminder}>
                                    {busy ? "Sending…" : "Send Reminder"}
                                </Button>
                            )
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
