"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getServiceCard, SIZE_MAP, ADD_ONS } from "../../../../lib/bookingServices";
import { addCartItem } from "../../../../lib/customerCart";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

const BATHROOMS = ["1", "1.5", "2", "2.5", "3", "3+"];

function fmt$(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }

export default function ServiceConfigurePage({ params }) {
    const { serviceId } = use(params);
    const router = useRouter();
    const svc = getServiceCard(serviceId);

    // For configurable services
    const [step, setStep] = useState(1); // 1=size, 2=bathrooms+addons, 3=notes
    const [sizeKey, setSizeKey] = useState("");
    const [bathrooms, setBathrooms] = useState("1");
    const [addOns, setAddOns] = useState(svc?.preselectedAddOns || []);
    const [notes, setNotes] = useState("");
    const [prices, setPrices] = useState({});
    const [taxRate, setTaxRate] = useState(0.13);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        fetch("/api/customer/services")
            .then(r => r.json())
            .then(d => {
                if (d.services) setPrices(d.services);
                if (d.taxRate) setTaxRate(d.taxRate);
            })
            .catch(() => {});
        // Pre-select add-ons from service definition
        if (svc?.preselectedAddOns?.length) setAddOns(svc.preselectedAddOns);
    }, [svc]);

    if (!svc) {
        return (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "#94a3b8" }}>Service not found.</div>
                <button onClick={() => router.push("/customer/book")} style={{ marginTop: 20, background: ACTION, color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>← Back</button>
            </div>
        );
    }

    // Sizes from Firestore (exclude flat-service keys)
    const FLAT_KEYS = ["Window Cleaning", "Gutter Cleaning", "Power Washing"];
    const sizeOptions = SIZE_MAP.filter(s => prices[s.key] !== undefined || Object.keys(prices).length === 0)
        .map(s => ({ ...s, price: prices[s.key] || 0 }))
        .filter(s => !FLAT_KEYS.includes(s.key));

    const flatPrice = svc.type === "flat" ? (prices[svc.firestoreKey] || svc.fallbackPrice || 0) : 0;
    const basePrice = svc.type === "flat" ? flatPrice : (prices[sizeKey] || 0);
    const addOnsTotal = addOns.reduce((sum, k) => sum + (ADD_ONS.find(a => a.key === k)?.price || 0), 0);
    const subtotal = basePrice + addOnsTotal;

    function toggleAddOn(key) {
        setAddOns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    function handleAddToCart() {
        const selectedSize = SIZE_MAP.find(s => s.key === sizeKey);
        const item = {
            serviceId: svc.id,
            serviceName: svc.name,
            serviceIcon: svc.icon,
            type: svc.type,
            // For configurable
            sizeKey,
            sizeLabel: selectedSize?.label || "",
            bathrooms: svc.type === "configurable" ? bathrooms : null,
            addOns: addOns.map(k => {
                const ao = ADD_ONS.find(a => a.key === k);
                return { key: k, label: ao?.label || k, price: ao?.price || 0 };
            }),
            basePrice,
            addOnsTotal,
            subtotal,
            notes,
        };
        addCartItem(item);
        window.dispatchEvent(new Event("cart-updated"));
        setAdded(true);
        setTimeout(() => router.push("/customer/book"), 900);
    }

    const canAddToCart = svc.type === "flat" || (svc.type === "configurable" && sizeKey !== "");

    // ─── FLAT SERVICE ─────────────────────────────────────
    if (svc.type === "flat") {
        return (
            <div style={{ paddingBottom: 100 }}>
                <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 28px", color: "#fff" }}>
                    <button onClick={() => router.push("/customer/book")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
                        ← Back
                    </button>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{svc.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{svc.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{svc.subtitle}</div>
                </div>

                <div style={{ padding: "20px 16px 0" }}>
                    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Service Price</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: ACTION }}>{fmt$(flatPrice)}</div>
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
                            Final price confirmed after booking review. HST not included.
                        </div>
                    </div>

                    <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                            Notes / Special Access
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Any details we should know — access instructions, areas to focus on, etc."
                            style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", minHeight: 90, resize: "vertical" }}
                        />
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={added}
                        style={{ width: "100%", background: added ? GREEN : ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "16px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: added ? 0.9 : 1 }}
                    >
                        {added ? "✓ Added to Cart!" : `Add to Cart — ${fmt$(flatPrice)}`}
                    </button>
                </div>
            </div>
        );
    }

    // ─── CONFIGURABLE SERVICE ─────────────────────────────
    const inputStyle = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
    const sectionLabel = { display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 };

    const stepTitles = ["Choose Size", "Add-Ons", "Notes"];
    const progress = (step / 3) * 100;

    return (
        <div style={{ paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 20px", color: "#fff" }}>
                <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/customer/book")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
                    ← {step > 1 ? "Back" : "Services"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 32 }}>{svc.icon}</div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{svc.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Step {step} of 3 — {stepTitles[step - 1]}</div>
                    </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "#fff", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>

                {/* ── Step 1: Size ── */}
                {step === 1 && (
                    <>
                        <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <span style={sectionLabel}>Select Home Size</span>
                            {(sizeOptions.length > 0 ? sizeOptions : SIZE_MAP.map(s => ({ ...s, price: 0 }))).map(size => (
                                <button
                                    key={size.key}
                                    onClick={() => setSizeKey(size.key)}
                                    style={{
                                        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                                        background: sizeKey === size.key ? ACTION + "12" : "#f8fafc",
                                        border: `1.5px solid ${sizeKey === size.key ? ACTION : "#e2e8f0"}`,
                                        borderRadius: 14, padding: "14px 16px", marginBottom: 8,
                                        cursor: "pointer", fontFamily: "inherit",
                                    }}
                                >
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: sizeKey === size.key ? ACTION : "#0f172a" }}>{size.label}</div>
                                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{size.sub}</div>
                                    </div>
                                    {size.price > 0 && (
                                        <div style={{ fontSize: 15, fontWeight: 800, color: sizeKey === size.key ? ACTION : "#475569", flexShrink: 0 }}>
                                            {fmt$(size.price)}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!sizeKey}
                            style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: sizeKey ? "pointer" : "default", opacity: sizeKey ? 1 : 0.4 }}
                        >
                            Next: Add-Ons →
                        </button>
                    </>
                )}

                {/* ── Step 2: Bathrooms + Add-ons ── */}
                {step === 2 && (
                    <>
                        {/* Bathrooms */}
                        <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <span style={sectionLabel}>Number of Bathrooms</span>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {BATHROOMS.map(b => (
                                    <button
                                        key={b}
                                        onClick={() => setBathrooms(b)}
                                        style={{
                                            flex: "1 1 calc(33% - 8px)", padding: "12px 0", borderRadius: 12, fontFamily: "inherit",
                                            border: `1.5px solid ${bathrooms === b ? ACTION : "#e2e8f0"}`,
                                            background: bathrooms === b ? ACTION : "#f8fafc",
                                            color: bathrooms === b ? "#fff" : "#0f172a",
                                            fontWeight: 700, fontSize: 15, cursor: "pointer",
                                        }}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Add-ons */}
                        <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <span style={sectionLabel}>Add-Ons (optional)</span>
                            {ADD_ONS.map(({ key, label, price }) => {
                                const on = addOns.includes(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleAddOn(key)}
                                        style={{
                                            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                                            background: on ? ACTION + "10" : "#f8fafc",
                                            border: `1.5px solid ${on ? ACTION : "#e2e8f0"}`,
                                            borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                                            cursor: "pointer", fontFamily: "inherit",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? ACTION : "#cbd5e1"}`, background: on ? ACTION : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                {on && <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>✓</span>}
                                            </div>
                                            <span style={{ fontSize: 14, color: on ? ACTION : "#0f172a", fontWeight: on ? 700 : 400, textAlign: "left" }}>{label}</span>
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: on ? ACTION : "#64748b", flexShrink: 0, marginLeft: 8 }}>+{fmt$(price)}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => setStep(3)} style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                            Next: Notes →
                        </button>
                    </>
                )}

                {/* ── Step 3: Notes + Price Summary + Add to Cart ── */}
                {step === 3 && (
                    <>
                        <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <label style={{ ...sectionLabel, display: "block" }}>Notes / Special Access</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. Dogs on premises, alarm code, key under mat, focus on kitchen…"
                                style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                            />
                        </div>

                        {/* Price summary */}
                        <div style={{ background: "#fff", borderRadius: 18, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <span style={sectionLabel}>Price Estimate</span>
                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Final price confirmed after booking review.</div>
                            {[
                                { label: SIZE_MAP.find(s => s.key === sizeKey)?.label || "Base service", val: fmt$(basePrice) },
                                ...addOns.map(k => {
                                    const ao = ADD_ONS.find(a => a.key === k);
                                    return { label: ao?.label || k, val: `+${fmt$(ao?.price || 0)}` };
                                }),
                            ].map(({ label, val }, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", marginBottom: 8 }}>
                                    <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, color: ACTION }}>
                                <span>Subtotal</span><span>{fmt$(subtotal)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>+ HST applied at checkout</div>
                        </div>

                        <button
                            onClick={handleAddToCart}
                            disabled={added || !canAddToCart}
                            style={{ width: "100%", background: added ? GREEN : ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "16px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: added ? 0.9 : 1 }}
                        >
                            {added ? "✓ Added to Cart! Returning…" : `Add to Cart — ${fmt$(subtotal)}`}
                        </button>
                        <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
                            You can add more services before checking out.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
