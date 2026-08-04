"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, MessageSquare, MessagesSquare, Megaphone } from "lucide-react";
import { toast } from "sonner";
import ChatPanel from "../../shared/ChatPanel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ANNOUNCE_AUDIENCE_LABELS = { customer: "All Customers", cleaner: "All Cleaners & Staff" };

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
    const [chatLocked, setChatLocked] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeSearch, setComposeSearch] = useState("");
    const [announceOpen, setAnnounceOpen] = useState(false);
    const [announceAudience, setAnnounceAudience] = useState("customer");
    const [announceText, setAnnounceText] = useState("");
    const [announceSendSms, setAnnounceSendSms] = useState(false);
    const [announceSending, setAnnounceSending] = useState(false);
    const [announceHistory, setAnnounceHistory] = useState([]);
    const [announceHistoryLoading, setAnnounceHistoryLoading] = useState(false);

    // Support threads (persistent, one per customer/cleaner) and job threads
    // (scoped to one booking, lock on completion) are two different backends
    // — merged into one list here so admins don't have to know which is
    // which to find a conversation.
    const loadThreads = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const [supportRes, jobRes] = await Promise.all([
                fetch("/api/chat/support", { headers }),
                fetch("/api/chat/job/threads", { headers }),
            ]);
            const [supportData, jobData] = await Promise.all([supportRes.json(), jobRes.json()]);
            const supportThreads = supportRes.ok ? supportData.map(t => ({ ...t, kind: "support" })) : [];
            const jobThreads = jobRes.ok ? jobData : [];
            setThreads([...supportThreads, ...jobThreads].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)));
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    // `silent` is what actually fixes the blink: background polls must never
    // toggle the loading flag, or ChatPanel swaps the whole conversation for
    // a "Loading messages…" placeholder every few seconds. Only the very
    // first load of a newly-opened thread should show that.
    const loadMessages = useCallback(async (thread, { silent = false } = {}) => {
        if (!thread) return;
        if (!silent) setChatLoading(true);
        try {
            const headers = await getAuthHeaders();
            if (thread.kind === "job") {
                const res = await fetch(`/api/chat/job?bookingId=${encodeURIComponent(thread.bookingId)}`, { headers });
                const data = await res.json();
                if (res.ok) { setMessages(data.messages || []); setChatLocked(Boolean(data.locked)); }
            } else {
                const res = await fetch(`/api/chat/support?type=${thread.type}&refId=${encodeURIComponent(thread.refId)}`, { headers });
                const data = await res.json();
                if (res.ok) { setMessages(data.messages || []); setChatLocked(false); }
            }
        } finally {
            if (!silent) setChatLoading(false);
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
        const interval = setInterval(() => loadMessages(activeThread, { silent: true }), 6000);
        return () => clearInterval(interval);
    }, [activeThread, loadMessages]);

    const handleSend = async (text) => {
        const headers = await getAuthHeaders();
        if (activeThread.kind === "job") {
            await fetch("/api/chat/job", {
                method: "POST", headers,
                body: JSON.stringify({ bookingId: activeThread.bookingId, text }),
            });
        } else {
            await fetch("/api/chat/support", {
                method: "POST", headers,
                body: JSON.stringify({ type: activeThread.type, refId: activeThread.refId, refName: activeThread.refName, text }),
            });
        }
        await loadMessages(activeThread, { silent: true });
        await loadThreads();
    };

    const visibleThreads = threads.filter(t => !filterType || (filterType === "job" ? t.kind === "job" : t.type === filterType));

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

    const loadAnnouncementHistory = useCallback(async () => {
        setAnnounceHistoryLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/chat/announce", { headers });
            const data = await res.json();
            if (res.ok) setAnnounceHistory(data);
        } finally {
            setAnnounceHistoryLoading(false);
        }
    }, [getAuthHeaders]);

    // Sends one message into every recipient's own persistent support
    // thread (same backend the 1:1 support inbox uses) — not a separate
    // broadcast feed, so a reply just shows up as a normal message in that
    // thread, and the announcement itself stays in their history forever.
    const handleSendAnnouncement = async () => {
        if (!announceText.trim() || announceSending) return;
        setAnnounceSending(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/chat/announce", {
                method: "POST", headers,
                body: JSON.stringify({ audience: announceAudience, text: announceText.trim(), sendSms: announceSendSms }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to send announcement.");
            toast.success(data.message || "Announcement sent.");
            setAnnounceText("");
            setAnnounceSendSms(false);
            await Promise.all([loadThreads(), loadAnnouncementHistory()]);
        } catch (err) {
            toast.error(err.message || "Failed to send announcement.");
        } finally {
            setAnnounceSending(false);
        }
    };

    return (
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Support</p>
                        <CardTitle className="text-xl">Messages</CardTitle>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Persistent support threads (one per customer, one per cleaner) plus recent per-job chats, all in one inbox. Job threads lock once that job closes. Messages also go out as a real text, and replies text back in here.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{threads.length} Threads</Badge>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setAnnounceOpen(true); loadAnnouncementHistory(); }}
                        >
                            <Megaphone className="size-4" />
                            Announcement
                        </Button>
                        <Button size="sm" onClick={() => setComposeOpen(true)}>
                            <Plus className="size-4" />
                            New Message
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Tabs value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="customer">Customers</TabsTrigger>
                    <TabsTrigger value="cleaner">Cleaners</TabsTrigger>
                    <TabsTrigger value="job">Jobs</TabsTrigger>
                </TabsList>
            </Tabs>

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

            <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Send an announcement</DialogTitle>
                        <DialogDescription>
                            Delivers into every recipient's own support thread — it becomes a normal part of their conversation history, and any reply lands right back there for you to see.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Send to</label>
                            <Select value={announceAudience} onValueChange={setAnnounceAudience}>
                                <SelectTrigger className="mt-1 w-full">
                                    <span data-slot="select-value">{ANNOUNCE_AUDIENCE_LABELS[announceAudience]}</span>
                                </SelectTrigger>
                                <SelectContent align="start" alignItemWithTrigger={false}>
                                    <SelectItem value="customer">All Customers</SelectItem>
                                    <SelectItem value="cleaner">All Cleaners &amp; Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-muted-foreground">Message</label>
                            <Textarea
                                className="mt-1"
                                rows={4}
                                placeholder="Write your announcement…"
                                value={announceText}
                                onChange={(e) => setAnnounceText(e.target.value)}
                            />
                        </div>

                        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                            <span>
                                <span className="block text-sm font-medium text-foreground">Also send as a text message</span>
                                <span className="block text-xs text-muted-foreground">Real, billed SMS to everyone with a phone on file, in addition to their in-app thread. Off = in-app only.</span>
                            </span>
                            <Switch checked={announceSendSms} onCheckedChange={setAnnounceSendSms} />
                        </label>
                    </div>

                    <DialogFooter>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={!announceText.trim() || announceSending}>
                                    <Megaphone className="size-4" />
                                    Send Announcement
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Send to {ANNOUNCE_AUDIENCE_LABELS[announceAudience]}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This message will be added to every {announceAudience === "customer" ? "customer's" : "cleaner's and staff member's"} support thread{announceSendSms ? ", and sent as a real text message to each of them" : ""}. This can't be recalled once sent.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleSendAnnouncement}>
                                        {announceSending ? "Sending…" : "Yes, Send It"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DialogFooter>

                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Announcements</p>
                        {announceHistoryLoading ? (
                            <p className="py-3 text-center text-xs text-muted-foreground">Loading…</p>
                        ) : announceHistory.length === 0 ? (
                            <p className="py-3 text-center text-xs text-muted-foreground">No announcements sent yet.</p>
                        ) : (
                            <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                                {announceHistory.map(a => (
                                    <div key={a.id} className="rounded-lg border border-border p-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <Badge variant="outline" className="text-[9px]">{ANNOUNCE_AUDIENCE_LABELS[a.audience]}</Badge>
                                            <span className="text-[10px] text-muted-foreground">{timeAgo(a.sentAt)}</span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-xs text-foreground">{a.text}</p>
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                            Sent to {a.sentCount ?? a.recipientCount} of {a.recipientCount} · by {a.sentBy?.name || "Staff"}
                                            {a.sendSms ? ` · ${a.smsSentCount || 0} texted` : ""}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
                <Card className="max-h-[600px] overflow-y-auto p-0">
                    {loading ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">Loading…</div>
                    ) : visibleThreads.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-muted-foreground">
                            <MessagesSquare className="h-6 w-6 text-muted-foreground/50" />
                            No support conversations yet.
                        </div>
                    ) : (
                        visibleThreads.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveThread(t)}
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-left transition-colors last:border-0 hover:bg-muted",
                                    activeThread?.id === t.id && "bg-accent",
                                )}
                            >
                                <Avatar className="shrink-0">
                                    <AvatarFallback>{initials(t.refName || t.refId)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <strong className="truncate text-sm text-foreground">{t.refName || t.refId}</strong>
                                        <Badge
                                            variant={t.kind === "job" ? "default" : t.type === "customer" ? "outline" : "secondary"}
                                            className="shrink-0 text-[9px]"
                                        >
                                            {t.kind === "job" ? "Job" : t.type === "customer" ? "Customer" : "Cleaner"}
                                        </Badge>
                                    </div>
                                    {t.kind === "job" && (
                                        <p className="truncate text-xs text-muted-foreground/80">{t.service} · {t.date}</p>
                                    )}
                                    <p className="truncate text-xs text-muted-foreground">{t.lastMessagePreview}</p>
                                    <p className="text-[10px] text-muted-foreground/70">{timeAgo(t.lastMessageAt)}</p>
                                </div>
                            </button>
                        ))
                    )}
                </Card>

                <Card>
                    {activeThread ? (
                        <>
                            <CardHeader className="flex-row items-center gap-2 border-b border-border pb-4">
                                <Avatar>
                                    <AvatarFallback>{initials(activeThread.refName || activeThread.refId)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-sm">{activeThread.refName || activeThread.refId}</CardTitle>
                                    {activeThread.kind === "job" ? (
                                        <p className="text-xs text-muted-foreground">{activeThread.service} · {activeThread.date}</p>
                                    ) : activeThread.type === "customer" && (
                                        <p className="text-xs text-muted-foreground">{activeThread.refId}</p>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <ChatPanel
                                    messages={messages}
                                    currentActorId={currentUser?.uid}
                                    onSend={handleSend}
                                    locked={chatLocked}
                                    lockedMessage="This job is closed — read-only. Further questions go to the customer/cleaner's support thread instead."
                                    loading={chatLoading}
                                    placeholder={activeThread.kind === "job" ? "Message about this job…" : `Message this ${activeThread.type}…`}
                                    height={460}
                                />
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="flex flex-col items-center justify-center gap-2 py-24 text-center text-sm text-muted-foreground">
                            <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                            Select a conversation to view messages.
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    );
}
