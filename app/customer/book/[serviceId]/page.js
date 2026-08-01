"use client";
import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getServiceCard, SIZE_MAP, ADD_ONS } from "../../../../lib/bookingServices";
import { addCartItem } from "../../../../lib/customerCart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
            <div className="p-10 text-center">
                <p className="text-sm text-muted-foreground">Service not found.</p>
                <Button className="mt-5" onClick={() => router.push("/customer/book")}><ChevronLeft className="size-4" /> Back</Button>
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
            <div className="pb-24">
                <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-7 text-primary-foreground">
                    <Button variant="ghost" size="sm" className="mb-3 h-auto gap-1 bg-white/15 px-3 py-1.5 text-primary-foreground hover:bg-white/25 hover:text-primary-foreground" onClick={() => router.push("/customer/book")}>
                        <ChevronLeft className="size-4" /> Back
                    </Button>
                    <div className="mb-1.5 text-3xl">{svc.icon}</div>
                    <div className="text-xl font-extrabold">{svc.name}</div>
                    <div className="mt-0.5 text-sm opacity-85">{svc.subtitle}</div>
                </div>

                <div className="flex flex-col gap-3.5 p-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-base font-bold text-foreground">Service Price</p>
                                <p className="text-2xl font-black text-primary">{fmt$(flatPrice)}</p>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Final price confirmed after booking review. HST not included.</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <Label className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes / Special Access</Label>
                            <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Any details we should know — access instructions, areas to focus on, etc."
                                className="min-h-22"
                            />
                        </CardContent>
                    </Card>

                    <Button size="lg" className={cn("w-full text-base", added && "bg-emerald-600 hover:bg-emerald-600/90")} onClick={handleAddToCart} disabled={added}>
                        {added ? <><Check className="size-4" /> Added to Cart!</> : `Add to Cart — ${fmt$(flatPrice)}`}
                    </Button>
                </div>
            </div>
        );
    }

    // ─── CONFIGURABLE SERVICE ─────────────────────────────
    const stepTitles = ["Choose Size", "Add-Ons", "Notes"];
    const progress = (step / 3) * 100;

    return (
        <div className="pb-24">
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-5 text-primary-foreground">
                <Button
                    variant="ghost" size="sm"
                    className="mb-3 h-auto gap-1 bg-white/15 px-3 py-1.5 text-primary-foreground hover:bg-white/25 hover:text-primary-foreground"
                    onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/customer/book")}
                >
                    <ChevronLeft className="size-4" /> {step > 1 ? "Back" : "Services"}
                </Button>
                <div className="mb-3 flex items-center gap-3">
                    <div className="text-3xl">{svc.icon}</div>
                    <div>
                        <div className="text-lg font-extrabold">{svc.name}</div>
                        <div className="text-xs opacity-80">Step {step} of 3 — {stepTitles[step - 1]}</div>
                    </div>
                </div>
                <Progress value={progress} className="[&_[data-slot=progress-track]]:bg-white/25 [&_[data-slot=progress-indicator]]:bg-white" />
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {step === 1 && (
                    <>
                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Select Home Size</Label>
                                <div className="flex flex-col gap-2">
                                    {(sizeOptions.length > 0 ? sizeOptions : SIZE_MAP.map(s => ({ ...s, price: 0 }))).map(size => {
                                        const active = sizeKey === size.key;
                                        return (
                                            <button
                                                key={size.key}
                                                onClick={() => setSizeKey(size.key)}
                                                className={cn(
                                                    "flex items-center justify-between rounded-lg border p-3.5 text-left",
                                                    active ? "border-primary bg-primary/10" : "border-input bg-muted/30"
                                                )}
                                            >
                                                <div>
                                                    <p className={cn("text-sm font-bold", active ? "text-primary" : "text-foreground")}>{size.label}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{size.sub}</p>
                                                </div>
                                                {size.price > 0 && <p className={cn("shrink-0 text-sm font-extrabold", active ? "text-primary" : "text-foreground/70")}>{fmt$(size.price)}</p>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Button size="lg" className="w-full text-base" disabled={!sizeKey} onClick={() => setStep(2)}>
                            Next: Add-Ons →
                        </Button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Number of Bathrooms</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BATHROOMS.map(b => (
                                        <button
                                            key={b}
                                            onClick={() => setBathrooms(b)}
                                            className={cn(
                                                "rounded-lg border py-3 text-center text-base font-bold",
                                                bathrooms === b ? "border-primary bg-primary text-primary-foreground" : "border-input bg-muted/30 text-foreground"
                                            )}
                                        >
                                            {b}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Add-Ons (optional)</Label>
                                <div className="flex flex-col gap-2">
                                    {ADD_ONS.map(({ key, label, price }) => {
                                        const on = addOns.includes(key);
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleAddOn(key)}
                                                className={cn(
                                                    "flex items-center justify-between rounded-lg border p-3",
                                                    on ? "border-primary bg-primary/5" : "border-input bg-muted/30"
                                                )}
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <span className={cn(
                                                        "flex size-5 items-center justify-center rounded-[5px] border-2",
                                                        on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                                                    )}>
                                                        {on && <Check className="size-3" />}
                                                    </span>
                                                    <span className={cn("text-left text-sm", on ? "font-bold text-primary" : "text-foreground")}>{label}</span>
                                                </span>
                                                <span className={cn("shrink-0 text-sm font-bold", on ? "text-primary" : "text-muted-foreground")}>+{fmt$(price)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Button size="lg" className="w-full text-base" onClick={() => setStep(3)}>Next: Notes →</Button>
                    </>
                )}

                {step === 3 && (
                    <>
                        <Card>
                            <CardContent className="p-4">
                                <Label className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Notes / Special Access</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Dogs on premises, alarm code, key under mat, focus on kitchen…"
                                    className="min-h-22"
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Price Estimate</Label>
                                <p className="mb-2.5 mt-1 text-xs text-muted-foreground">Final price confirmed after booking review.</p>
                                <div className="flex flex-col gap-2 text-sm">
                                    {[
                                        { label: SIZE_MAP.find(s => s.key === sizeKey)?.label || "Base service", val: fmt$(basePrice) },
                                        ...addOns.map(k => {
                                            const ao = ADD_ONS.find(a => a.key === k);
                                            return { label: ao?.label || k, val: `+${fmt$(ao?.price || 0)}` };
                                        }),
                                    ].map(({ label, val }, i) => (
                                        <div key={i} className="flex justify-between text-muted-foreground">
                                            <span>{label}</span><span className="font-semibold text-foreground">{val}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2.5 flex justify-between border-t border-border pt-2.5 text-lg font-black text-primary">
                                    <span>Subtotal</span><span>{fmt$(subtotal)}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">+ HST applied at checkout</p>
                            </CardContent>
                        </Card>

                        <Button size="lg" className={cn("w-full text-base", added && "bg-emerald-600 hover:bg-emerald-600/90")} onClick={handleAddToCart} disabled={added || !canAddToCart}>
                            {added ? <><Check className="size-4" /> Added to Cart! Returning…</> : `Add to Cart — ${fmt$(subtotal)}`}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">You can add more services before checking out.</p>
                    </>
                )}
            </div>
        </div>
    );
}
