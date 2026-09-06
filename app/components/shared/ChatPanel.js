"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Lock, SendHorizontal, Paperclip, FileText } from "lucide-react";
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
    // Optional: (file, currentDraftText) => Promise<void>. Only passed by
    // callers that support attachments (e.g. GoogleLeadReplyCard) — when
    // omitted, no paperclip button renders and every other chat using this
    // shared panel (job chat, support chat) is unaffected.
    onAttach,
    locked = false,
    lockedMessage = "This conversation is closed.",
    loading = false,
    placeholder = "Type a message…",
    emptyLabel = "No messages yet — say hello.",
    height = 360,
}) {
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [attaching, setAttaching] = useState(false);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

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

    const handleFileChosen = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow picking the same file again later
        if (!file || attaching || locked) return;
        setAttaching(true);
        try {
            await onAttach(file, draft.trim());
            setDraft("");
        } finally {
            setAttaching(false);
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
                        if (m.senderKind === "system") {
                            return (
                                <div key={m.id} className="mx-auto flex max-w-[90%] flex-col items-center gap-0.5 py-1 text-center">
                                    <span className="text-xs text-muted-foreground">
                                        <span aria-hidden="true">🔔 </span>{m.text}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/70">{m.senderName ? `${m.senderName} · ` : ""}{formatTime(m.createdAt)}</span>
                                </div>
                            );
                        }
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
                                        {m.attachment && (
                                            m.attachment.mimeType?.startsWith("image/") ? (
                                                <a href={m.attachment.url} target="_blank" rel="noreferrer">
                                                    <img
                                                        src={m.attachment.url}
                                                        alt={m.attachment.name || "Attachment"}
                                                        className="mb-1.5 max-h-48 max-w-full rounded-lg object-cover"
                                                    />
                                                </a>
                                            ) : (
                                                <a
                                                    href={m.attachment.url} target="_blank" rel="noreferrer"
                                                    className={cn(
                                                        "mb-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs underline",
                                                        isMine ? "bg-primary-foreground/10" : "bg-muted"
                                                    )}
                                                >
                                                    <FileText className="size-3.5 shrink-0" /> {m.attachment.name || "Attachment"}
                                                </a>
                                            )
                                        )}
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
                    {onAttach && (
                        <>
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} />
                            <Button
                                type="button" variant="outline" size="icon"
                                disabled={attaching || sending}
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach a file or photo"
                            >
                                <Paperclip className="size-4" />
                            </Button>
                        </>
                    )}
                    <Textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={attaching ? "Uploading attachment…" : placeholder}
                        disabled={sending || attaching}
                        rows={2}
                        className="min-h-0 resize-none"
                    />
                    <Button type="button" onClick={handleSend} disabled={sending || attaching || !draft.trim()} size="icon">
                        <SendHorizontal className="size-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
