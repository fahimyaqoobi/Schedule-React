"use client";
import { useEffect, useRef, useState } from "react";

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Reusable message thread — used for both per-job chats and persistent
// support threads, across the admin app, cleaner self-service view, and the
// customer portal. Data fetching/polling is the caller's responsibility;
// this component is presentation + send-box only.
export default function ChatPanel({
    messages = [],
    currentActorId,
    onSend,
    locked = false,
    lockedMessage = "This conversation is closed.",
    loading = false,
    placeholder = "Type a message…",
    emptyLabel = "No messages yet — say hello.",
    height = 360,
}) {
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages.length]);

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || sending || locked) return;
        setSending(true);
        try {
            await onSend(text);
            setDraft("");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="chat-panel">
            <div className="chat-panel-scroll" ref={scrollRef} style={{ height }}>
                {loading ? (
                    <div className="chat-panel-empty">Loading messages…</div>
                ) : messages.length === 0 ? (
                    <div className="chat-panel-empty">{emptyLabel}</div>
                ) : (
                    messages.map(m => {
                        const isMine = m.senderId === currentActorId;
                        return (
                            <div key={m.id} className={`chat-bubble-row ${isMine ? "mine" : ""}`}>
                                <div className={`chat-bubble chat-bubble-${m.senderKind}`}>
                                    {!isMine && <div className="chat-bubble-sender">{m.senderName}</div>}
                                    <div className="chat-bubble-text">{m.text}</div>
                                    <div className="chat-bubble-time">{formatTime(m.createdAt)}</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            {locked ? (
                <div className="chat-panel-locked">{lockedMessage}</div>
            ) : (
                <div className="chat-panel-composer">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={placeholder}
                        disabled={sending}
                        rows={2}
                    />
                    <button type="button" onClick={handleSend} disabled={sending || !draft.trim()} className="chat-panel-send">
                        {sending ? "…" : "Send"}
                    </button>
                </div>
            )}
        </div>
    );
}
