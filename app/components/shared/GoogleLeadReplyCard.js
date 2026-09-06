"use client";
import { useState } from "react";
import ChatPanel from "./ChatPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Reply thread for a lead that came in through Google Local Services Ads.
// Sending here goes out via the Gmail account's own thread (see
// app/api/bookings/google-reply) — the same channel Google itself treats as
// an official reply, so it reaches the customer and counts toward the
// "typically responds within" badge, unlike anything sent from inside the
// CRM through a different channel would.
export default function GoogleLeadReplyCard({ booking, getAuthHeaders, onSent }) {
    const [error, setError] = useState("");

    const handleSend = async (text) => {
        setError("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/bookings/google-reply", {
                method: "POST",
                headers,
                body: JSON.stringify({ bookingId: booking.id, text }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Reply failed to send.");
            onSent?.(data.sentMessage);
        } catch (err) {
            setError(err.message);
            throw err; // let ChatPanel keep the draft text so nothing is lost
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">📩 Google Lead — Reply</CardTitle>
            </CardHeader>
            <CardContent>
                {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
                <ChatPanel
                    messages={booking.googleGmailMessages || []}
                    currentActorId="admin"
                    onSend={handleSend}
                    placeholder="Reply to this Google lead…"
                    emptyLabel="No messages yet."
                    height={220}
                />
            </CardContent>
        </Card>
    );
}
