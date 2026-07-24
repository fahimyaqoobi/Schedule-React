"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatPanel from "../../components/shared/ChatPanel";

const BRAND = "#005691";
const ACTION = "#0A6CB8";

const getPortalAuthHeaders = async () => ({ "Content-Type": "application/json" });

// One ongoing conversation with the office, separate from any per-job chat —
// spans every booking the customer has ever had.
export default function CustomerSupportPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (refId) => {
        try {
            const res = await fetch(`/api/chat/support?type=customer&refId=${encodeURIComponent(refId)}`);
            const data = await res.json();
            if (res.ok) setMessages(data.messages || []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch("/api/customer/profile")
            .then(r => r.json())
            .then(d => {
                const p = d.profile || {};
                setPhone(p.phone || "");
                setName(p.name || "");
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!phone) return;
        load(phone);
        const interval = setInterval(() => load(phone), 6000);
        return () => clearInterval(interval);
    }, [phone, load]);

    const handleSend = async (text) => {
        await fetch("/api/chat/support", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "customer", refId: phone, refName: name, text }),
        });
        await load(phone);
    };

    return (
        <div>
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 24px", color: "#fff" }}>
                <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
                    ← Back
                </button>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Support</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>We're here to help with anything — questions about a job, billing, or your account.</div>
            </div>
            <div style={{ padding: "20px 16px" }}>
                <div style={{ background: "#fff", borderRadius: 18, padding: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                    <ChatPanel
                        messages={messages}
                        currentActorId={phone}
                        onSend={handleSend}
                        loading={loading}
                        placeholder="Message the SmarTouch Clean team…"
                        height={440}
                    />
                </div>
            </div>
        </div>
    );
}
