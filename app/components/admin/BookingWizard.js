"use client";
import { useState, useMemo, useCallback } from "react";
import { applyPromotion } from "../../../lib/promotions";

const CAT_ICONS = {
    house_cleaning: "🏠",
    window_washing: "🪟",
    pressure_washing_siding: "💧",
    pressure_washing_deck: "🏗️",
    gutter_cleaning: "🍂",
    lawn_mowing: "🌿",
};
const CAT_COLORS = {
    house_cleaning: "#6366f1",
    window_washing: "#0891b2",
    pressure_washing_siding: "#0ea5e9",
    pressure_washing_deck: "#8b5cf6",
    gutter_cleaning: "#f59e0b",
    lawn_mowing: "#16a34a",
};

function StepIndicator({ steps, currentStep }) {
    return (
        <div className="wizard-steps">
            {steps.map((s, i) => {
                const idx = steps.findIndex(x => x.id === currentStep);
                const state = i < idx ? "done" : i === idx ? "active" : "upcoming";
                return (
                    <div key={s.id} className={`wizard-step-item wizard-step-${state}`}>
                        <div className="wizard-step-dot">
                            {state === "done" ? (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            ) : (
                                <span>{i + 1}</span>
                            )}
                        </div>
                        <span className="wizard-step-label">{s.label}</span>
                        {i < steps.length - 1 && <div className={`wizard-step-line ${state === "done" ? "done" : ""}`} />}
                    </div>
                );
            })}
        </div>
    );
}

function WizardCard({ icon, title, subtitle, selected, onClick, color }) {
    return (
        <button
            type="button"
            className={`wizard-card ${selected ? "selected" : ""}`}
            onClick={onClick}
            style={selected ? { borderColor: color || "#6366f1", boxShadow: `0 0 0 3px ${color || "#6366f1"}22` } : {}}
        >
            {selected && (
                <div className="wizard-card-check" style={{ background: color || "#6366f1" }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            )}
            <div className="wizard-card-icon" style={{ color: color || "#6366f1", background: `${color || "#6366f1"}15` }}>
                {icon}
            </div>
            <div className="wizard-card-text">
                <div className="wizard-card-title">{title}</div>
                {subtitle && <div className="wizard-card-subtitle">{subtitle}</div>}
            </div>
        </button>
    );
}

function fmt(n) { return "$" + (Math.max(0, Number(n) || 0)).toFixed(2); }

export default function BookingWizard({ v2Catalog, promotionRules, onAddToCart, onCheckout, onClose }) {
    const [currentStep, setCurrentStep] = useState("type");
    const [bookingType, setBookingType] = useState("");
    const [selectedCatId, setSelectedCatId] = useState("");
    const [selectedPropertyTypeId, setSelectedPropertyTypeId] = useState("");
    const [selectedSizeId, setSelectedSizeId] = useState("");
    const [selectedServiceTypeId, setSelectedServiceTypeId] = useState("");
    const [selectedBathroomKey, setSelectedBathroomKey] = useState("");
    const [selectedAddons, setSelectedAddons] = useState({});
    const [selectedFrequency, setSelectedFrequency] = useState("One-Time");
    const [promoCode, setPromoCode] = useState("");
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoError, setPromoError] = useState("");
    const [promoSuccess, setPromoSuccess] = useState("");
    const [done, setDone] = useState(false);

    const catalog = v2Catalog || {};
    const categories = useMemo(() => catalog.categories || [], [catalog]);
    const bathrooms = useMemo(() => catalog.bathrooms || {}, [catalog]);
    const frequencies = useMemo(() => catalog.frequencies || {}, [catalog]);

    const selectedCat = useMemo(() => categories.find(c => c.id === selectedCatId), [categories, selectedCatId]);
    const hasPropertyType = useMemo(() => selectedCat?.hasPropertyType && (selectedCat.propertyTypes || []).length > 0, [selectedCat]);
    const hasAddons = useMemo(() => (selectedCat?.addons || []).length > 0, [selectedCat]);
    const isRecurring = useMemo(() => selectedFrequency && selectedFrequency !== "One-Time", [selectedFrequency]);

    const selectedPropertyType = useMemo(() =>
        (selectedCat?.propertyTypes || []).find(pt => pt.id === selectedPropertyTypeId),
        [selectedCat, selectedPropertyTypeId]
    );

    const availableSizes = useMemo(() => {
        if (!selectedCat) return [];
        if (hasPropertyType && selectedPropertyTypeId) {
            const pt = (selectedCat.propertyTypes || []).find(p => p.id === selectedPropertyTypeId);
            return (selectedCat.sizes || []).filter(s =>
                pt?.sizeIds?.includes(s.id) || s.propertyTypeId === selectedPropertyTypeId
            );
        }
        return selectedCat.sizes || [];
    }, [selectedCat, hasPropertyType, selectedPropertyTypeId]);

    const selectedSize = useMemo(() => availableSizes.find(s => s.id === selectedSizeId), [availableSizes, selectedSizeId]);
    const selectedServiceType = useMemo(() =>
        (selectedCat?.serviceTypes || []).find(st => st.id === selectedServiceTypeId),
        [selectedCat, selectedServiceTypeId]
    );

    // Dynamic steps
    const steps = useMemo(() => {
        const s = [
            { id: "type", label: "Type" },
            { id: "service", label: "Service" },
        ];
        if (hasPropertyType) s.push({ id: "property", label: "Property" });
        s.push({ id: "configure", label: "Configure" });
        if (hasAddons) s.push({ id: "addons", label: "Add-ons" });
        s.push({ id: "frequency", label: "Frequency" });
        s.push({ id: "review", label: "Review" });
        return s;
    }, [hasPropertyType, hasAddons]);

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    // ─── PRICING CALCULATIONS ──────────────────────────────────────────────────
    // Base service: size price × service type multiplier
    const baseServicePrice = useMemo(() => {
        if (!selectedSize) return 0;
        const mult = parseFloat(selectedServiceType?.multiplier || 1.0);
        return parseFloat(selectedSize.price || 0) * mult;
    }, [selectedSize, selectedServiceType]);

    // Bathroom add-on price
    const bathroomPrice = useMemo(() => {
        if (!selectedCat?.hasBathrooms || !selectedBathroomKey) return 0;
        return parseFloat(bathrooms[selectedBathroomKey] || 0);
    }, [selectedCat, bathrooms, selectedBathroomKey]);

    // Add-ons breakdown
    const addonLines = useMemo(() => {
        return (selectedCat?.addons || [])
            .map(addon => {
                const qty = Number(selectedAddons[addon.id] || 0);
                if (!qty) return null;
                return {
                    id: addon.id,
                    name: addon.name,
                    price: parseFloat(addon.price || 0),
                    qty,
                    total: parseFloat(addon.price || 0) * qty
                };
            })
            .filter(Boolean);
    }, [selectedCat, selectedAddons]);

    const addonsTotal = useMemo(() => addonLines.reduce((s, a) => s + a.total, 0), [addonLines]);

    // Raw subtotal = base + bathrooms + addons (before ANY discount)
    const rawSubtotal = useMemo(() => baseServicePrice + bathroomPrice + addonsTotal, [baseServicePrice, bathroomPrice, addonsTotal]);

    // Frequency info
    const freqInfo = useMemo(() => frequencies[selectedFrequency] || { discount: 0 }, [frequencies, selectedFrequency]);
    const freqDiscountRate = useMemo(() => parseFloat(freqInfo.discount || 0), [freqInfo]);

    // First visit = rawSubtotal (no frequency discount — that's for recurring only)
    // Promo applies to first visit subtotal
    const promoDiscountAmount = useMemo(() => {
        if (!appliedPromo) return 0;
        // Re-apply promo against rawSubtotal to get correct discount
        const result = applyPromotion({ code: appliedPromo.promo?.code, subtotal: rawSubtotal, promotions: promotionRules || [] });
        return result.ok ? result.discount : 0;
    }, [appliedPromo, rawSubtotal, promotionRules]);

    const firstVisitTotal = useMemo(() => Math.max(0, rawSubtotal - promoDiscountAmount), [rawSubtotal, promoDiscountAmount]);

    // Recurring (2nd visit onwards): base + bathrooms only, with frequency discount
    const recurringBasePrice = useMemo(() => baseServicePrice + bathroomPrice, [baseServicePrice, bathroomPrice]);
    const recurringDiscountAmount = useMemo(() => recurringBasePrice * freqDiscountRate, [recurringBasePrice, freqDiscountRate]);
    const recurringTotal = useMemo(() => Math.max(0, recurringBasePrice - recurringDiscountAmount), [recurringBasePrice, recurringDiscountAmount]);

    // Navigation
    const goNext = useCallback(() => {
        const nextIdx = currentStepIndex + 1;
        if (nextIdx < steps.length) setCurrentStep(steps[nextIdx].id);
    }, [currentStepIndex, steps]);

    const goBack = useCallback(() => {
        const prevIdx = currentStepIndex - 1;
        if (prevIdx >= 0) setCurrentStep(steps[prevIdx].id);
    }, [currentStepIndex, steps]);

    const canGoNext = useMemo(() => {
        switch (currentStep) {
            case "type": return !!bookingType;
            case "service": return !!selectedCatId;
            case "property": return !!selectedPropertyTypeId;
            case "configure":
                if ((selectedCat?.sizes || []).length > 0 && !selectedSizeId) return false;
                if ((selectedCat?.serviceTypes || []).length > 0 && !selectedServiceTypeId) return false;
                if (selectedCat?.hasBathrooms && !selectedBathroomKey) return false;
                return true;
            case "addons": return true;
            case "frequency": return !!selectedFrequency;
            case "review": return true;
            default: return false;
        }
    }, [currentStep, bookingType, selectedCatId, selectedPropertyTypeId, selectedSizeId, selectedServiceTypeId, selectedBathroomKey, selectedCat, selectedFrequency]);

    const handleApplyPromo = useCallback(() => {
        const code = promoCode.trim();
        if (!code) return;
        const result = applyPromotion({
            code,
            subtotal: rawSubtotal,
            promotions: promotionRules || [],
        });
        if (result.ok) {
            setAppliedPromo(result);
            setPromoSuccess(`${result.promo?.name} applied — you saved ${fmt(result.discount)}!`);
            setPromoError("");
        } else {
            setAppliedPromo(null);
            setPromoError(result.message || "This code cannot be applied.");
            setPromoSuccess("");
        }
    }, [promoCode, rawSubtotal, promotionRules]);

    const handleRemovePromo = useCallback(() => {
        setAppliedPromo(null);
        setPromoCode("");
        setPromoError("");
        setPromoSuccess("");
    }, []);

    const handleAddToCart = useCallback(() => {
        if (!selectedCat) return;
        const item = {
            cartId: `${selectedCat.id}-${Date.now()}`,
            categoryId: selectedCat.id,
            name: selectedCat.name,
            pricingModel: selectedCat.pricingModel,
            serviceTypeId: selectedServiceType?.id || "",
            serviceTypeName: selectedServiceType?.name || "",
            serviceTypeMultiplier: parseFloat(selectedServiceType?.multiplier || 1.0),
            propertyTypeId: selectedPropertyType?.id || "",
            propertyTypeName: selectedPropertyType?.name || "",
            optionId: selectedSize?.id || "base",
            optionName: selectedSize?.name || "Base service",
            basePrice: baseServicePrice,
            bathroomKey: selectedCat.hasBathrooms ? selectedBathroomKey : "",
            bathroomPrice,
            price: firstVisitTotal,
            recurringPrice: isRecurring ? recurringTotal : null,
            durationHrs: parseFloat(selectedSize?.durationHrs || 0),
            configuredExtras: selectedCat.hasBathrooms && selectedBathroomKey ? [{
                id: "bathrooms", name: selectedBathroomKey, price: bathroomPrice, qty: 1, total: bathroomPrice
            }] : [],
            addons: addonLines,
            bookingType,
            frequency: selectedFrequency,
            frequencyDiscount: freqDiscountRate,
            promoCode: appliedPromo?.promo?.code || "",
            promoDiscount: promoDiscountAmount,
        };
        onAddToCart(item);
        setDone(true);
    }, [
        selectedCat, selectedServiceType, selectedPropertyType, selectedSize,
        selectedBathroomKey, bathroomPrice, baseServicePrice, firstVisitTotal,
        recurringTotal, isRecurring, addonLines, bookingType, selectedFrequency,
        freqDiscountRate, appliedPromo, promoDiscountAmount, onAddToCart
    ]);

    const handleReset = useCallback(() => {
        setCurrentStep("type");
        setBookingType("");
        setSelectedCatId("");
        setSelectedPropertyTypeId("");
        setSelectedSizeId("");
        setSelectedServiceTypeId("");
        setSelectedBathroomKey("");
        setSelectedAddons({});
        setSelectedFrequency("One-Time");
        setPromoCode("");
        setAppliedPromo(null);
        setPromoError("");
        setPromoSuccess("");
        setDone(false);
    }, []);

    const handleSelectCategory = useCallback((catId) => {
        setSelectedCatId(catId);
        setSelectedPropertyTypeId("");
        setSelectedSizeId("");
        setSelectedServiceTypeId("");
        setSelectedBathroomKey("");
        setSelectedAddons({});
    }, []);

    const handleSelectPropertyType = useCallback((ptId) => {
        setSelectedPropertyTypeId(ptId);
        setSelectedSizeId("");
    }, []);

    // ─── SUCCESS SCREEN ────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="wizard-overlay">
                <div className="wizard-modal wizard-success">
                    <div className="wizard-success-icon">
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                            <circle cx="26" cy="26" r="26" fill="#dcfce7"/>
                            <path d="M15 26l9 9 13-13" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <h2 className="wizard-success-title">Added to Cart!</h2>
                    <p className="wizard-success-sub">
                        <strong>{selectedCat?.name}</strong> has been added to your service cart.
                    </p>
                    <div className="wizard-success-price-block">
                        <div className="success-price-row">
                            <span>First visit</span>
                            <strong>{fmt(firstVisitTotal)} <span className="hst-label">+ HST (13%)</span></strong>
                        </div>
                        {isRecurring && (
                            <div className="success-price-row recurring">
                                <span>{selectedFrequency} (from 2nd visit)</span>
                                <strong>{fmt(recurringTotal)} <span className="hst-label">+ HST (13%)</span></strong>
                            </div>
                        )}
                    </div>
                    <div className="wizard-success-actions">
                        <button className="wizard-btn-secondary" onClick={handleReset}>
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3V1L5 4l3 3V5a4 4 0 11-4 4H2a6 6 0 106-6z" fill="currentColor"/>
                            </svg>
                            Add More Services
                        </button>
                        <button className="wizard-btn-primary" onClick={onCheckout}>
                            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                                <path d="M2 2h2l2.7 8.3M6.5 14a1 1 0 102 0 1 1 0 00-2 0zm7.5 0a1 1 0 102 0 1 1 0 00-2 0zM4.7 10.3l10.8-1.6L14.4 3H5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Checkout
                        </button>
                    </div>
                    <button className="wizard-close-btn" onClick={onClose}>×</button>
                </div>
            </div>
        );
    }

    return (
        <div className="wizard-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="wizard-modal">
                {/* Header */}
                <div className="wizard-header">
                    <div>
                        <h2 className="wizard-title">New Booking</h2>
                        <p className="wizard-subtitle">Step {currentStepIndex + 1} of {steps.length}</p>
                    </div>
                    <button className="wizard-close-btn" onClick={onClose}>×</button>
                </div>

                {/* Step indicator */}
                <StepIndicator steps={steps} currentStep={currentStep} />

                {/* Step content */}
                <div className="wizard-body">

                    {/* STEP 1: Type */}
                    {currentStep === "type" && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">What type of booking is this?</h3>
                            <div className="wizard-cards-grid wizard-cards-2col">
                                <WizardCard icon="🏠" title="Residential" subtitle="Homes, apartments, condos & townhouses"
                                    selected={bookingType === "residential"} onClick={() => setBookingType("residential")} color="#6366f1" />
                                <WizardCard icon="🏢" title="Commercial" subtitle="Offices, retail & commercial spaces"
                                    selected={bookingType === "commercial"} onClick={() => setBookingType("commercial")} color="#0891b2" />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Service */}
                    {currentStep === "service" && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">Select a service</h3>
                            <div className="wizard-cards-grid wizard-cards-3col">
                                {categories.map(cat => (
                                    <WizardCard key={cat.id}
                                        icon={CAT_ICONS[cat.id] || "🧹"}
                                        title={cat.name}
                                        subtitle={cat.sizeLabel || ""}
                                        selected={selectedCatId === cat.id}
                                        onClick={() => handleSelectCategory(cat.id)}
                                        color={CAT_COLORS[cat.id] || "#6366f1"} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Property type */}
                    {currentStep === "property" && selectedCat && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">What type of property?</h3>
                            <div className="wizard-cards-grid wizard-cards-3col">
                                {(selectedCat.propertyTypes || []).map(pt => (
                                    <WizardCard key={pt.id}
                                        icon={pt.id === "apartment" ? "🏢" : pt.id === "townhouse" ? "🏘️" : "🏡"}
                                        title={pt.name}
                                        subtitle={`${pt.sizeIds?.length || 0} size options`}
                                        selected={selectedPropertyTypeId === pt.id}
                                        onClick={() => handleSelectPropertyType(pt.id)}
                                        color="#6366f1" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Configure */}
                    {currentStep === "configure" && selectedCat && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">Configure your service</h3>
                            <div className="wizard-configure-grid">
                                {availableSizes.length > 0 && (
                                    <div className="wizard-field">
                                        <label className="wizard-label">{selectedCat.sizeLabel || "Size / Bedrooms"}</label>
                                        <div className="wizard-pills">
                                            {availableSizes.map(size => (
                                                <button key={size.id} type="button"
                                                    className={`wizard-pill ${selectedSizeId === size.id ? "selected" : ""}`}
                                                    onClick={() => setSelectedSizeId(size.id)}>
                                                    <span className="pill-name">{size.name}</span>
                                                    <span className="pill-price">{fmt(size.price)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(selectedCat.serviceTypes || []).length > 0 && (
                                    <div className="wizard-field">
                                        <label className="wizard-label">Service Type</label>
                                        <div className="wizard-service-types">
                                            {(selectedCat.serviceTypes || []).map(st => (
                                                <button key={st.id} type="button"
                                                    className={`wizard-service-type-btn ${selectedServiceTypeId === st.id ? "selected" : ""}`}
                                                    onClick={() => setSelectedServiceTypeId(st.id)}>
                                                    <div className="st-name">{st.name}</div>
                                                    {st.multiplier > 1 && <div className="st-badge">×{parseFloat(st.multiplier).toFixed(2)}</div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedCat.hasBathrooms && Object.keys(bathrooms).length > 0 && (
                                    <div className="wizard-field">
                                        <label className="wizard-label">Bathrooms</label>
                                        <div className="wizard-pills">
                                            {Object.entries(bathrooms).map(([label, price]) => (
                                                <button key={label} type="button"
                                                    className={`wizard-pill ${selectedBathroomKey === label ? "selected" : ""}`}
                                                    onClick={() => setSelectedBathroomKey(label)}>
                                                    <span className="pill-name">{label}</span>
                                                    {parseFloat(price) > 0 && <span className="pill-price">+{fmt(price)}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {baseServicePrice > 0 && (
                                    <div className="wizard-price-preview">
                                        <span>Estimated base price</span>
                                        <strong>{fmt(baseServicePrice + bathroomPrice)}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Add-ons */}
                    {currentStep === "addons" && selectedCat && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">Add extra services</h3>
                            <p className="wizard-step-note">Add-ons apply to the first visit only. Recurring visits are billed at the base rate.</p>
                            {(selectedCat.addons || []).length === 0 ? (
                                <div className="wizard-empty-state">
                                    <span>✓</span>
                                    <p>No add-ons available for this service</p>
                                </div>
                            ) : (
                                <div className="wizard-addons-grid">
                                    {(selectedCat.addons || []).map(addon => {
                                        const qty = Number(selectedAddons[addon.id] || 0);
                                        const isSelected = qty > 0;
                                        return (
                                            <div key={addon.id}
                                                className={`wizard-addon-card ${isSelected ? "selected" : ""}`}
                                                onClick={() => {
                                                    if (!addon.qtySelector) {
                                                        setSelectedAddons(prev => ({ ...prev, [addon.id]: isSelected ? 0 : 1 }));
                                                    }
                                                }}>
                                                <div className="addon-info">
                                                    <div className="addon-name">{addon.name}</div>
                                                    <div className="addon-price">{fmt(addon.price)}{addon.qtySelector ? " each" : ""}</div>
                                                </div>
                                                {addon.qtySelector ? (
                                                    <div className="addon-qty-control" onClick={e => e.stopPropagation()}>
                                                        <button type="button" className="qty-btn"
                                                            onClick={() => setSelectedAddons(prev => ({ ...prev, [addon.id]: Math.max(0, (Number(prev[addon.id]) || 0) - 1) }))}>−</button>
                                                        <span className="qty-val">{qty}</span>
                                                        <button type="button" className="qty-btn"
                                                            onClick={() => setSelectedAddons(prev => ({ ...prev, [addon.id]: (Number(prev[addon.id]) || 0) + 1 }))}>+</button>
                                                    </div>
                                                ) : (
                                                    <div className={`addon-toggle ${isSelected ? "on" : ""}`}>{isSelected ? "✓" : "+"}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {addonsTotal > 0 && (
                                <div className="wizard-price-preview" style={{ marginTop: 14 }}>
                                    <span>Add-ons (first visit)</span>
                                    <strong>+{fmt(addonsTotal)}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 6: Frequency */}
                    {currentStep === "frequency" && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">How often?</h3>
                            {Object.keys(frequencies).length > 0 && (
                                <p className="wizard-step-note">Frequency discounts apply from the 2nd visit onwards. Add-ons are first visit only.</p>
                            )}
                            <div className="wizard-frequency-grid">
                                {(Object.keys(frequencies).length > 0 ? Object.entries(frequencies) : [
                                    ["One-Time", { name: "One time service", discount: 0 }],
                                    ["Weekly", { name: "Weekly", discount: 0.20 }],
                                    ["Bi-Weekly", { name: "Bi-Weekly", discount: 0.15 }],
                                    ["Monthly", { name: "Monthly", discount: 0.10 }],
                                ]).map(([key, freq]) => (
                                    <button key={key} type="button"
                                        className={`wizard-freq-card ${selectedFrequency === key ? "selected" : ""}`}
                                        onClick={() => setSelectedFrequency(key)}>
                                        <div className="freq-name">{key}</div>
                                        <div className="freq-desc">{freq.name}</div>
                                        {freq.discount > 0 && (
                                            <div className="freq-discount">{(freq.discount * 100).toFixed(0)}% off</div>
                                        )}
                                        {key === "One-Time" && (
                                            <div className="freq-tag one-time">No commitment</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 7: Review */}
                    {currentStep === "review" && (
                        <div className="wizard-step-content">
                            <h3 className="wizard-step-title">Review &amp; add to cart</h3>
                            <div className="wizard-review-card">
                                {/* Service summary header */}
                                <div className="review-service-header" style={{ borderLeftColor: CAT_COLORS[selectedCatId] || "#6366f1" }}>
                                    <span className="review-icon">{CAT_ICONS[selectedCatId] || "🧹"}</span>
                                    <div>
                                        <div className="review-service-name">{selectedCat?.name}</div>
                                        <div className="review-service-meta">
                                            {bookingType === "residential" ? "Residential" : "Commercial"}
                                            {selectedPropertyType && ` · ${selectedPropertyType.name}`}
                                            {selectedSize && ` · ${selectedSize.name}`}
                                            {selectedServiceType && ` · ${selectedServiceType.name}`}
                                        </div>
                                    </div>
                                </div>

                                {/* FIRST VISIT BREAKDOWN */}
                                <div className="review-section-label">First Visit</div>
                                <div className="review-line-items">
                                    {baseServicePrice > 0 && (
                                        <div className="review-line">
                                            <span>Base service{selectedServiceType ? ` — ${selectedServiceType.name}` : ""}</span>
                                            <span>{fmt(baseServicePrice)}</span>
                                        </div>
                                    )}
                                    {bathroomPrice > 0 && (
                                        <div className="review-line">
                                            <span>{selectedBathroomKey}</span>
                                            <span>+{fmt(bathroomPrice)}</span>
                                        </div>
                                    )}
                                    {addonLines.map(addon => (
                                        <div key={addon.id} className="review-line addon-line">
                                            <span>
                                                {addon.name}{addon.qty > 1 ? ` ×${addon.qty}` : ""}
                                                <span className="first-visit-tag">First visit only</span>
                                            </span>
                                            <span>+{fmt(addon.total)}</span>
                                        </div>
                                    ))}
                                    {/* Subtotal before discounts */}
                                    <div className="review-line subtotal-before">
                                        <span>Subtotal (before discounts)</span>
                                        <span>{fmt(rawSubtotal)}</span>
                                    </div>
                                    {/* Promo discount */}
                                    {promoDiscountAmount > 0 && appliedPromo && (
                                        <div className="review-line discount-line">
                                            <span>Promo: {appliedPromo.promo?.code} — {appliedPromo.promo?.name}</span>
                                            <span>−{fmt(promoDiscountAmount)}</span>
                                        </div>
                                    )}
                                    {/* First visit total */}
                                    <div className="review-line total-line">
                                        <span>First visit total</span>
                                        <span>
                                            <strong>{fmt(firstVisitTotal)}</strong>
                                            <span className="hst-label"> + HST (13%)</span>
                                        </span>
                                    </div>
                                </div>

                                {/* RECURRING BREAKDOWN — only shown for non-one-time */}
                                {isRecurring && (
                                    <>
                                        <div className="review-section-label recurring-label">
                                            {selectedFrequency} — from 2nd visit
                                        </div>
                                        <div className="review-line-items">
                                            <div className="review-line">
                                                <span>Base service + bathrooms</span>
                                                <span>{fmt(recurringBasePrice)}</span>
                                            </div>
                                            <div className="review-line discount-line">
                                                <span>{selectedFrequency} discount ({(freqDiscountRate * 100).toFixed(0)}% off)</span>
                                                <span>−{fmt(recurringDiscountAmount)}</span>
                                            </div>
                                            <div className="review-line note-line">
                                                <span className="recurring-note">Add-ons not charged on recurring visits</span>
                                            </div>
                                            <div className="review-line total-line">
                                                <span>Recurring total</span>
                                                <span>
                                                    <strong>{fmt(recurringTotal)}</strong>
                                                    <span className="hst-label"> + HST (13%)</span>
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Promo code field */}
                                <div className="wizard-promo-section">
                                    <label className="wizard-label">Promo Code</label>
                                    {appliedPromo ? (
                                        <div className="promo-applied-badge">
                                            <div>
                                                <div className="promo-applied-name">✓ {appliedPromo.promo?.name}</div>
                                                <div className="promo-applied-detail">{appliedPromo.promo?.code} — you saved {fmt(promoDiscountAmount)}</div>
                                            </div>
                                            <button type="button" className="promo-remove-btn" onClick={handleRemovePromo}>Remove</button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="promo-input-row">
                                                <input className="promo-input" type="text"
                                                    placeholder="Enter promo code"
                                                    value={promoCode}
                                                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                                                    onKeyDown={e => e.key === "Enter" && handleApplyPromo()} />
                                                <button type="button" className="promo-apply-btn"
                                                    onClick={handleApplyPromo}
                                                    disabled={!promoCode.trim()}>Apply</button>
                                            </div>
                                            {promoError && (
                                                <div className="promo-error-box">
                                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                                        <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
                                                        <path d="M8 5v4M8 11v1" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                                                    </svg>
                                                    {promoError}
                                                </div>
                                            )}
                                            {promoSuccess && (
                                                <div className="promo-success-box">✓ {promoSuccess}</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <button type="button" className="wizard-add-to-cart-btn"
                                onClick={handleAddToCart}
                                disabled={firstVisitTotal <= 0}>
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M2 2h2l2.7 8.3M6.5 14a1 1 0 102 0 1 1 0 00-2 0zm7.5 0a1 1 0 102 0 1 1 0 00-2 0zM4.7 10.3l10.8-1.6L14.4 3H5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Add to Cart — {fmt(firstVisitTotal)}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="wizard-footer">
                    <button type="button" className="wizard-btn-back"
                        onClick={currentStepIndex === 0 ? onClose : goBack}>
                        {currentStepIndex === 0 ? "Cancel" : "← Back"}
                    </button>
                    <div className="wizard-footer-right">
                        {rawSubtotal > 0 && currentStep !== "review" && (
                            <span className="wizard-running-total">{fmt(rawSubtotal)}</span>
                        )}
                        {currentStep !== "review" && (
                            <button type="button" className="wizard-btn-next"
                                onClick={goNext} disabled={!canGoNext}>
                                Next →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
