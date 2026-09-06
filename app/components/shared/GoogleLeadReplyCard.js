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

    const sendReply = async (body) => {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/bookings/google-reply", {
            method: "POST",
            headers,
            body: JSON.stringify({ bookingId: booking.id, ...body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reply failed to send.");
        onSent?.(data.sentMessage);
    };

    const handleSend = async (text) => {
        setError("");
        try {
            await sendReply({ text });
        } catch (err) {
            setError(err.message);
            throw err; // let ChatPanel keep the draft text so nothing is lost
        }
    };

    // Whether Google's relay actually forwards a real file through to the
    // customer (vs. just the message text) isn't documented anywhere — this
    // sends it, but it's worth confirming with a real test lead.
    const handleAttach = async (file, currentText) => {
        setError("");
        try {
            const uploadHeaders = await getAuthHeaders();
            delete uploadHeaders["Content-Type"]; // let the browser set the multipart boundary
            const formData = new FormData();
            formData.append("file", file);
            formData.append("bookingId", booking.id);
            const uploadRes = await fetch("/api/uploads/google-lead-attachment", {
                method: "POST", headers: uploadHeaders, body: formData,
            });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(uploadData.error || "Attachment upload failed.");

            await sendReply({
                text: currentText,
                attachmentUrl: uploadData.url,
                attachmentName: uploadData.name,
                attachmentMimeType: uploadData.mimeType,
            });
        } catch (err) {
            setError(err.message);
            throw err;
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
                    onAttach={handleAttach}
                    placeholder="Reply to this Google lead…"
                    emptyLabel="No messages yet."
                    height={220}
                />
            </CardContent>
        </Card>
    );
}
