"use client";
import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";

// A cleaner's own persistent support thread with the office — separate from
// any per-job chat, which stays scoped to that job until it's completed.
export default function CleanerSupportChat({ getAuthHeaders, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!currentUser?.uid) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/support?type=cleaner&refId=${encodeURIComponent(currentUser.uid)}`, { headers });
            const data = await res.json();
            if (res.ok) setMessages(data.messages || []);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid, getAuthHeaders]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 6000);
        return () => clearInterval(interval);
    }, [load]);

    const handleSend = async (text) => {
        const headers = await getAuthHeaders();
        await fetch("/api/chat/support", {
            method: "POST", headers,
            body: JSON.stringify({ type: "cleaner", refId: currentUser.uid, refName: currentUser.name, text }),
        });
        await load();
    };

    return (
        <ChatPanel
            messages={messages}
            currentActorId={currentUser?.uid}
            onSend={handleSend}
            loading={loading}
            placeholder="Message the office…"
            height={420}
        />
    );
}
