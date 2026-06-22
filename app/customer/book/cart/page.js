"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCartItems, removeCartItem, clearCart } from "../../../../lib/customerCart";
import { TIME_SLOTS, POINTS_PER_DOLLAR } from "../../../../lib/bookingServices";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";
const RED = "#ef4444";

function fmt$(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }

export default function CartPage() {
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [profile, setProfile] = useState(null);
    const [taxRate, setTaxRate] = useState(0.13);

    // Date / time
    const [date, setDate] = useState("");
    const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0].value);

    // Address (editable)
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [city, setCity] = useState("");
    const [province, setProvince] = useState("ON");
    const [postalCode, setPostalCode] = useState("");

    // Promo
    const [promoInput, setPromoInput] = useState("");
    const [promo, setPromo] = useState(null); // { ok, discount, message, promo:{code,name} }
    const [promoLoading, setPromoLoading] = useState(false);

    // Reward points
    const [availablePoints, setAvailablePoints] = useState(0);
    const [usePoints, setUsePoints] = useState(false);

    // Submit
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setItems(getCartItems());
        Promise.all([
            fetch("/api/customer/profile").then(r => r.json()),
            fetch("/api/customer/services").then(r => r.json()),
        ]).then(([pd, sd]) => {
            if (pd.profile) {
                const p = pd.profile;
                setProfile(p);
                setAddress1(p.address || "");
                setCity(p.city || "");
                setProvince(p.province || "ON");
                setPostalCode(p.postalCode || "");
                setAvailablePoints(Number(p.rewardPoints || 0));
            }
            if (sd.taxRate) setTaxRate(sd.taxRate);
        }).catch(() => {});
    }, []);

    function removeItem(id) {
        removeCartItem(id);
        setItems(getCartItems());
        window.dispatchEvent(new Event("cart-updated"));
    }

    async function applyPromo() {
        if (!promoInput.trim()) return;
        setPromoLoading(true);
        setPromo(null);
        try {
            const res = await fetch("/api/customer/promo-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: promoInput.trim(), subtotal }),
            });
            const d = await res.json();
            setPromo(d);
        } catch {
            setPromo({ ok: false, message: "Could not validate promo code." });
        } finally {
            setPromoLoading(false);
        }
    }

    // ── Pricing ──────────────────────────────────────────────
    const subtotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
    const promoDiscount = promo?.ok ? (promo.discount || 0) : 0;
    const maxPointsDiscount = usePoints ? Math.min(availablePoints / POINTS_PER_DOLLAR, Math.max(0, subtotal - promoDiscount)) : 0;
    const pointsDiscount = parseFloat(maxPointsDiscount.toFixed(2));
    const pointsUsed = Math.ceil(pointsDiscount * POINTS_PER_DOLLAR);
    const afterDiscounts = Math.max(0, subtotal - promoDiscount - pointsDiscount);
    const tax = parseFloat((afterDiscounts * taxRate).toFixed(2));
    const total = parseFloat((afterDiscounts + tax).toFixed(2));

    // Minimum date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split("T")[0];

    async function handleSubmit() {
        setError("");
        if (items.length === 0) { setError("Your cart is empty."); return; }
        if (!date) { setError("Please select a date."); return; }
        if (!address1.trim()) { setError("Please enter a service address."); return; }
        setSubmitting(true);
        try {
            const primaryService = items[0]?.serviceName || "Cleaning";
            const res = await fetch("/api/customer/new-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service: primaryService,
                    cartItems: items,
                    date,
                    time: timeSlot,
                    address1: address1.trim(),
                    address2: address2.trim(),
                    city: city.trim(),
                    province,
                    postalCode: postalCode.trim(),
                    promoCode: promo?.ok ? (promo.promo?.code || promoInput.trim()) : "",
                    promoDiscount: promoDiscount || 0,
                    promoName: promo?.ok ? (promo.promo?.name || "") : "",
                    rewardPointsUsed: usePoints ? pointsUsed : 0,
                    rewardPointsDiscount: usePoints ? pointsDiscount : 0,
                    subtotal,
                    tax,
                    total,
                }),
            });
            const d = await res.json();
            if (!d.ok) throw new Error(d.error || "Booking failed.");
            clearCart();
            window.dispatchEvent(new Event("cart-updated"));
            router.push(`/customer/book/confirmation?bookingId=${d.bookingId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    const inputStyle = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" };
    const label = { display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 };
    const card = { background: "#fff", borderRadius: 18, padding: "18px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };

    return (
        <div style={{ paddingBottom: 110 }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 22px", color: "#fff" }}>
                <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
                    ← Back
                </button>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Your Cart</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Review, schedule, and request booking</div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>

                {/* Empty state */}
                {items.length === 0 && (
                    <div style={{ textAlign: "center", padding: "50px 20px" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Cart is empty</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Add a service to get started.</div>
                        <button onClick={() => router.push("/customer/book")} style={{ background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                            Browse Services
                        </button>
                    </div>
                )}

                {items.length > 0 && (
                    <>
                        {/* Cart items */}
                        <div style={card}>
                            <span style={label}>Services ({items.length})</span>
                            {items.map((item, idx) => (
                                <div key={item.id} style={{ borderTop: idx > 0 ? "1px solid #f1f5f9" : "none", paddingTop: idx > 0 ? 12 : 0, marginTop: idx > 0 ? 12 : 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                                                {item.serviceIcon} {item.serviceName}
                                            </div>
                                            {item.sizeLabel && (
                                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.sizeLabel}</div>
                                            )}
                                            {item.bathrooms && (
                                                <div style={{ fontSize: 12, color: "#64748b" }}>{item.bathrooms} bathroom{item.bathrooms !== "1" ? "s" : ""}</div>
                                            )}
                                            {item.addOns?.length > 0 && (
                                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                                    + {item.addOns.map(a => a.label).join(", ")}
                                                </div>
                                            )}
                                            {item.notes && (
                                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, fontStyle: "italic" }}>"{item.notes}"</div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 8 }}>
                                            <div style={{ fontSize: 15, fontWeight: 800, color: ACTION }}>{fmt$(item.subtotal)}</div>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                style={{ background: "#fef2f2", border: "none", color: RED, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                                <button onClick={() => router.push("/customer/book")} style={{ background: "transparent", border: `1.5px dashed ${ACTION}50`, borderRadius: 12, padding: "10px 0", width: "100%", color: ACTION, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                                    + Add Another Service
                                </button>
                            </div>
                        </div>

                        {/* Date & Time */}
                        <div style={card}>
                            <span style={label}>Preferred Date & Time</span>
                            <input
                                type="date"
                                value={date}
                                min={minDate}
                                onChange={e => setDate(e.target.value)}
                                style={{ ...inputStyle, marginBottom: 14 }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                                {TIME_SLOTS.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setTimeSlot(t.value)}
                                        style={{
                                            flex: 1, padding: "10px 0", borderRadius: 12, fontFamily: "inherit",
                                            border: `1.5px solid ${timeSlot === t.value ? ACTION : "#e2e8f0"}`,
                                            background: timeSlot === t.value ? ACTION : "#f8fafc",
                                            color: timeSlot === t.value ? "#fff" : "#475569",
                                            fontWeight: 600, fontSize: 12, cursor: "pointer",
                                        }}
                                    >
                                        <div>{t.label}</div>
                                        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{t.sub}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Address */}
                        <div style={card}>
                            <span style={label}>Service Address</span>
                            <input placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                            <input placeholder="Apt / Unit (optional)" value={address2} onChange={e => setAddress2(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                                <input placeholder="City" value={city} onChange={e => setCity(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
                                <input placeholder="Prov" value={province} onChange={e => setProvince(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                            </div>
                            <input placeholder="Postal code" value={postalCode} onChange={e => setPostalCode(e.target.value)} style={inputStyle} />
                        </div>

                        {/* Promo code */}
                        <div style={card}>
                            <span style={label}>Promo Code</span>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    placeholder="Enter code"
                                    value={promoInput}
                                    onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromo(null); }}
                                    onKeyDown={e => e.key === "Enter" && applyPromo()}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button
                                    onClick={applyPromo}
                                    disabled={promoLoading || !promoInput.trim()}
                                    style={{ background: ACTION, color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", flexShrink: 0, opacity: promoInput.trim() ? 1 : 0.4 }}
                                >
                                    {promoLoading ? "…" : "Apply"}
                                </button>
                            </div>
                            {promo && (
                                <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: promo.ok ? "#f0fdf4" : "#fef2f2", color: promo.ok ? GREEN : RED, fontSize: 13, fontWeight: 600 }}>
                                    {promo.ok ? "✓ " : "✕ "}{promo.message}
                                </div>
                            )}
                        </div>

                        {/* Reward points */}
                        {availablePoints > 0 && (
                            <div style={card}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <span style={label}>Reward Points</span>
                                        <div style={{ fontSize: 14, color: "#475569" }}>
                                            You have <strong style={{ color: BRAND }}>{availablePoints.toLocaleString()} pts</strong>
                                            <span style={{ color: "#94a3b8", fontSize: 12 }}> (= {fmt$(availablePoints / POINTS_PER_DOLLAR)})</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setUsePoints(p => !p)}
                                        style={{
                                            background: usePoints ? GREEN : "#f1f5f9",
                                            color: usePoints ? "#fff" : "#475569",
                                            border: "none", borderRadius: 12, padding: "10px 18px",
                                            fontWeight: 700, fontSize: 14, cursor: "pointer",
                                        }}
                                    >
                                        {usePoints ? "✓ Applied" : "Use"}
                                    </button>
                                </div>
                                {usePoints && pointsDiscount > 0 && (
                                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: "#f0fdf4", color: GREEN, fontSize: 13, fontWeight: 600 }}>
                                        ✓ {pointsUsed.toLocaleString()} pts → −{fmt$(pointsDiscount)} off your order
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Price breakdown */}
                        <div style={card}>
                            <span style={label}>Price Estimate</span>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
                                Final price confirmed after booking review.
                            </div>
                            {[
                                { label: "Subtotal", val: fmt$(subtotal) },
                                ...(promoDiscount > 0 ? [{ label: `Promo (${promo?.promo?.code || promoInput})`, val: `−${fmt$(promoDiscount)}`, color: GREEN }] : []),
                                ...(usePoints && pointsDiscount > 0 ? [{ label: `Reward Points (−${pointsUsed.toLocaleString()} pts)`, val: `−${fmt$(pointsDiscount)}`, color: GREEN }] : []),
                                { label: `HST (${Math.round(taxRate * 100)}%)`, val: fmt$(tax) },
                            ].map(({ label: lbl, val, color }, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: color || "#475569", marginBottom: 8 }}>
                                    <span>{lbl}</span><span style={{ fontWeight: 600 }}>{val}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, color: ACTION }}>
                                <span>Estimated Total</span><span>{fmt$(total)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>No payment required now — we confirm and invoice you first.</div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ background: "#fef2f2", color: RED, borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            style={{ width: "100%", background: submitting ? "#94a3b8" : ACTION, color: "#fff", border: "none", borderRadius: 16, padding: "17px 0", fontSize: 17, fontWeight: 800, cursor: submitting ? "default" : "pointer" }}
                        >
                            {submitting ? "Submitting…" : "Request Booking →"}
                        </button>
                        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 10 }}>
                            We'll review and reach out to confirm your booking.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
