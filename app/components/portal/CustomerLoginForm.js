"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const BRAND = "#005691";
const ACTION = "#0A6CB8";

function formatPhone(raw) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function CustomerLoginForm() {
    const router = useRouter();
    const [step, setStep] = useState("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");          // single string, not array
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const otpInputRef = useRef(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    // Focus the hidden input whenever the OTP step is shown
    useEffect(() => {
        if (step === "otp") {
            const t = setTimeout(() => otpInputRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
    }, [step]);

    async function sendOtp() {
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) { setError("Please enter a valid 10-digit number."); return; }
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/customer/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: digits }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Failed to send code.");
            setOtp("");
            setStep("otp");
            setCooldown(60);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    async function verifyOtp() {
        if (otp.length !== 6) { setError("Please enter the 6-digit code."); return; }
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/customer/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.replace(/\D/g, ""), code: otp }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Verification failed.");
            router.push(data.isNewCustomer ? "/customer/onboarding" : "/customer/home");
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    const S = {
        page: { minHeight: "100dvh", background: "linear-gradient(160deg,#f0f7ff 0%,#f8fafc 60%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" },
        card: { background: "#fff", borderRadius: 24, padding: "36px 24px 28px", width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,86,145,0.13)" },
        logo: { textAlign: "center", marginBottom: 30 },
        logoText: { fontSize: 28, fontWeight: 900, color: BRAND, letterSpacing: "-0.5px" },
        logoSub: { fontSize: 13, color: "#64748b", marginTop: 4 },
        label: { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase" },
        input: { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", fontSize: 18, outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: "#0f172a" },
        btn: { width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 18, letterSpacing: "0.02em" },
        error: { color: "#dc2626", fontSize: 13, marginTop: 12, textAlign: "center" },
        ghost: { background: "none", border: "none", color: ACTION, fontSize: 13, cursor: "pointer", fontWeight: 600, padding: 0 },
    };

    return (
        <div style={S.page}>
            <div style={S.card}>
                <div style={S.logo}>
                    <div style={S.logoText}>Smartouch Clean</div>
                    <div style={S.logoSub}>Your personal cleaning portal</div>
                </div>

                {step === "phone" ? (
                    <>
                        <label style={S.label}>Mobile Number</label>
                        <input
                            style={S.input}
                            type="tel"
                            inputMode="numeric"
                            placeholder="(416) 555-0123"
                            value={phone}
                            onChange={e => setPhone(formatPhone(e.target.value))}
                            onKeyDown={e => e.key === "Enter" && sendOtp()}
                            maxLength={14}
                            autoFocus
                        />
                        <button style={{ ...S.btn, opacity: loading ? 0.7 : 1 }} onClick={sendOtp} disabled={loading}>
                            {loading ? "Sending…" : "Send Verification Code"}
                        </button>
                    </>
                ) : (
                    <>
                        <p style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 6 }}>
                            Code sent to <strong>{phone}</strong>
                        </p>

                        {/* OTP entry — single hidden input overlaid over 6 visual boxes */}
                        <div
                            style={{ position: "relative", display: "flex", gap: 8, justifyContent: "center", margin: "20px 0", cursor: "text" }}
                            onClick={() => otpInputRef.current?.focus()}
                        >
                            {/* Visual boxes */}
                            {Array.from({ length: 6 }, (_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: 46, height: 54, borderRadius: 12, textAlign: "center",
                                        lineHeight: "54px", fontSize: 26, fontWeight: 700, color: BRAND,
                                        background: "#fff", flexShrink: 0,
                                        border: `1.5px solid ${otp[i] ? ACTION : i === otp.length ? "#94a3b8" : "#e2e8f0"}`,
                                        transition: "border-color 0.15s",
                                    }}
                                >
                                    {otp[i] || ""}
                                </div>
                            ))}

                            {/* Single invisible input covering the whole row — captures all input */}
                            <input
                                ref={otpInputRef}
                                type="tel"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={otp}
                                onChange={e => {
                                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                    setOtp(v);
                                    if (v.length === 6) verifyOtp();
                                }}
                                onKeyDown={e => e.key === "Enter" && verifyOtp()}
                                maxLength={6}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    opacity: 0,
                                    border: "none",
                                    outline: "none",
                                    fontSize: 16,   // prevents iOS auto-zoom
                                    cursor: "text",
                                    zIndex: 2,
                                    WebkitTapHighlightColor: "transparent",
                                }}
                            />
                        </div>

                        <button style={{ ...S.btn, opacity: loading || otp.length !== 6 ? 0.7 : 1 }} onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                            {loading ? "Verifying…" : "Verify & Sign In"}
                        </button>

                        <div style={{ textAlign: "center", marginTop: 16 }}>
                            {cooldown > 0 ? (
                                <span style={{ fontSize: 13, color: "#94a3b8" }}>Resend code in {cooldown}s</span>
                            ) : (
                                <button style={S.ghost} onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>
                                    ← Change number or resend
                                </button>
                            )}
                        </div>
                    </>
                )}

                {error && <div style={S.error}>{error}</div>}
            </div>
        </div>
    );
}
