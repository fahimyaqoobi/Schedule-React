"use client";

import { useState, useRef, useEffect } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../../lib/firebase";

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

// ── Shared styles ────────────────────────────────────────────────
const S = {
    page: {
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #f0f6fc 0%, #ffffff 60%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "0 0 48px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', Helvetica, Arial, sans-serif",
    },
    header: {
        width: "100%",
        background: `linear-gradient(135deg, ${BRAND} 0%, ${ACTION} 100%)`,
        padding: "28px 24px 32px",
        textAlign: "center",
        color: "#fff",
    },
    logo: { height: 38, objectFit: "contain", display: "block", margin: "0 auto 16px" },
    card: {
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "0 16px",
    },
    box: {
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #dce8f2",
        boxShadow: "0 8px 32px rgba(0,86,145,0.10)",
        padding: "28px 24px",
        marginTop: -20,
    },
    label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: ACTION, textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: {
        width: "100%", boxSizing: "border-box",
        padding: "14px 16px", borderRadius: 12,
        border: "1.5px solid #d0dce8", fontSize: 17,
        fontFamily: "inherit", outline: "none",
        transition: "border-color 0.15s",
        background: "#f8fbff",
    },
    btn: {
        width: "100%", padding: "16px", borderRadius: 14,
        background: `linear-gradient(135deg, ${BRAND} 0%, ${ACTION} 100%)`,
        color: "#fff", fontWeight: 700, fontSize: 17,
        border: "none", cursor: "pointer", marginTop: 16,
        letterSpacing: "-0.01em", transition: "opacity 0.15s",
    },
    btnGhost: {
        background: "none", border: `1.5px solid ${ACTION}`,
        color: ACTION, fontWeight: 600, fontSize: 15,
        padding: "13px", borderRadius: 14,
        cursor: "pointer", width: "100%", marginTop: 10,
        fontFamily: "inherit",
    },
    btnGreen: {
        width: "100%", padding: "16px", borderRadius: 14,
        background: `linear-gradient(135deg, ${GREEN} 0%, #5a8a2a 100%)`,
        color: "#fff", fontWeight: 700, fontSize: 17,
        border: "none", cursor: "pointer", marginTop: 16,
        letterSpacing: "-0.01em",
    },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eef3f8" },
    rowLast: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" },
    rowLabel: { fontSize: 14, color: "#526276" },
    rowValue: { fontSize: 14, fontWeight: 600, color: "#071b3a" },
    totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: BRAND, borderRadius: 12, marginTop: 14 },
    sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "#8fa3b8", textTransform: "uppercase", marginBottom: 12, marginTop: 20, display: "block" },
    infoRow: { display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", fontSize: 14, color: "#344a5e" },
};

// ── OTP digit input row ──────────────────────────────────────────
function OtpBoxes({ value, onChange }) {
    const refs = Array.from({ length: 6 }, () => useRef(null));
    const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

    function handleKey(e, i) {
        if (e.key === "Backspace") {
            const next = value.slice(0, i) + value.slice(i + 1);
            onChange(next);
            if (i > 0) setTimeout(() => refs[i - 1].current?.focus(), 0);
            return;
        }
        const ch = e.key.replace(/[^0-9]/, "");
        if (!ch) return;
        const next = value.slice(0, i) + ch + value.slice(i + 1);
        onChange(next.slice(0, 6));
        if (i < 5) setTimeout(() => refs[i + 1].current?.focus(), 0);
    }

    function handlePaste(e) {
        const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (pasted) { onChange(pasted); setTimeout(() => refs[Math.min(pasted.length, 5)].current?.focus(), 0); }
        e.preventDefault();
    }

    return (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={refs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    readOnly
                    onKeyDown={(e) => handleKey(e, i)}
                    onPaste={handlePaste}
                    onClick={() => refs[i].current?.focus()}
                    style={{
                        width: 44, height: 54, textAlign: "center",
                        fontSize: 24, fontWeight: 700, fontFamily: "inherit",
                        border: `2px solid ${d ? ACTION : "#d0dce8"}`,
                        borderRadius: 12, background: d ? "#f0f6fc" : "#fff",
                        outline: "none", color: BRAND,
                        transition: "border-color 0.15s, background 0.15s",
                    }}
                    onFocus={(e) => e.target.style.borderColor = ACTION}
                    onBlur={(e) => e.target.style.borderColor = d ? ACTION : "#d0dce8"}
                />
            ))}
        </div>
    );
}

// ── Price breakdown ──────────────────────────────────────────────
function PriceBreakdown({ booking }) {
    const { subtotal, tax, price, promoCode, promoDiscount, promoName } = booking;
    const lines = [
        { label: "Subtotal", value: fmt$(subtotal) },
        { label: "HST (13%)", value: fmt$(tax) },
        ...(promoCode && promoDiscount > 0 ? [{ label: `${promoName || "Promo"} (${promoCode})`, value: `-${fmt$(promoDiscount)}`, color: GREEN }] : []),
    ];
    return (
        <div>
            {lines.map((l, i) => (
                <div key={i} style={i < lines.length - 1 ? S.row : S.rowLast}>
                    <span style={S.rowLabel}>{l.label}</span>
                    <span style={{ ...S.rowValue, color: l.color || S.rowValue.color }}>{l.value}</span>
                </div>
            ))}
            <div style={S.totalRow}>
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Total</span>
                <span style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{fmt$(price)}</span>
            </div>
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────
export default function CustomerFlow({ phone, bookingId, paid, cancelled }) {
    const [step, setStep] = useState(paid ? "paid_return" : "landing");
    const [otp, setOtp] = useState("");
    const [booking, setBooking] = useState(null);
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const confirmRef = useRef(null);
    const recaptchaRef = useRef(null);

    // Resend countdown timer
    useEffect(() => {
        if (resendCountdown <= 0) return;
        const t = setTimeout(() => setResendCountdown(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCountdown]);

    // Auto-send OTP when landing (phone is pre-filled from URL)
    // No — require button tap for better UX and to avoid recaptcha issues on mount

    async function sendOtp() {
        setBusy(true);
        setError("");
        try {
            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
            }
            const digits = phone.replace(/\D/g, "").slice(-10);
            const formatted = `+1${digits}`;
            const result = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current);
            confirmRef.current = result;
            setStep("otp");
            setResendCountdown(60);
        } catch (err) {
            setError(err.message?.includes("too-many-requests")
                ? "Too many attempts. Please wait a few minutes and try again."
                : "Could not send verification code. Please check your phone number or try again.");
            // Reset recaptcha on error so next attempt works
            recaptchaRef.current = null;
        }
        setBusy(false);
    }

    async function verifyOtp() {
        if (!confirmRef.current || otp.length !== 6) return;
        setBusy(true);
        setError("");
        try {
            const cred = await confirmRef.current.confirm(otp);
            const idToken = await cred.user.getIdToken();
            setToken(idToken);

            if (!bookingId) {
                setStep("no_booking");
                setBusy(false);
                return;
            }

            const res = await fetch(`/api/customer/booking?bookingId=${encodeURIComponent(bookingId)}`, {
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load your booking.");

            setBooking(data);
            if (data.customerConfirmed && data.documentStage !== "invoice") {
                setStep("already_confirmed");
            } else if (data.paymentStatus === "paid") {
                setStep("already_paid");
            } else {
                setStep(data.documentStage === "invoice" ? "invoice" : "estimate");
            }
        } catch (err) {
            setError(err.message?.includes("invalid-verification-code") || err.message?.includes("invalid-verification")
                ? "Incorrect code. Please check and try again."
                : err.message || "Verification failed.");
        }
        setBusy(false);
    }

    async function confirmJob() {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/customer/confirm", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not confirm. Please try again.");
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
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Payment setup failed. Please try again.");
            window.location.href = data.url;
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    // ── Render ───────────────────────────────────────────────────

    const isEstimate = booking?.documentStage !== "invoice";
    const docLabel = isEstimate ? "Estimate" : "Invoice";
    const docNumber = isEstimate ? booking?.estimateNumber : booking?.invoiceNumber;

    return (
        <div style={S.page}>
            {/* Hidden recaptcha container */}
            <div id="recaptcha-container" style={{ position: "fixed", bottom: 0, opacity: 0, pointerEvents: "none" }} />

            {/* Header */}
            <div style={S.header}>
                <img src="/logo-full.png" alt="SmarTouch Clean" style={S.logo} onError={e => { e.target.style.display = "none"; }} />
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", opacity: 0.82, textTransform: "uppercase" }}>
                    SmarTouch Clean
                </div>
            </div>

            <div style={S.card}>
                <div style={S.box}>

                    {/* ── LANDING ─────────────────────────────── */}
                    {step === "landing" && (
                        <>
                            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>
                                Verify your identity
                            </div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 24px" }}>
                                We'll send a one-time code to confirm it's you before showing your document.
                            </p>
                            {phone && (
                                <div style={{ background: "#f0f6fc", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                                    <span style={{ fontSize: 22 }}>📱</span>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: ACTION, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your phone on file</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: BRAND, letterSpacing: "0.02em" }}>{maskPhone(phone)}</div>
                                    </div>
                                </div>
                            )}
                            {error && <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12, padding: "10px 14px", background: "#fff5f5", borderRadius: 10 }}>{error}</div>}
                            <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} onClick={sendOtp} disabled={busy}>
                                {busy ? "Sending…" : "Send Verification Code"}
                            </button>
                            <p style={{ fontSize: 12, color: "#8fa3b8", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
                                Standard SMS rates may apply. Your number is never shared.
                            </p>
                        </>
                    )}

                    {/* ── OTP ENTRY ───────────────────────────── */}
                    {step === "otp" && (
                        <>
                            <button onClick={() => setStep("landing")} style={{ background: "none", border: "none", color: ACTION, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
                                ← Back
                            </button>
                            <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 6 }}>
                                Enter the code
                            </div>
                            <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: "0 0 4px" }}>
                                Sent to {maskPhone(phone)}
                            </p>
                            <OtpBoxes value={otp} onChange={setOtp} />
                            {error && <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12, padding: "10px 14px", background: "#fff5f5", borderRadius: 10 }}>{error}</div>}
                            <button style={{ ...S.btn, opacity: (busy || otp.length !== 6) ? 0.55 : 1 }} onClick={verifyOtp} disabled={busy || otp.length !== 6}>
                                {busy ? "Verifying…" : "Verify & Continue"}
                            </button>
                            <div style={{ textAlign: "center", marginTop: 16 }}>
                                {resendCountdown > 0 ? (
                                    <span style={{ fontSize: 14, color: "#8fa3b8" }}>Resend in {resendCountdown}s</span>
                                ) : (
                                    <button onClick={() => { setOtp(""); sendOtp(); }} style={{ background: "none", border: "none", color: ACTION, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                                        Resend code
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── ESTIMATE ────────────────────────────── */}
                    {step === "estimate" && booking && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: ACTION, textTransform: "uppercase" }}>Estimate</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>{booking.service || "Cleaning Service"}</div>
                                </div>
                                {docNumber && <div style={{ fontSize: 12, color: "#8fa3b8", fontWeight: 600, textAlign: "right", paddingTop: 4 }}>#{docNumber}</div>}
                            </div>

                            <span style={S.sectionLabel}>Service Details</span>
                            {booking.date && <div style={S.infoRow}><span>📅</span> {formatDate(booking.date)}{booking.time ? ` at ${booking.time}` : ""}</div>}
                            {booking.address1 && <div style={S.infoRow}><span>📍</span> {[booking.address1, booking.address2, booking.city, booking.postalCode].filter(Boolean).join(", ")}</div>}

                            <span style={S.sectionLabel}>Pricing</span>
                            <PriceBreakdown booking={booking} />

                            {error && <div style={{ color: "#c0392b", fontSize: 14, marginTop: 14, padding: "10px 14px", background: "#fff5f5", borderRadius: 10 }}>{error}</div>}

                            <button style={{ ...S.btnGreen, opacity: busy ? 0.6 : 1 }} onClick={confirmJob} disabled={busy}>
                                {busy ? "Confirming…" : "✓ Confirm This Job"}
                            </button>
                            <p style={{ fontSize: 12, color: "#8fa3b8", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
                                Our team will review and approve your booking after confirmation.
                            </p>
                        </>
                    )}

                    {/* ── INVOICE ─────────────────────────────── */}
                    {step === "invoice" && booking && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: ACTION, textTransform: "uppercase" }}>Invoice</div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>{booking.service || "Cleaning Service"}</div>
                                </div>
                                {docNumber && <div style={{ fontSize: 12, color: "#8fa3b8", fontWeight: 600, textAlign: "right", paddingTop: 4 }}>#{docNumber}</div>}
                            </div>

                            <span style={S.sectionLabel}>Service Details</span>
                            {booking.date && <div style={S.infoRow}><span>📅</span> {formatDate(booking.date)}{booking.time ? ` at ${booking.time}` : ""}</div>}
                            {booking.address1 && <div style={S.infoRow}><span>📍</span> {[booking.address1, booking.address2, booking.city, booking.postalCode].filter(Boolean).join(", ")}</div>}

                            <span style={S.sectionLabel}>Amount Due</span>
                            <PriceBreakdown booking={booking} />

                            {error && <div style={{ color: "#c0392b", fontSize: 14, marginTop: 14, padding: "10px 14px", background: "#fff5f5", borderRadius: 10 }}>{error}</div>}

                            <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} onClick={payInvoice} disabled={busy}>
                                {busy ? "Redirecting to payment…" : `Pay Now — ${fmt$(booking.price)}`}
                            </button>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#635BFF"/><path d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" fill="#fff"/></svg>
                                <span style={{ fontSize: 12, color: "#8fa3b8" }}>Secured by Stripe</span>
                            </div>
                        </>
                    )}

                    {/* ── CONFIRMED ───────────────────────────── */}
                    {step === "confirmed" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 8 }}>Job Confirmed!</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                    Thank you! Our team will review your confirmation and reach out to finalize the details.
                                </p>
                            </div>
                            <div style={{ background: "#f0f8e8", borderRadius: 12, padding: "14px 16px", marginTop: 16 }}>
                                <div style={{ fontSize: 13, color: "#3d6b1a", lineHeight: 1.6 }}>
                                    You'll receive a confirmation SMS once approved. Questions? Call us at{" "}
                                    <a href="tel:6134165001" style={{ color: GREEN, fontWeight: 700 }}>613-416-5001</a>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── PAID (returned from Stripe) ──────────── */}
                    {step === "paid_return" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 56, marginBottom: 12 }}>💳</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>Payment Received!</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                    Your payment was processed successfully. You'll receive a receipt by email.
                                </p>
                            </div>
                            <div style={{ background: "#f0f6fc", borderRadius: 12, padding: "14px 16px", marginTop: 16 }}>
                                <div style={{ fontSize: 13, color: "#344a5e", lineHeight: 1.6 }}>
                                    Questions? Call us at{" "}
                                    <a href="tel:6134165001" style={{ color: ACTION, fontWeight: 700 }}>613-416-5001</a>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── ALREADY CONFIRMED ───────────────────── */}
                    {step === "already_confirmed" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>👍</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>Already Confirmed</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                    You already confirmed this job. Our team is on it!
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── ALREADY PAID ────────────────────────── */}
                    {step === "already_paid" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN, letterSpacing: "-0.02em", marginBottom: 8 }}>Invoice Paid</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                    This invoice has already been paid. Thank you!
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── NO BOOKING ──────────────────────────── */}
                    {step === "no_booking" && (
                        <>
                            <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-0.02em", marginBottom: 8 }}>No Document Found</div>
                                <p style={{ fontSize: 15, color: "#526276", lineHeight: 1.65, margin: 0 }}>
                                    We couldn't find a document linked to this code. Please use the link from your email or SMS, or contact us.
                                </p>
                            </div>
                            <a href="tel:6134165001" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", marginTop: 16 }}>
                                Call 613-416-5001
                            </a>
                        </>
                    )}

                </div>

                {/* Footer */}
                <p style={{ fontSize: 12, color: "#9ab0c4", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                    SmarTouch Clean · Ottawa, ON · smartouchclean.com
                </p>
            </div>
        </div>
    );
}
