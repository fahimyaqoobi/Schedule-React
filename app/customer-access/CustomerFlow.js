"use client";

import { useState, useRef, useEffect } from "react";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

function fmt$(n) { return `$${Number(n || 0).toFixed(2)}`; }

function maskPhone(phone = "") {
    const d = phone.replace(/\D/g, "").slice(-10);
    if (d.length < 10) return phone;
    return `(${d.slice(0, 3)}) •••-${d.slice(6)}`;
}

function formatDate(val = "") {
    if (!val) return "";
    const d = new Date(`${val}T00:00:00`);
    if (isNaN(d)) return val;
    return d.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const S = {
    page: {
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #f0f6fc 0%, #ffffff 60%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 0 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', Helvetica, Arial, sans-serif",
    },
    header: {
        width: "100%",
        background: `linear-gradient(135deg, ${BRAND} 0%, ${ACTION} 100%)`,
        padding: "28px 24px 32px", textAlign: "center", color: "#fff",
    },
    logo: { height: 38, objectFit: "contain", display: "block", margin: "0 auto 16px" },
    card: { width: "100%", maxWidth: 480, margin: "0 auto", padding: "0 16px" },
    box: {
        background: "#fff", borderRadius: 20, border: "1px solid #dce8f2",
        boxShadow: "0 8px 32px rgba(0,86,145,0.10)", padding: "28px 24px", marginTop: -20,
    },
    btn: {
        width: "100%", padding: "16px", borderRadius: 14,
        background: `linear-gradient(135deg, ${BRAND} 0%, ${ACTION} 100%)`,
        color: "#fff", fontWeight: 700, fontSize: 17, border: "none",
        cursor: "pointer", marginTop: 16, letterSpacing: "-0.01em",
        transition: "opacity 0.15s", fontFamily: "inherit",
    },
    btnGreen: {
        width: "100%", padding: "16px", borderRadius: 14,
        background: `linear-gradient(135deg, ${GREEN} 0%, #5a8a2a 100%)`,
        color: "#fff", fontWeight: 700, fontSize: 17, border: "none",
        cursor: "pointer", marginTop: 16, letterSpacing: "-0.01em", fontFamily: "inherit",
    },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eef3f8" },
    rowLast: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" },
    totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: BRAND, borderRadius: 12, marginTop: 14 },
    sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "#8fa3b8", textTransform: "uppercase", marginBottom: 12, marginTop: 20, display: "block" },
    infoRow: { display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 14, color: "#344a5e" },
    errorBox: { color: "#c0392b", fontSize: 14, marginTop: 12, padding: "10px 14px", background: "#fff5f5", borderRadius: 10 },
};

function OtpBoxes({ value, onChange }) {
    const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    useEffect(() => { refs[0].current?.focus(); }, []);

    function handleKeyDown(e, i) {
        if (e.key === "Backspace") {
            e.preventDefault();
            const next = value.slice(0, i) + value.slice(i + 1);
            onChange(next);
            if (i > 0) refs[i - 1].current?.focus();
            return;
        }
        const ch = e.key.replace(/[^0-9]/, "");
        if (!ch) return;
        e.preventDefault();
        const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6);
        onChange(next);
        if (i < 5) refs[i + 1].current?.focus();
    }

    function handlePaste(e) {
        const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (pasted) {
            onChange(pasted);
            refs[Math.min(pasted.length, 5)].current?.focus();
        }
        e.preventDefault();
    }

    return (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
            {Array.from({ length: 6 }, (_, i) => {
                const d = value[i] || "";
                return (
                    <input
                        key={i}
                        ref={refs[i]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        readOnly
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        onPaste={handlePaste}
                        onClick={() => refs[i].current?.focus()}
                        style={{
                            width: 44, height: 54, textAlign: "center",
                            fontSize: 24, fontWeight: 700, fontFamily: "inherit",
                            border: `2px solid ${d ? ACTION : "#d0dce8"}`,
                            borderRadius: 12, background: d ? "#f0f6fc" : "#fff",
                            outline: "none", color: BRAND,
                        }}
                    />
                );
            })}
        </div>
    );
}

function PriceBreakdown({ booking }) {
    const { subtotal, tax, price, promoCode, promoDiscount, promoName } = booking;
    const lines = [
        { label: "Subtotal", value: fmt$(subtotal) },
        { label: "HST (13%)", value: fmt$(tax) },
        ...(promoCode && promoDiscount > 0
            ? [{ label: `${promoName || "Promo"} (${promoCode})`, value: `-${fmt$(promoDiscount)}`, color: GREEN }]
            : []),
    ];
    return (
        <div>
            {lines.map((l, i) => (
                <div key={i} style={i < lines.length - 1 ? S.row : S.rowLast}>
                    <span style={{ fontSize: 14, color: "#526276" }}>{l.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: l.color || "#071b3a" }}>{l.value}</span>
                </div>
            ))}
            <div style={S.totalRow}>
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Total</span>
                <span style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{fmt$(price)}</span>
            </div>
        </div>
    );
}

export default function CustomerFlow({ phone, bookingId, paid }) {
    const [step, setStep] = useState(paid ? "paid_return" : "landing");
    const [otp, setOtp] = useState("");
    const [booking, setBooking] = useState(null);
    const [sessionToken, setSessionToken] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    async function sendCode() {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/customer/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not send code.");
            setStep("otp");
            setOtp("");
            setCountdown(60);
        } catch (err) {
            setError(err.message);
        }
        setBusy(false);
    }

    async function verifyCode() {
        if (otp.length !== 6) return;
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/customer/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code: otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Verification failed.");

            setSessionToken(data.sessionToken);

            if (!bookingId) { setStep("no_booking"); setBusy(false); return; }

            const bookRes = await fetch(`/api/customer/booking?bookingId=${encodeURIComponent(bookingId)}`, {
                headers: { Authorization: `Bearer ${data.sessionToken}` },
            });
            const bookData = await bookRes.json();
            if (!bookRes.ok) throw new Error(bookData.error || "Could not load your document.");

            setBooking(bookData);
            if (bookData.paymentStatus === "paid") setStep("already_paid");
            else if (bookData.customerConfirmed && bookData.documentStage !== "invoice") setStep("already_confirmed");
            else setStep(bookData.documentStage === "invoice" ? "invoice" : "estimate");
        } catch (err) {
            setError(err.message);
        }
        setBusy(false);
    }

    async function confirmJob() {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/customer/confirm", {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not confirm.");
            setStep("confirmed");
        } catch (err) {
            setError(err.message);
        }
        setBusy(false);
    }

    async function payInvoice() {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/customer/pay", {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Payment setup failed.");
            window.location.href = data.url;
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    const isInvoice = booking?.documentStage === "invoice";
    const docNumber = isInvoice ? booking?.invoiceNumber : booking?.estimateNumber;

    return (
        <div style={S.page}>
            <div style={S.header}>
                <img src="/logo-full.png" alt="SmarTouch Clean" style={S.logo}
                    onError={e => { e.target.style.display = "none"; }} />
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", opacity: 0.82, textTransform: "uppercase" }}>
                    SmarTouch Clean
                </div>
            </div>

            <div style={S.card}>
                <div style={S.box}>

                    {/* LANDING */}
                    {step === "landing" && (
                        <>
                            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>
                                Verify your identity
                            </div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 20px" }}>
                                We'll send a one-time code to confirm it's you before showing your document.
                            </p>
                            {phone && (
                                <div style={{ background: "#f0f6fc", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 22 }}>📱</span>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: ACTION, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your phone on file</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: BRAND }}>{maskPhone(phone)}</div>
                                    </div>
                                </div>
                            )}
                            {error && <div style={S.errorBox}>{error}</div>}
                            <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} onClick={sendCode} disabled={busy}>
                                {busy ? "Sending…" : "Send Verification Code"}
                            </button>
                            <p style={{ fontSize: 12, color: "#8fa3b8", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
                                Standard SMS rates may apply. Your number is never shared.
                            </p>
                        </>
                    )}

                    {/* OTP */}
                    {step === "otp" && (
                        <>
                            <button onClick={() => { setStep("landing"); setError(""); }} style={{ background: "none", border: "none", color: ACTION, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
                                ← Back
                            </button>
                            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 6 }}>
                                Enter the code
                            </div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 4px" }}>
                                Sent via SMS to {maskPhone(phone)}
                            </p>
                            <OtpBoxes value={otp} onChange={setOtp} />
                            {error && <div style={S.errorBox}>{error}</div>}
                            <button style={{ ...S.btn, opacity: (busy || otp.length !== 6) ? 0.5 : 1 }} onClick={verifyCode} disabled={busy || otp.length !== 6}>
                                {busy ? "Verifying…" : "Verify & Continue"}
                            </button>
                            <div style={{ textAlign: "center", marginTop: 14 }}>
                                {countdown > 0
                                    ? <span style={{ fontSize: 13, color: "#8fa3b8" }}>Resend in {countdown}s</span>
                                    : <button onClick={() => { setOtp(""); sendCode(); }} style={{ background: "none", border: "none", color: ACTION, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Resend code</button>
                                }
                            </div>
                        </>
                    )}

                    {/* ESTIMATE */}
                    {step === "estimate" && booking && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: ACTION, textTransform: "uppercase" }}>Estimate</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>{booking.service || "Cleaning Service"}</div>
                                </div>
                                {docNumber && <div style={{ fontSize: 12, color: "#8fa3b8", fontWeight: 600, paddingTop: 4 }}>#{docNumber}</div>}
                            </div>
                            {(booking.rewardPoints > 0 || booking.referralCode) && (
                                <div style={{ background: "#f0f8e8", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                    {booking.rewardPoints > 0 && <span style={{ fontSize: 13, color: "#3d6b1a", fontWeight: 600 }}>⭐ {booking.rewardPoints} reward points</span>}
                                    {booking.referralCode && <span style={{ fontSize: 12, color: "#526276" }}>Referral: <strong style={{ color: GREEN }}>{booking.referralCode}</strong></span>}
                                </div>
                            )}
                            <span style={S.sectionLabel}>Service Details</span>
                            {booking.date && <div style={S.infoRow}><span>📅</span> {formatDate(booking.date)}{booking.time ? ` at ${booking.time}` : ""}</div>}
                            {booking.address1 && <div style={S.infoRow}><span>📍</span> {[booking.address1, booking.address2, booking.city, booking.postalCode].filter(Boolean).join(", ")}</div>}
                            <span style={S.sectionLabel}>Pricing</span>
                            <PriceBreakdown booking={booking} />
                            {error && <div style={S.errorBox}>{error}</div>}
                            <button style={{ ...S.btnGreen, opacity: busy ? 0.6 : 1 }} onClick={confirmJob} disabled={busy}>
                                {busy ? "Confirming…" : "✓ Confirm This Job"}
                            </button>
                            <p style={{ fontSize: 12, color: "#8fa3b8", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
                                Our team will review and finalize your booking after confirmation.
                            </p>
                        </>
                    )}

                    {/* INVOICE */}
                    {step === "invoice" && booking && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: ACTION, textTransform: "uppercase" }}>Invoice</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>{booking.service || "Cleaning Service"}</div>
                                </div>
                                {docNumber && <div style={{ fontSize: 12, color: "#8fa3b8", fontWeight: 600, paddingTop: 4 }}>#{docNumber}</div>}
                            </div>
                            {booking.rewardPoints > 0 && (
                                <div style={{ background: "#f0f8e8", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                                    <span style={{ fontSize: 13, color: "#3d6b1a", fontWeight: 600 }}>⭐ {booking.rewardPoints} reward points earned so far</span>
                                </div>
                            )}
                            <span style={S.sectionLabel}>Service Details</span>
                            {booking.date && <div style={S.infoRow}><span>📅</span> {formatDate(booking.date)}{booking.time ? ` at ${booking.time}` : ""}</div>}
                            {booking.address1 && <div style={S.infoRow}><span>📍</span> {[booking.address1, booking.address2, booking.city, booking.postalCode].filter(Boolean).join(", ")}</div>}
                            <span style={S.sectionLabel}>Amount Due</span>
                            <PriceBreakdown booking={booking} />
                            {error && <div style={S.errorBox}>{error}</div>}
                            <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} onClick={payInvoice} disabled={busy}>
                                {busy ? "Redirecting to payment…" : `Pay Now — ${fmt$(booking.price)}`}
                            </button>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
                                <span style={{ fontSize: 12, color: "#8fa3b8" }}>🔒 Secured by Stripe</span>
                            </div>
                        </>
                    )}

                    {/* CONFIRMED */}
                    {step === "confirmed" && (
                        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 8 }}>Job Confirmed!</div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 16px" }}>
                                Thank you! Our team will review your confirmation and reach out shortly.
                            </p>
                            <div style={{ background: "#f0f8e8", borderRadius: 12, padding: "14px 16px" }}>
                                <div style={{ fontSize: 13, color: "#3d6b1a", lineHeight: 1.6 }}>
                                    Questions? Call{" "}
                                    <a href="tel:6134165001" style={{ color: GREEN, fontWeight: 700 }}>613-416-5001</a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PAID RETURN */}
                    {step === "paid_return" && (
                        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                            <div style={{ fontSize: 56, marginBottom: 12 }}>💳</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>Payment Received!</div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 16px" }}>
                                Your payment was processed successfully. A receipt will be sent to your email.
                            </p>
                            <div style={{ background: "#f0f6fc", borderRadius: 12, padding: "14px 16px" }}>
                                <div style={{ fontSize: 13, color: "#344a5e", lineHeight: 1.6 }}>
                                    Questions? Call{" "}
                                    <a href="tel:6134165001" style={{ color: ACTION, fontWeight: 700 }}>613-416-5001</a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ALREADY CONFIRMED */}
                    {step === "already_confirmed" && (
                        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>👍</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>Already Confirmed</div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                You already confirmed this job. Our team is on it!
                            </p>
                        </div>
                    )}

                    {/* ALREADY PAID */}
                    {step === "already_paid" && (
                        <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 8 }}>Invoice Paid</div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                This invoice has already been paid. Thank you!
                            </p>
                        </div>
                    )}

                    {/* NO BOOKING */}
                    {step === "no_booking" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>No Document Found</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 16px" }}>
                                    Please use the link from your email or SMS, or contact us.
                                </p>
                            </div>
                            <a href="tel:6134165001" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none" }}>
                                Call 613-416-5001
                            </a>
                        </>
                    )}

                </div>

                <p style={{ fontSize: 12, color: "#9ab0c4", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                    SmarTouch Clean · Ottawa, ON · smartouchclean.com
                </p>
            </div>
        </div>
    );
}
