"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import ChatPanel from "../../shared/ChatPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function initials(name) {
    return (name || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
}

function timeAgo(iso) {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// Shared support inbox — every persistent customer and cleaner support
// thread in one place, visible to admin/ops/sales (matches "admin, ops, and
// salesperson can see and take action" from the requirements).
export default function MessagesTab({ getAuthHeaders, currentUser, Icons, fieldStaff = [] }) {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState("");
    const [activeThread, setActiveThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeSearch, setComposeSearch] = useState("");

    const loadThreads = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/chat/support", { headers });
            const data = await res.json();
            if (res.ok) setThreads(data);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const loadMessages = useCallback(async (thread) => {
        if (!thread) return;
        setChatLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/support?type=${thread.type}&refId=${encodeURIComponent(thread.refId)}`, { headers });
            const data = await res.json();
            if (res.ok) setMessages(data.messages || []);
        } finally {
            setChatLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        loadThreads();
        const interval = setInterval(loadThreads, 8000);
        return () => clearInterval(interval);
    }, [loadThreads]);

    useEffect(() => {
        if (!activeThread) return;
        loadMessages(activeThread);
        const interval = setInterval(() => loadMessages(activeThread), 6000);
        return () => clearInterval(interval);
    }, [activeThread, loadMessages]);

    const handleSend = async (text) => {
        const headers = await getAuthHeaders();
        await fetch("/api/chat/support", {
            method: "POST", headers,
            body: JSON.stringify({ type: activeThread.type, refId: activeThread.refId, refName: activeThread.refName, text }),
        });
        await loadMessages(activeThread);
        await loadThreads();
    };

    const visibleThreads = threads.filter(t => !filterType || t.type === filterType);

    // Support staff starting a conversation, not waiting on the cleaner to
    // message first — a thread doesn't exist server-side until the first
    // message is actually sent, so this just opens the chat panel against a
    // not-yet-created thread; POST creates it on first send either way.
    const composableCleaners = useMemo(() => {
        const q = composeSearch.trim().toLowerCase();
        return fieldStaff
            .filter(m => ["cleaner", "subcontractor", "supervisor"].includes(m.role))
            .filter(m => !q || (m.name || "").toLowerCase().includes(q))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [fieldStaff, composeSearch]);

    const startConversationWith = (member) => {
        const existing = threads.find(t => t.type === "cleaner" && t.refId === member.uid);
        setActiveThread(existing || { id: `cleaner_${member.uid}`, type: "cleaner", refId: member.uid, refName: member.name });
        setComposeOpen(false);
        setComposeSearch("");
    };

    return (
        <div className="animate-fade">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">Support</p>
                    <h3 className="ops-title">Messages</h3>
                    <p className="ops-copy">One persistent thread per customer and per cleaner — spans every job. Job-specific chats live on the booking itself and lock once the job closes.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="ops-chip">{threads.length} Threads</span>
                    <Button size="sm" onClick={() => setComposeOpen(true)}>
                        <Plus className="size-4" />
                        New Message
                    </Button>
                </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[
                    { key: "", label: "All" },
                    { key: "customer", label: "Customers" },
                    { key: "cleaner", label: "Cleaners" },
                ].map(opt => (
                    <button key={opt.key} onClick={() => setFilterType(opt.key)} style={{
                        padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        border: filterType === opt.key ? "1.5px solid #0891b2" : "1.5px solid #e2e8f0",
                        background: filterType === opt.key ? "#ecfeff" : "#fff",
                        color: filterType === opt.key ? "#0891b2" : "#64748b",
                    }}>{opt.label}</button>
                ))}
            </div>

            <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New message to a cleaner</DialogTitle>
                        <DialogDescription>Start the conversation yourself — no need to wait for them to text first.</DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            placeholder="Search cleaners…"
                            value={composeSearch}
                            onChange={(e) => setComposeSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                        {composableCleaners.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No cleaners match.</div>
                        ) : (
                            composableCleaners.map(member => {
                                const hasThread = threads.some(t => t.type === "cleaner" && t.refId === member.uid);
                                return (
                                    <button
                                        key={member.uid}
                                        type="button"
                                        onClick={() => startConversationWith(member)}
                                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                                    >
                                        <Avatar>
                                            <AvatarFallback>{initials(member.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <strong className="block truncate text-sm text-foreground">{member.name}</strong>
                                            <small className="block truncate text-xs text-muted-foreground">{member.branchName || "Ottawa"}</small>
                                        </div>
                                        {hasThread && <Badge variant="outline" className="shrink-0 text-[10px]">Existing thread</Badge>}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
                <div className="table-container" style={{ maxHeight: 560, overflowY: "auto" }}>
                    {loading ? (
                        <div className="text-center p-8 text-slate-400 text-xs">Loading…</div>
                    ) : visibleThreads.length === 0 ? (
                        <div className="text-center p-8 text-slate-400 text-xs">No support conversations yet.</div>
                    ) : (
                        visibleThreads.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveThread(t)}
                                style={{
                                    display: "block", width: "100%", textAlign: "left", padding: "12px 14px",
                                    borderBottom: "1px solid #f1f5f9", background: activeThread?.id === t.id ? "#ecfeff" : "#fff",
                                    border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{t.refName || t.refId}</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: t.type === "customer" ? "#0891b2" : "#7c3aed", background: t.type === "customer" ? "#ecfeff" : "#f5f3ff", borderRadius: 99, padding: "1px 7px" }}>
                                        {t.type === "customer" ? "Customer" : "Cleaner"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lastMessagePreview}</div>
                                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{timeAgo(t.lastMessageAt)}</div>
                            </button>
                        ))
                    )}
                </div>

                <div>
                    {activeThread ? (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
                                {activeThread.refName || activeThread.refId}
                                <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", marginLeft: 8 }}>{activeThread.type === "customer" ? activeThread.refId : ""}</span>
                            </div>
                            <ChatPanel
                                messages={messages}
                                currentActorId={currentUser?.uid}
                                onSend={handleSend}
                                loading={chatLoading}
                                placeholder={`Message this ${activeThread.type}…`}
                                height={460}
                            />
                        </>
                    ) : (
                        <div className="text-center p-12 text-slate-400 text-sm" style={{ border: "1px dashed #e2e8f0", borderRadius: 14 }}>
                            Select a conversation to view messages.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
