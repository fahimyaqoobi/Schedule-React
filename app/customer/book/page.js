"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyPromotion } from "../../../lib/promoUtils";
import { calcTotals } from "../../../lib/promoUtils";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const TIME_SLOTS = [
    "Morning (8am–12pm)",
    "Afternoon (12pm–4pm)",
    "Evening (4pm–7pm)",
];

const EXTRAS = [
    { key: "firstTimeClean", label: "First Time Clean Upgrade", price: 87.50 },
    { key: "moveInOut", label: "Move In/Out Upgrade", price: 87.50 },
    { key: "havePets", label: "I Have Pets Premium", price: 17.50 },
    { key: "insideOven", label: "Inside the Oven", price: 31.50 },
    { key: "insideEmptyFridge", label: "Inside an Empty Fridge", price: 17.50 },
    { key: "walls", label: "Walls ($14/room)", price: 14.00 },
    { key: "insideCabinets", label: "Inside Cabinets (emptied)", price: 35.00 },
];

function fmt$(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }

export default function CustomerBookPage() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1=service, 2=schedule, 3=confirm
    const [services, setServices] = useState({});
    const [taxRate, setTaxRate] = useState(0.13);
    const [profile, setProfile] = useState({});
    const [promos, setPromos] = useState([]);

    const [service, setService] = useState("");
    const [selectedExtras, setSelectedExtras] = useState([]);
    const [date, setDate] = useState("");
    const [time, setTime] = useState(TIME_SLOTS[0]);
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [city, setCity] = useState("");
    const [province, setProvince] = useState("ON");
    const [postalCode, setPostalCode] = useState("");
    const [notes, setNotes] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoResult, setPromoResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        Promise.all([
            fetch("/api/customer/services").then(r => r.json()),
            fetch("/api/customer/profile").then(r => r.json()),
        ]).then(([s, p]) => {
            if (s.services) setServices(s.services);
            if (s.taxRate) setTaxRate(s.taxRate);
            const prof = p.profile || {};
            setProfile(prof);
            setAddress1(prof.address || "");
            setCity(prof.city || "");
            setProvince(prof.province || "ON");
            setPostalCode(prof.postalCode || "");
        }).catch(() => {});
    }, []);

    const serviceNames = Object.keys(services);
    const basePrice = services[service] || 0;
    const extrasTotal = selectedExtras.reduce((sum, k) => sum + (EXTRAS.find(e => e.key === k)?.price || 0), 0);
    const subtotal = basePrice + extrasTotal;

    const promoDiscount = promoResult?.ok ? promoResult.discount : 0;
    const totals = calcTotals(subtotal, taxRate, promoDiscount);

    function applyPromo() {
        if (!promoCode.trim()) return;
        const result = applyPromotion({ code: promoCode, subtotal, promotions: promos, customerUsage: profile?.promoHistory || [] });
        setPromoResult(result);
    }

    function toggleExtra(key) {
        setSelectedExtras(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    async function submit() {
        if (!address1 || !city) { setErr("Please enter your service address."); return; }
        if (!date) { setErr("Please select a date."); return; }
        setSubmitting(true); setErr("");
        try {
            const res = await fetch("/api/customer/new-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service,
                    date,
                    time,
                    address1,
                    address2,
                    city,
                    province,
                    postalCode,
                    notes,
                    promoCode: promoResult?.ok ? promoCode : "",
                    extras: selectedExtras.map(k => ({ key: k, label: EXTRAS.find(e => e.key === k)?.label, price: EXTRAS.find(e => e.key === k)?.price })),
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Could not submit booking.");
            router.push(`/customer/jobs/${data.bookingId}?new=true`);
        } catch (e) { setErr(e.message); }
        finally { setSubmitting(false); }
    }

    const S = {
        label: { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 },
        input: { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
        card: { background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 },
        btn: { width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 },
        serviceBtn: (active) => ({ width: "100%", background: active ? ACTION : "#f8fafc", color: active ? "#fff" : "#0f172a", border: active ? "none" : "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 8, fontSize: 14, fontWeight: 700, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between" }),
        extraBtn: (active) => ({ background: active ? ACTION + "14" : "#f8fafc", border: active ? `1.5px solid ${ACTION}` : "1.5px solid #e2e8f0", borderRadius: 12, padding: "11px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, width: "100%", fontFamily: "inherit" }),
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div>
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 24px", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Book a Clean</div>
                {/* Progress */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    {[1, 2, 3].map(n => (
                        <div key={n} style={{ flex: 1, height: 4, borderRadius: 4, background: n <= step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }} />
                    ))}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                    Step {step} of 3 — {["Select Service", "Schedule", "Confirm & Address"][step - 1]}
                </div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>

                {/* ─── Step 1: Service ─── */}
                {step === 1 && (
                    <>
                        <div style={S.card}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>House Cleaning</div>
                            {serviceNames.filter(n => !["Window Cleaning", "Gutter Cleaning", "Power Washing"].includes(n)).map(name => (
                                <button key={name} style={S.serviceBtn(service === name)} onClick={() => setService(name)}>
                                    <span>{name}</span>
                                    <span style={{ opacity: service === name ? 1 : 0.6 }}>{fmt$(services[name])}</span>
                                </button>
                            ))}
                        </div>

                        <div style={S.card}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Specialty Services</div>
                            {["Window Cleaning", "Gutter Cleaning", "Power Washing"].filter(n => services[n]).map(name => (
                                <button key={name} style={S.serviceBtn(service === name)} onClick={() => setService(name)}>
                                    <span>{name}</span>
                                    <span style={{ opacity: service === name ? 1 : 0.6 }}>{fmt$(services[name])}</span>
                                </button>
                            ))}
                        </div>

                        {service && (
                            <div style={S.card}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Add-Ons</div>
                                {EXTRAS.map(({ key, label, price }) => (
                                    <button key={key} style={S.extraBtn(selectedExtras.includes(key))} onClick={() => toggleExtra(key)}>
                                        <span style={{ fontSize: 14, color: selectedExtras.includes(key) ? ACTION : "#0f172a", fontWeight: selectedExtras.includes(key) ? 700 : 400 }}>{label}</span>
                                        <span style={{ fontSize: 13, color: selectedExtras.includes(key) ? ACTION : "#64748b", fontWeight: 700 }}>+{fmt$(price)}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{err}</div>}
                        <button style={{ ...S.btn, opacity: !service ? 0.5 : 1 }} disabled={!service} onClick={() => { setErr(""); setStep(2); }}>
                            Next: Schedule →
                        </button>
                    </>
                )}

                {/* ─── Step 2: Schedule ─── */}
                {step === 2 && (
                    <>
                        <div style={S.card}>
                            <label style={S.label}>Preferred Date</label>
                            <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} style={S.input} />
                        </div>

                        <div style={S.card}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Time Preference</div>
                            {TIME_SLOTS.map(slot => (
                                <button key={slot} style={{ ...S.serviceBtn(time === slot), justifyContent: "flex-start", gap: 10 }} onClick={() => setTime(slot)}>
                                    <span style={{ fontSize: 18 }}>{slot.startsWith("Morning") ? "🌅" : slot.startsWith("Afternoon") ? "☀️" : "🌆"}</span>
                                    <span>{slot}</span>
                                </button>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                            <button style={{ ...S.btn, background: "#f1f5f9", color: "#475569" }} onClick={() => setStep(1)}>← Back</button>
                            <button style={{ ...S.btn, opacity: !date ? 0.5 : 1 }} disabled={!date} onClick={() => { setErr(""); setStep(3); }}>Next: Confirm →</button>
                        </div>
                    </>
                )}

                {/* ─── Step 3: Address + Review ─── */}
                {step === 3 && (
                    <>
                        <div style={S.card}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Service Address</div>
                            <div style={{ marginBottom: 12 }}>
                                <label style={S.label}>Street Address *</label>
                                <input style={S.input} value={address1} onChange={e => setAddress1(e.target.value)} placeholder="123 Main St" />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label style={S.label}>Unit / Apt</label>
                                <input style={S.input} value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Unit 4B (optional)" />
                            </div>
                            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                                <div style={{ flex: 2 }}>
                                    <label style={S.label}>City *</label>
                                    <input style={S.input} value={city} onChange={e => setCity(e.target.value)} placeholder="Ottawa" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={S.label}>Province</label>
                                    <select value={province} onChange={e => setProvince(e.target.value)} style={S.input}>
                                        {["ON", "QC", "BC", "AB", "MB", "SK"].map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={S.label}>Postal Code</label>
                                <input style={S.input} value={postalCode} onChange={e => setPostalCode(e.target.value.toUpperCase())} placeholder="K1A 0A6" maxLength={7} />
                            </div>
                        </div>

                        <div style={S.card}>
                            <label style={S.label}>Notes for Cleaner</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Focus on kitchen and bathrooms, dog on premises…" style={{ ...S.input, minHeight: 80, resize: "vertical" }} />
                        </div>

                        {/* Promo code */}
                        <div style={S.card}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Promo Code</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    style={{ ...S.input, flex: 1, textTransform: "uppercase" }}
                                    value={promoCode}
                                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                                    placeholder="ENTER CODE"
                                    maxLength={20}
                                />
                                <button onClick={applyPromo} style={{ background: ACTION, color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", flexShrink: 0 }}>Apply</button>
                            </div>
                            {promoResult && (
                                <div style={{ marginTop: 8, fontSize: 13, color: promoResult.ok ? GREEN : "#dc2626", fontWeight: 600 }}>
                                    {promoResult.message}
                                </div>
                            )}
                        </div>

                        {/* Price breakdown */}
                        {subtotal > 0 && (
                            <div style={S.card}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Price Estimate</div>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Final price confirmed after booking review.</div>
                                {[
                                    ["Base service", fmt$(basePrice)],
                                    ...selectedExtras.map(k => [EXTRAS.find(e => e.key === k)?.label, fmt$(EXTRAS.find(e => e.key === k)?.price)]),
                                    ...(promoResult?.ok ? [["Promo (" + promoCode + ")", "-" + fmt$(totals.discount)]] : []),
                                    ["HST (13%)", fmt$(totals.tax)],
                                ].map(([label, val], i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: label?.startsWith("Promo") ? GREEN : "#475569", marginBottom: 6 }}>
                                        <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "space-between", background: BRAND, color: "#fff", borderRadius: 12, padding: "12px 16px", marginTop: 10 }}>
                                    <span style={{ fontWeight: 700 }}>Estimated Total</span>
                                    <span style={{ fontWeight: 900, fontSize: 17 }}>{fmt$(totals.total)}</span>
                                </div>
                            </div>
                        )}

                        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{err}</div>}

                        <div style={{ display: "flex", gap: 10 }}>
                            <button style={{ ...S.btn, background: "#f1f5f9", color: "#475569" }} onClick={() => setStep(2)}>← Back</button>
                            <button style={{ ...S.btn, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={submit}>
                                {submitting ? "Submitting…" : "Request Booking →"}
                            </button>
                        </div>
                        <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
                            We&apos;ll confirm your booking and finalize pricing within 24 hours.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
