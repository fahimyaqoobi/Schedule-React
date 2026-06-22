"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const PROVINCES = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL", "NT", "YT", "NU"];

const inputStyle = {
    width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "15px 16px",
    fontSize: 17, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#0f172a",
};

const STEPS = ["Your Name", "Email Address", "Service Address"];

export default function CustomerOnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [province, setProvince] = useState("ON");
    const [postalCode, setPostalCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // Pre-fill any data already in profile (from existing bookings)
    useEffect(() => {
        fetch("/api/customer/profile")
            .then(r => r.json())
            .then(d => {
                const p = d.profile || {};
                if (p.name) setName(p.name);
                if (p.email) setEmail(p.email);
                if (p.address) setAddress(p.address);
                if (p.city) setCity(p.city);
                if (p.province) setProvince(p.province);
                if (p.postalCode) setPostalCode(p.postalCode);
            })
            .catch(() => {});
    }, []);

    function next() {
        setErr("");
        if (step === 0 && !name.trim()) { setErr("Please enter your full name."); return; }
        if (step === 1 && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Please enter a valid email address."); return; }
        if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
        // Last step — save and redirect
        finish();
    }

    async function finish() {
        setSaving(true); setErr("");
        try {
            const res = await fetch("/api/customer/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, address, city, province, postalCode }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Could not save. Please try again.");
            router.push("/customer/home");
        } catch (e) { setErr(e.message); }
        finally { setSaving(false); }
    }

    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#f0f7ff 0%,#f8fafc 60%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
            <div style={{ background: "#fff", borderRadius: 24, padding: "36px 24px 28px", width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,86,145,0.13)" }}>

                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: BRAND }}>Smartouch Clean</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Let&apos;s get you set up</div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        {STEPS.map((label, i) => (
                            <div key={label} style={{ fontSize: 10, fontWeight: 700, color: i <= step ? ACTION : "#cbd5e1", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                {label}
                            </div>
                        ))}
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: ACTION, borderRadius: 4, width: `${progress}%`, transition: "width 0.3s ease" }} />
                    </div>
                </div>

                {/* Step 0 — Name */}
                {step === 0 && (
                    <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>What&apos;s your name?</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
                            This is how we&apos;ll greet you and personalize your experience.
                        </div>
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && next()}
                            placeholder="Full Name"
                            style={inputStyle}
                        />
                    </>
                )}

                {/* Step 1 — Email */}
                {step === 1 && (
                    <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Email address?</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
                            For receipts, invoices, and appointment reminders. You can skip this for now.
                        </div>
                        <input
                            autoFocus
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && next()}
                            placeholder="you@example.com (optional)"
                            style={inputStyle}
                        />
                    </>
                )}

                {/* Step 2 — Address */}
                {step === 2 && (
                    <>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Your service address?</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
                            Where do you want us to clean? You can update this anytime.
                        </div>
                        <input
                            autoFocus
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Street address"
                            style={{ ...inputStyle, marginBottom: 10 }}
                        />
                        <input
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            placeholder="City"
                            style={{ ...inputStyle, marginBottom: 10 }}
                        />
                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                            <select value={province} onChange={e => setProvince(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                {PROVINCES.map(p => <option key={p}>{p}</option>)}
                            </select>
                            <input
                                value={postalCode}
                                onChange={e => setPostalCode(e.target.value.toUpperCase())}
                                placeholder="Postal Code"
                                maxLength={7}
                                style={{ ...inputStyle, flex: 1 }}
                            />
                        </div>
                    </>
                )}

                {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}

                <button
                    onClick={next}
                    disabled={saving}
                    style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 20, opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? "Saving…" : step < STEPS.length - 1 ? "Continue →" : "All Done — Let's Go!"}
                </button>

                {step > 0 && (
                    <button onClick={() => { setStep(s => s - 1); setErr(""); }} style={{ width: "100%", background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 12, padding: "8px 0" }}>
                        ← Back
                    </button>
                )}

                {step === 1 && (
                    <button onClick={next} style={{ width: "100%", background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 4, padding: "4px 0" }}>
                        Skip for now
                    </button>
                )}

                {step === 2 && (
                    <button onClick={finish} disabled={saving} style={{ width: "100%", background: "none", border: "none", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginTop: 4, padding: "4px 0" }}>
                        Skip address for now
                    </button>
                )}
            </div>
        </div>
    );
}
