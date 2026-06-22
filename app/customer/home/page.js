"use client";
import { useEffect, useState } from "react";
import { Fragment } from "react";
import Link from "next/link";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const STEPS = ["Estimate", "Confirmed", "Invoice", "Complete"];

function lifecycleOf(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

function LifecycleStepper({ step }) {
    return (
        <div style={{ display: "flex", alignItems: "center", marginTop: 14, marginBottom: 4 }}>
            {STEPS.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                    <Fragment key={label}>
                        <div style={{ flex: "none", textAlign: "center", minWidth: 56 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: "50%", margin: "0 auto 4px",
                                background: done ? GREEN : active ? ACTION : "#e2e8f0",
                                border: active ? `2px solid ${ACTION}` : "none",
                            }} />
                            <span style={{ fontSize: 9, fontWeight: 700, color: done ? GREEN : active ? ACTION : "#cbd5e1", letterSpacing: "0.03em" }}>
                                {label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: i < step ? GREEN : "#e2e8f0", margin: "0 -1px 14px" }} />
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
}

export default function CustomerHomePage() {
    const [profile, setProfile] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/customer/profile").then(r => r.json()),
            fetch("/api/customer/bookings").then(r => r.json()),
        ]).then(([p, b]) => {
            setProfile(p.profile || {});
            setBookings(b.bookings || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${BRAND},${ACTION})` }}>
                <div style={{ color: "#fff", opacity: 0.75, fontSize: 14 }}>Loading…</div>
            </div>
        );
    }

    const active = bookings.filter(b => b.status !== "Cancelled" && b.paymentStatus !== "paid");
    active.sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
    const nextJob = active[0];

    const pendingPayment = bookings.find(b => (b.status === "Completed" || b.documentStage === "invoice") && b.paymentStatus !== "paid");

    const name = (profile?.name || "").split(" ")[0] || "there";
    const points = profile?.rewardPoints || 0;
    const referralCode = profile?.referralCode || "";

    return (
        <div>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${BRAND} 0%,${ACTION} 100%)`, padding: "52px 20px 28px", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Hi, {name} 👋</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>Welcome back to Smartouch Clean</div>
            </div>

            <div style={{ padding: "16px 16px 0" }}>

                {/* Invoice alert */}
                {pendingPayment && (
                    <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 18, padding: "16px 18px", marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14, marginBottom: 4 }}>⚡ Invoice Ready — Payment Due</div>
                        <div style={{ fontSize: 13, color: "#78350f", marginBottom: 12 }}>
                            {pendingPayment.service} · {pendingPayment.date} · <strong>${parseFloat(pendingPayment.price || 0).toFixed(2)}</strong>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <a href={`/api/customer/invoice-pdf?bookingId=${pendingPayment.id}`} download style={{ flex: 1, background: "#fff", color: "#92400e", border: "1.5px solid #fbbf24", textAlign: "center", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                                ⬇ View Invoice
                            </a>
                            <Link href={`/customer/jobs/${pendingPayment.id}`} style={{ flex: 1, background: "#d97706", color: "#fff", textAlign: "center", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                                Pay Now →
                            </Link>
                        </div>
                    </div>
                )}

                {/* Next appointment */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                    Next Appointment
                </div>

                {nextJob ? (
                    <div style={{ background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{nextJob.service}</div>
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{nextJob.date} · {nextJob.time}</div>
                                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{nextJob.address1}</div>
                            </div>
                            <span style={{ background: ACTION + "18", color: ACTION, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                                {nextJob.status}
                            </span>
                        </div>
                        <LifecycleStepper step={lifecycleOf(nextJob)} />
                        {lifecycleOf(nextJob) === 0 && (
                            <Link href={`/customer/jobs/${nextJob.id}`} style={{ display: "block", background: ACTION, color: "#fff", textAlign: "center", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none", marginTop: 14 }}>
                                Review &amp; Confirm Appointment
                            </Link>
                        )}
                    </div>
                ) : (
                    <div style={{ background: "#fff", borderRadius: 18, padding: "28px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>🧹</div>
                        <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>No upcoming cleanings</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Book your next appointment today.</div>
                        <Link href="/customer/book" style={{ display: "inline-block", background: ACTION, color: "#fff", borderRadius: 12, padding: "11px 28px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                            Book Now
                        </Link>
                    </div>
                )}

                {/* Rewards card */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                    Rewards
                </div>
                <div style={{ background: `linear-gradient(135deg,${GREEN} 0%,#5f8730 100%)`, borderRadius: 18, padding: "18px 20px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{points}</div>
                        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3 }}>reward points earned</div>
                    </div>
                    <Link href="/customer/rewards" style={{ background: "rgba(255,255,255,0.22)", color: "#fff", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                        View →
                    </Link>
                </div>

                {/* Referral nudge */}
                {referralCode && (
                    <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 18, padding: "16px 18px", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: BRAND, marginBottom: 4 }}>🎁 Refer a Friend, Earn $30</div>
                        <div style={{ fontSize: 13, color: "#0369a1", marginBottom: 12 }}>
                            Give friends $30 off their first clean. Your code: <strong>{referralCode}</strong>
                        </div>
                        <Link href="/customer/rewards" style={{ display: "inline-block", background: BRAND, color: "#fff", borderRadius: 10, padding: "9px 20px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                            Share Code →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
