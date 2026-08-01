"use client";
import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Per-job chat between the customer and their assigned cleaner (support staff
// can see it too). Locks to read-only once the job is Completed/Cancelled —
// further conversation moves to the persistent support thread.
export default function JobChatCard({ bookingId, getAuthHeaders, currentActorId, title = "💬 Job Chat" }) {
    const [messages, setMessages] = useState([]);
    const [locked, setLocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/job?bookingId=${encodeURIComponent(bookingId)}`, { headers });
            const data = await res.json();
            if (res.ok) {
                setMessages(data.messages || []);
                setLocked(Boolean(data.locked));
                setError("");
            } else {
                setError(data.error || "Unable to load chat.");
            }
        } finally {
            setLoading(false);
        }
    }, [bookingId, getAuthHeaders]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 6000);
        return () => clearInterval(interval);
    }, [load]);

    const handleSend = async (text) => {
        const headers = await getAuthHeaders();
        await fetch("/api/chat/job", {
            method: "POST", headers,
            body: JSON.stringify({ bookingId, text }),
        });
        await load();
    };

    if (error) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ChatPanel
                    messages={messages}
                    currentActorId={currentActorId}
                    onSend={handleSend}
                    locked={locked}
                    lockedMessage="This job is closed — this chat is now read-only. Use Support for further questions."
                    loading={loading}
                    placeholder="Message about this job…"
                    height={260}
                />
            </CardContent>
        </Card>
    );
}
