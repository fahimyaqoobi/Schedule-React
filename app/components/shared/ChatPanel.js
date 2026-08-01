"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Lock, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function initialsOf(name) {
    return String(name || "?").trim().charAt(0).toUpperCase() || "?";
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
        <div className="flex flex-col gap-2">
            <div ref={scrollRef} className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3" style={{ height }}>
                {loading ? (
                    <div className="m-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="size-5 opacity-50" />
                        Loading messages…
                    </div>
                ) : messages.length === 0 ? (
                    <div className="m-auto flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                        <MessageSquare className="size-5 opacity-50" />
                        {emptyLabel}
                    </div>
                ) : (
                    messages.map(m => {
                        const isMine = m.senderId === currentActorId;
                        return (
                            <div key={m.id} className={cn("flex items-end gap-2", isMine && "flex-row-reverse")}>
                                {!isMine && (
                                    <Avatar size="sm" className="mb-4 shrink-0">
                                        <AvatarFallback>{initialsOf(m.senderName)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("flex max-w-[78%] flex-col gap-0.5", isMine && "items-end")}>
                                    {!isMine && <span className="px-1 text-xs font-medium text-muted-foreground">{m.senderName}</span>}
                                    <div
                                        className={cn(
                                            "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                                            isMine
                                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                                : "rounded-bl-sm bg-card text-card-foreground ring-1 ring-border"
                                        )}
                                    >
                                        {m.text}
                                    </div>
                                    <span className="px-1 text-[11px] text-muted-foreground">{formatTime(m.createdAt)}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            {locked ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                    <Lock className="size-4 shrink-0" />
                    {lockedMessage}
                </div>
            ) : (
                <div className="flex items-end gap-2">
                    <Textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={placeholder}
                        disabled={sending}
                        rows={2}
                        className="min-h-0 resize-none"
                    />
                    <Button type="button" onClick={handleSend} disabled={sending || !draft.trim()} size="icon">
                        <SendHorizontal className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
