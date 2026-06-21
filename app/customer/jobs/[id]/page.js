"use client";
import { useEffect, useState, use } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const STEPS = [
    { label: "Estimate", desc: "Review your quote" },
    { label: "Confirmed", desc: "Appointment locked in" },
    { label: "Invoice", desc: "Service completed" },
    { label: "Complete", desc: "All done" },
];

function lifecycleStep(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

function fmt$(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }

export default function JobDetailPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const sp = new URLSearchParams(window.location.search);
            if (sp.get("paid") === "true") setPaid(true);
        }
        fetch(`/api/customer/booking?bookingId=${id}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) setErr(d.error);
                else setBooking(d);
            })
            .catch(() => setErr("Could not load this job."))
            .finally(() => setLoading(false));
    }, [id]);

    async function handleConfirm() {
        setActionLoading(true); setErr(""); setMsg("");
        try {
            const res = await fetch("/api/customer/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: id }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMsg("Appointment confirmed! We'll see you soon. ✓");
            setBooking(prev => ({ ...prev, customerConfirmed: true }));
        } catch (e) { setErr(e.message); }
        finally { setActionLoading(false); }
    }

    async function handlePay() {
        setActionLoading(true); setErr("");
        try {
            const res = await fetch("/api/customer/pay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId: id,
                    successPath: `/customer/jobs/${id}?paid=true`,
                    cancelPath: `/customer/jobs/${id}`,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url;
        } catch (e) { setErr(e.message); setActionLoading(false); }
    }

    if (loading) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Loading…</div>
            </div>
        );
    }

    if (err && !booking) {
        return (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
                <div style={{ color: "#dc2626", fontSize: 14 }}>{err}</div>
                <Link href="/customer/jobs" style={{ display: "inline-block", marginTop: 20, color: ACTION, fontWeight: 700, fontSize: 14 }}>← Back to Jobs</Link>
            </div>
        );
    }

    const step = lifecycleStep(booking);

    const hasPrice = Number(booking?.price) > 0;
    const subtotal = Number(booking?.subtotal || booking?.price || 0);
    const tax = Number(booking?.tax || 0);
    const promoDiscount = Number(booking?.promoDiscount || 0);
    const total = Number(booking?.price || 0);

    return (
        <div>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 24px", color: "#fff" }}>
                <button onClick={() => router.push("/customer/jobs")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
                    ← Jobs
                </button>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{booking?.service}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{booking?.date} · {booking?.time || "Time TBD"}</div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>

                {/* Payment success banner */}
                {paid && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 16, padding: "16px 18px", marginBottom: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                        <div style={{ fontWeight: 700, color: "#15803d", fontSize: 15 }}>Payment received!</div>
                        <div style={{ fontSize: 13, color: "#166534", marginTop: 4 }}>Thank you — your receipt has been emailed.</div>
                    </div>
                )}

                {/* Lifecycle stepper */}
                <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                        Job Status
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                        {STEPS.map((s, i) => {
                            const done = i < step;
                            const active = i === step;
                            const dotColor = done ? GREEN : active ? ACTION : "#e2e8f0";
                            return (
                                <Fragment key={s.label}>
                                    <div style={{ flex: "none", textAlign: "center", minWidth: 64 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: "50%", margin: "0 auto 6px",
                                            background: done ? GREEN : active ? ACTION : "#f1f5f9",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            border: active ? `2.5px solid ${ACTION}` : done ? "none" : "1.5px solid #e2e8f0",
                                        }}>
                                            {done ? <span style={{ color: "#fff", fontSize: 14 }}>✓</span>
                                                : <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? ACTION : "#cbd5e1", display: "block" }} />}
                                        </div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: done ? GREEN : active ? ACTION : "#94a3b8" }}>{s.label}</div>
                                        {active && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{s.desc}</div>}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div style={{ flex: 1, height: 2, background: i < step ? GREEN : "#e2e8f0", marginTop: 14 }} />
                                    )}
                                </Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Action card */}
                {step === 0 && (
                    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 8 }}>Confirm Your Appointment</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                            Your booking is pending your confirmation. Please review the details and confirm to lock it in.
                        </div>
                        {msg && <div style={{ color: GREEN, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}
                        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{err}</div>}
                        <button
                            onClick={handleConfirm}
                            disabled={actionLoading}
                            style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: actionLoading ? 0.7 : 1 }}
                        >
                            {actionLoading ? "Confirming…" : "Confirm Appointment"}
                        </button>
                    </div>
                )}

                {step === 1 && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 18, padding: "18px", marginBottom: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
                        <div style={{ fontWeight: 700, color: "#15803d", fontSize: 15 }}>Appointment Confirmed</div>
                        <div style={{ fontSize: 13, color: "#166534", marginTop: 6 }}>
                            We&apos;ll see you on <strong>{booking?.date}</strong>. We&apos;ll be in touch closer to the date.
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>Invoice — Payment Due</div>
                        {hasPrice && (
                            <div style={{ marginBottom: 16 }}>
                                {subtotal > 0 && subtotal !== total && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", marginBottom: 6 }}>
                                        <span>Subtotal</span><span>{fmt$(subtotal)}</span>
                                    </div>
                                )}
                                {promoDiscount > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: GREEN, marginBottom: 6 }}>
                                        <span>Promo ({booking?.promoCode})</span><span>-{fmt$(promoDiscount)}</span>
                                    </div>
                                )}
                                {tax > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", marginBottom: 6 }}>
                                        <span>HST (13%)</span><span>{fmt$(tax)}</span>
                                    </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", background: BRAND, color: "#fff", borderRadius: 12, padding: "12px 16px", marginTop: 10 }}>
                                    <span style={{ fontWeight: 700, fontSize: 15 }}>Total Due</span>
                                    <span style={{ fontWeight: 900, fontSize: 18 }}>{fmt$(total)}</span>
                                </div>
                            </div>
                        )}
                        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{err}</div>}
                        <button
                            onClick={handlePay}
                            disabled={actionLoading}
                            style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: actionLoading ? 0.7 : 1 }}
                        >
                            {actionLoading ? "Redirecting…" : `Pay ${hasPrice ? fmt$(total) : ""} Now →`}
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        {/* Assigned cleaner(s) */}
                        {booking?.assignedStaff?.length > 0 && (
                            <div style={{ marginBottom: 16, background: "#f8fafc", borderRadius: 14, padding: "14px 16px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                                    Your Cleaner{booking.assignedStaff.length > 1 ? "s" : ""}
                                </div>
                                {booking.assignedStaff.map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < booking.assignedStaff.length - 1 ? 8 : 0 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: ACTION + "20", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ACTION, fontSize: 14 }}>
                                            {(s.name || "?")[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{s.name || "Staff"}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ textAlign: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
                            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, marginBottom: 4 }}>How was your clean?</div>
                            <div style={{ fontSize: 13, color: "#64748b" }}>A quick review helps us improve and supports our team.</div>
                        </div>
                        <a
                            href="https://g.page/r/smartouchclean/review"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "block", background: "#fbbf24", color: "#78350f", textAlign: "center", padding: "13px 0", borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: "none", marginBottom: 10 }}
                        >
                            ⭐ Leave a Google Review
                        </a>
                        <Link href="/customer/book" style={{ display: "block", background: ACTION, color: "#fff", textAlign: "center", padding: "13px 0", borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                            🔁 Book Again
                        </Link>
                    </div>
                )}

                {/* Booking details */}
                <div style={{ background: "#fff", borderRadius: 18, padding: "18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Details</div>
                    {[
                        ["Service", booking?.service],
                        ["Date", booking?.date],
                        ["Time", booking?.time || "TBD"],
                        ["Address", [booking?.address1, booking?.address2, booking?.city, booking?.postalCode].filter(Boolean).join(", ")],
                        booking?.estimateNumber && ["Estimate #", booking.estimateNumber],
                        booking?.invoiceNumber && ["Invoice #", booking.invoiceNumber],
                    ].filter(Boolean).map(([label, value]) => value ? (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                            <span style={{ color: "#64748b" }}>{label}</span>
                            <span style={{ fontWeight: 600, color: "#0f172a", maxWidth: "60%", textAlign: "right" }}>{value}</span>
                        </div>
                    ) : null)}
                </div>
            </div>
        </div>
    );
}
