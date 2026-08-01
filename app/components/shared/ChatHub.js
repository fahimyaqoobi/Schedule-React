"use client";
import { useCallback, useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Briefcase, Headset, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const defaultAuthHeaders = async () => ({ "Content-Type": "application/json" });

// One place to see every conversation an actor (cleaner or customer) is
// part of — the persistent office support thread plus a row per job that
// still has (or recently had) its own chat. Tapping a row opens ChatPanel
// scoped to that thread. Backed entirely by the existing /api/chat/support
// and /api/chat/job routes — this is a UI-layer consolidation, no new
// backend surface.
export default function ChatHub({
    getAuthHeaders = defaultAuthHeaders,
    currentActorId,
    supportType,
    supportRefId,
    supportRefName,
    jobs = [],
    emptyJobsHint = "Chats for your active jobs will show up here.",
}) {
    const [activeId, setActiveId] = useState(null);
    const [supportPreview, setSupportPreview] = useState(null);
    const [messages, setMessages] = useState([]);
    const [locked, setLocked] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadSupportPreview = useCallback(async () => {
        if (!supportRefId) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/support?type=${supportType}&refId=${encodeURIComponent(supportRefId)}`, { headers });
            const data = await res.json();
            if (res.ok) setSupportPreview(data.thread || null);
        } catch {
            // Best-effort preview only — the thread itself still opens fine.
        }
    }, [supportType, supportRefId, getAuthHeaders]);

    useEffect(() => {
        loadSupportPreview();
        const interval = setInterval(loadSupportPreview, 6000);
        return () => clearInterval(interval);
    }, [loadSupportPreview]);

    // Derived from the `jobs` prop only for display (name/subtitle in the
    // header) — never used as a hook dependency. Callers commonly rebuild
    // `jobs` as a fresh array/objects on every render (e.g. `bookings.map(...)`
    // inline in JSX), so anything keyed off object identity here would retrigger
    // the fetch effect on every parent re-render instead of every 6s.
    const activeBookingId = activeId?.startsWith("job:") ? activeId.slice(4) : null;
    const activeJob = activeBookingId ? jobs.find(j => j.id === activeBookingId) : null;

    const loadActive = useCallback(async () => {
        if (!activeId) return;
        try {
            const headers = await getAuthHeaders();
            if (activeId === "support") {
                const res = await fetch(`/api/chat/support?type=${supportType}&refId=${encodeURIComponent(supportRefId)}`, { headers });
                const data = await res.json();
                if (res.ok) { setMessages(data.messages || []); setSupportPreview(data.thread || null); setLocked(false); }
            } else if (activeBookingId) {
                const res = await fetch(`/api/chat/job?bookingId=${encodeURIComponent(activeBookingId)}`, { headers });
                const data = await res.json();
                if (res.ok) { setMessages(data.messages || []); setLocked(Boolean(data.locked)); }
            }
        } finally {
            setLoading(false);
        }
    }, [activeId, activeBookingId, supportType, supportRefId, getAuthHeaders]);

    useEffect(() => {
        if (!activeId) return;
        setLoading(true);
        loadActive();
        const interval = setInterval(loadActive, 6000);
        return () => clearInterval(interval);
    }, [activeId, loadActive]);

    const openThread = (id) => { setMessages([]); setLocked(false); setActiveId(id); };

    const handleSend = async (text) => {
        const headers = await getAuthHeaders();
        if (activeId === "support") {
            await fetch("/api/chat/support", {
                method: "POST", headers,
                body: JSON.stringify({ type: supportType, refId: supportRefId, refName: supportRefName, text }),
            });
        } else if (activeBookingId) {
            await fetch("/api/chat/job", {
                method: "POST", headers,
                body: JSON.stringify({ bookingId: activeBookingId, text }),
            });
        }
        await loadActive();
    };

    if (activeId) {
        const isSupport = activeId === "support";
        return (
            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="size-4" /> All chats
                </button>
                <div className="flex items-center gap-2">
                    <Avatar size="sm">
                        <AvatarFallback>{isSupport ? <Headset className="size-3.5" /> : <Briefcase className="size-3.5" />}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="text-sm font-semibold text-foreground">{isSupport ? "Office Support" : activeJob?.name}</div>
                        {!isSupport && activeJob?.subtitle && <div className="text-xs text-muted-foreground">{activeJob.subtitle}</div>}
                    </div>
                </div>
                <ChatPanel
                    messages={messages}
                    currentActorId={currentActorId}
                    onSend={handleSend}
                    locked={locked}
                    lockedMessage="This job is closed — this chat is now read-only. Use Office Support for further questions."
                    loading={loading}
                    placeholder={isSupport ? "Message the office…" : "Message about this job…"}
                    height={420}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            <button
                type="button"
                onClick={() => openThread("support")}
                className="flex items-center gap-3 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50"
            >
                <Avatar>
                    <AvatarFallback><Headset className="size-4" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">Office Support</span>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                        {supportPreview?.lastMessagePreview || "General questions & help"}
                    </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {jobs.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">{emptyJobsHint}</div>
            ) : (
                jobs.map(job => (
                    <button
                        key={job.id}
                        type="button"
                        onClick={() => openThread(`job:${job.id}`)}
                        className="flex items-center gap-3 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                        <Avatar>
                            <AvatarFallback><Briefcase className="size-4" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-foreground">{job.name}</span>
                                {job.locked && <Badge variant="secondary" className="shrink-0">Closed</Badge>}
                            </div>
                            <div className="truncate text-sm text-muted-foreground">{job.subtitle}</div>
                            {job.detail && (
                                <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <MapPin className="size-3 shrink-0" /> {job.detail}
                                </div>
                            )}
                        </div>
                        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground")} />
                    </button>
                ))
            )}
        </div>
    );
}
