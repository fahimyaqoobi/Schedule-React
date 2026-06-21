"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const STEP_LABELS = ["Estimate", "Confirmed", "Invoice", "Complete"];

function lifecycleStep(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

function stepColor(idx) {
    return idx === 3 ? GREEN : idx >= 1 ? ACTION : "#e2e8f0";
}

function JobCard({ b }) {
    const step = lifecycleStep(b);
    const badge = [
        { label: "Awaiting Confirm", color: "#f59e0b" },
        { label: "Confirmed", color: ACTION },
        { label: "Invoice Ready", color: "#8b5cf6" },
        { label: "Complete", color: GREEN },
    ][step];

    return (
        <Link href={`/customer/jobs/${b.id}`} style={{ display: "block", background: "#fff", borderRadius: 16, padding: "16px 18px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: 10, textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{b.service}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{b.date} · {b.time || "TBD"}</div>
                    {b.address1 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>{b.address1}</div>}
                </div>
                <span style={{ background: badge.color + "18", color: badge.color, borderRadius: 8, padding: "3px 9px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {badge.label}
                </span>
            </div>
            {/* Mini stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {STEP_LABELS.map((label, i) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEP_LABELS.length - 1 ? "1 1 0" : "none" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: i <= step ? stepColor(step) : "#e2e8f0", flexShrink: 0 }} />
                        {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: 1.5, background: i < step ? stepColor(step) : "#e2e8f0" }} />}
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                {STEP_LABELS.map((label, i) => (
                    <span key={label} style={{ fontSize: 9, color: i <= step ? stepColor(step) : "#cbd5e1", fontWeight: 600 }}>{label}</span>
                ))}
            </div>
        </Link>
    );
}

export default function CustomerJobsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/customer/bookings")
            .then(r => r.json())
            .then(d => setBookings(d.bookings || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const active = bookings.filter(b => b.status !== "Cancelled" && b.paymentStatus !== "paid");
    const past = bookings.filter(b => b.status === "Cancelled" || b.paymentStatus === "paid");
    active.sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
    past.sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);

    return (
        <div>
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 24px", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>My Jobs</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Track all your cleanings</div>
            </div>

            <div style={{ padding: "16px 16px 0" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>Loading…</div>
                ) : bookings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 16px" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🧹</div>
                        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>No bookings yet</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Your cleaning history will appear here.</div>
                        <Link href="/customer/book" style={{ display: "inline-block", background: ACTION, color: "#fff", borderRadius: 12, padding: "11px 28px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Book Now</Link>
                    </div>
                ) : (
                    <>
                        {active.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Upcoming</div>
                                {active.map(b => <JobCard key={b.id} b={b} />)}
                            </>
                        )}
                        {past.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, marginTop: 8 }}>Past</div>
                                {past.map(b => <JobCard key={b.id} b={b} />)}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
