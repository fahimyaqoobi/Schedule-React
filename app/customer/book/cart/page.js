"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCartItems, removeCartItem, clearCart } from "../../../../lib/customerCart";
import { TIME_SLOTS, POINTS_PER_DOLLAR } from "../../../../lib/bookingServices";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ShoppingCart, X, Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

    return (
        <div className="pb-24">
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-5 text-primary-foreground">
                <Button variant="ghost" size="sm" className="mb-3 h-auto gap-1 bg-white/15 px-3 py-1.5 text-primary-foreground hover:bg-white/25 hover:text-primary-foreground" onClick={() => router.back()}>
                    <ChevronLeft className="size-4" /> Back
                </Button>
                <div className="text-xl font-extrabold">Your Cart</div>
                <div className="mt-0.5 text-sm opacity-85">Review, schedule, and request booking</div>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {items.length === 0 && (
                    <div className="py-12 text-center">
                        <ShoppingCart className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                        <p className="text-base font-bold text-foreground">Cart is empty</p>
                        <p className="mt-1 mb-5 text-sm text-muted-foreground">Add a service to get started.</p>
                        <Button onClick={() => router.push("/customer/book")}>Browse Services</Button>
                    </div>
                )}

                {items.length > 0 && (
                    <>
                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Services ({items.length})</Label>
                                <div className="flex flex-col divide-y divide-border">
                                    {items.map(item => (
                                        <div key={item.id} className="flex items-start justify-between gap-2 py-3 first:pt-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-foreground">{item.serviceIcon} {item.serviceName}</p>
                                                {item.sizeLabel && <p className="mt-0.5 text-xs text-muted-foreground">{item.sizeLabel}</p>}
                                                {item.bathrooms && <p className="text-xs text-muted-foreground">{item.bathrooms} bathroom{item.bathrooms !== "1" ? "s" : ""}</p>}
                                                {item.addOns?.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">+ {item.addOns.map(a => a.label).join(", ")}</p>}
                                                {item.notes && <p className="mt-0.5 text-xs italic text-muted-foreground/80">&quot;{item.notes}&quot;</p>}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2.5">
                                                <span className="text-sm font-extrabold text-primary">{fmt$(item.subtotal)}</span>
                                                <button onClick={() => removeItem(item.id)} className="flex size-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="outline" className="mt-3 w-full border-dashed" onClick={() => router.push("/customer/book")}>
                                    <Plus className="size-4" /> Add Another Service
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Preferred Date &amp; Time</Label>
                                <Input type="date" value={date} min={minDate} onChange={e => setDate(e.target.value)} className="mb-3" />
                                <div className="flex gap-2">
                                    {TIME_SLOTS.map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setTimeSlot(t.value)}
                                            className={cn(
                                                "flex-1 rounded-lg border py-2.5 text-center font-semibold",
                                                timeSlot === t.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-muted/30 text-foreground"
                                            )}
                                        >
                                            <div className="text-xs">{t.label}</div>
                                            <div className="mt-0.5 text-[10px] opacity-80">{t.sub}</div>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="flex flex-col gap-2 p-4">
                                <Label className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Service Address</Label>
                                <Input placeholder="Street address" value={address1} onChange={e => setAddress1(e.target.value)} />
                                <Input placeholder="Apt / Unit (optional)" value={address2} onChange={e => setAddress2(e.target.value)} />
                                <div className="flex gap-2">
                                    <Input placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="flex-[2]" />
                                    <Input placeholder="Prov" value={province} onChange={e => setProvince(e.target.value)} className="flex-1" />
                                </div>
                                <Input placeholder="Postal code" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Promo Code</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter code"
                                        value={promoInput}
                                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromo(null); }}
                                        onKeyDown={e => e.key === "Enter" && applyPromo()}
                                        className="flex-1"
                                    />
                                    <Button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}>{promoLoading ? "…" : "Apply"}</Button>
                                </div>
                                {promo && (
                                    <p className={cn("mt-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold", promo.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-destructive/10 text-destructive")}>
                                        {promo.ok ? "✓ " : "✕ "}{promo.message}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {availablePoints > 0 && (
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Reward Points</Label>
                                            <p className="mt-1 text-sm text-foreground/80">
                                                You have <strong className="text-primary">{availablePoints.toLocaleString()} pts</strong>
                                                <span className="text-xs text-muted-foreground"> (= {fmt$(availablePoints / POINTS_PER_DOLLAR)})</span>
                                            </p>
                                        </div>
                                        <Button variant={usePoints ? "default" : "secondary"} className={usePoints ? "bg-emerald-600 hover:bg-emerald-600/90" : ""} onClick={() => setUsePoints(p => !p)}>
                                            {usePoints ? "✓ Applied" : "Use"}
                                        </Button>
                                    </div>
                                    {usePoints && pointsDiscount > 0 && (
                                        <p className="mt-2.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/30">
                                            ✓ {pointsUsed.toLocaleString()} pts → −{fmt$(pointsDiscount)} off your order
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Price Estimate</Label>
                                <p className="mb-3 mt-1 text-[11px] text-muted-foreground">Final price confirmed after booking review.</p>
                                <div className="flex flex-col gap-2 text-sm">
                                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-semibold text-foreground">{fmt$(subtotal)}</span></div>
                                    {promoDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-600"><span>Promo ({promo?.promo?.code || promoInput})</span><span className="font-semibold">−{fmt$(promoDiscount)}</span></div>
                                    )}
                                    {usePoints && pointsDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-600"><span>Reward Points (−{pointsUsed.toLocaleString()} pts)</span><span className="font-semibold">−{fmt$(pointsDiscount)}</span></div>
                                    )}
                                    <div className="flex justify-between text-muted-foreground"><span>HST ({Math.round(taxRate * 100)}%)</span><span className="font-semibold text-foreground">{fmt$(tax)}</span></div>
                                </div>
                                <div className="mt-2 flex justify-between border-t border-border pt-2.5 text-lg font-black text-primary">
                                    <span>Estimated Total</span><span>{fmt$(total)}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">No payment required now — we confirm and invoice you first.</p>
                            </CardContent>
                        </Card>

                        {error && (
                            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>
                        )}

                        <Button size="lg" className="w-full text-base" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? "Submitting…" : <>Request Booking <ArrowRight className="size-4" /></>}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">We&apos;ll review and reach out to confirm your booking.</p>
                    </>
                )}
            </div>
        </div>
    );
}
