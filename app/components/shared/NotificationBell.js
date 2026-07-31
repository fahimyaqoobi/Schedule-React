"use client";
import { useState, useEffect, useCallback, useRef } from "react";

function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// In-app notification bell — polls for new customer messages and cleaner
// "Can't Make It" declines. Top-right of the admin header, next to the
// branch selector.
export default function NotificationBell({ getAuthHeaders, onNavigate }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/notifications", { headers });
            const data = await res.json();
            if (res.ok) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {
            // Silent — the bell just stays as-is until the next poll.
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, [load]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const markRead = async (id) => {
        try {
            const headers = await getAuthHeaders();
            await fetch("/api/notifications", { method: "PUT", headers, body: JSON.stringify({ id }) });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Non-critical — next poll reconciles state.
        }
    };

    const markAllRead = async () => {
        try {
            const headers = await getAuthHeaders();
            await fetch("/api/notifications", { method: "PUT", headers, body: JSON.stringify({ markAllRead: true }) });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {
            // Non-critical — next poll reconciles state.
        }
    };

    const handleClick = (notif) => {
        if (!notif.read) markRead(notif.id);
        setOpen(false);
        if (notif.link && onNavigate) onNavigate(notif.link);
    };

    return (
        <div ref={panelRef} style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label="Notifications"
                style={{
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                    width: 38, height: 38, borderRadius: "50%", border: "1px solid #e2e8f0",
                    background: "#fff", cursor: "pointer",
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span style={{
                        position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, padding: "0 3px",
                        borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                    }}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: "absolute", top: 46, right: 0, width: 340, maxHeight: 420, overflowY: "auto",
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                    boxShadow: "0 12px 32px rgba(15,23,42,0.14)", zIndex: 200,
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
                        <strong style={{ fontSize: 13 }}>Notifications</strong>
                        {unreadCount > 0 && (
                            <button type="button" onClick={markAllRead} style={{ fontSize: 11, fontWeight: 700, color: "#0A6CB8", background: "none", border: "none", cursor: "pointer" }}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>Nothing yet.</div>
                    ) : (
                        notifications.map(n => (
                            <button
                                key={n.id}
                                type="button"
                                onClick={() => handleClick(n)}
                                style={{
                                    display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                                    borderBottom: "1px solid #f8fafc", background: n.read ? "#fff" : "#f0f9ff",
                                    border: "none", borderBottomWidth: 1, cursor: "pointer",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>{n.type === "staff_declined" ? "🚫" : "💬"}</span>
                                    <strong style={{ fontSize: 12.5, color: "#1e293b" }}>{n.title}</strong>
                                    {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0A6CB8", marginLeft: "auto" }} />}
                                </div>
                                {n.body && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{n.body}</div>}
                                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{timeAgo(n.createdAt)}</div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
