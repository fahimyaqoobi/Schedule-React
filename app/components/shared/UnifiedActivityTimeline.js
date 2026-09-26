"use client";
import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import CallButton from "./CallButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { normalizePhone } from "@/lib/phone";

// Everything that happened, in one thread: this job's own activity (status
// changes, invoice generated, call logs, and any cleaner↔customer messages
// from the job) merged chronologically with the customer's persistent,
// never-locking conversation. Two different collections behind the scenes
// (jobChatMessages for this booking + the one supportMessages thread for
// this customer), one merged view — sending from here always goes to the
// customer's persistent thread, since that's the canonical place for
// admin↔customer conversation now (see the original CustomerChatCard's
// comment for why the old per-job-only chat caused messages to land
// unpredictably). Lifetime stats and the "View Full History" link live in
// the Quick Facts panel next to this, not duplicated here.
//
// A Google Lead's own conversation (a different channel — Gmail, not SMS)
// stays in its own separate card below this one; merging a second reply
// channel with a different send-target into one composer here would be a
// real source of "which channel did that just go out on" mistakes, so it's
// deliberately kept apart.
export default function UnifiedActivityTimeline({ booking, getAuthHeaders, currentActorId }) {
    const [jobMessages, setJobMessages] = useState([]);
    const [customerMessages, setCustomerMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const phone = normalizePhone(booking.customerPortalPhone || booking.phone || "");

    const load = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const [jobRes, supportRes] = await Promise.all([
                fetch(`/api/chat/job?bookingId=${encodeURIComponent(booking.id)}`, { headers }),
                phone
                    ? fetch(`/api/chat/support?type=customer&refId=${encodeURIComponent(phone)}`, { headers })
                    : Promise.resolve(null),
            ]);
            const jobData = await jobRes.json();
            if (jobRes.ok) setJobMessages(jobData.messages || []);

            if (supportRes) {
                const supportData = await supportRes.json();
                if (supportRes.ok) setCustomerMessages(supportData.messages || []);
            }
            setError("");
        } catch (err) {
            setError(err.message || "Unable to load activity.");
        } finally {
            setLoading(false);
        }
    }, [booking.id, phone, getAuthHeaders]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 6000);
        return () => clearInterval(interval);
    }, [load]);

    const handleSend = async (text) => {
        if (!phone) throw new Error("This booking has no phone number on file to message.");
        const headers = await getAuthHeaders();
        await fetch("/api/chat/support", {
            method: "POST", headers,
            body: JSON.stringify({ type: "customer", refId: phone, refName: booking.clientName, text }),
        });
        await load();
    };

    const merged = [...jobMessages, ...customerMessages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (error) return null;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">All Activity</CardTitle>
                    {phone && <CallButton phone={phone} bookingId={booking.id} getAuthHeaders={getAuthHeaders} />}
                </div>
                <p className="text-sm text-muted-foreground">Every message, call, and update on this job, in one place.</p>
            </CardHeader>
            <CardContent>
                <ChatPanel
                    messages={merged}
                    currentActorId={currentActorId}
                    onSend={handleSend}
                    locked={!phone}
                    lockedMessage="No phone number on file for this customer yet — add one to message them."
                    loading={loading}
                    placeholder="Message this customer…"
                    emptyLabel="Nothing yet — every call, message, and update on this job will show up here."
                    height={440}
                />
            </CardContent>
        </Card>
    );
}
