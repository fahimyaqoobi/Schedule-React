"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SERVICE_CARDS } from "../../../lib/bookingServices";
import { getCartCount } from "../../../lib/customerCart";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ArrowRight } from "lucide-react";

export default function CustomerBookPage() {
    const router = useRouter();
    const [cartCount, setCartCount] = useState(0);
    const [prices, setPrices] = useState({});

    useEffect(() => {
        setCartCount(getCartCount());
        // Refresh cart count when customer returns from configurator
        const onFocus = () => setCartCount(getCartCount());
        window.addEventListener("focus", onFocus);
        // Also listen for custom cart-update event dispatched by configurator
        const onCart = () => setCartCount(getCartCount());
        window.addEventListener("cart-updated", onCart);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("cart-updated", onCart);
        };
    }, []);

    useEffect(() => {
        fetch("/api/customer/services")
            .then(r => r.json())
            .then(d => { if (d.services) setPrices(d.services); })
            .catch(() => {});
    }, []);

    function fromPrice(card) {
        if (card.type === "flat") {
            const p = prices[card.firestoreKey] || card.fallbackPrice || 0;
            return p > 0 ? `$${p.toFixed(0)}` : null;
        }
        // configurable — find the cheapest size
        const sizePrices = Object.entries(prices)
            .filter(([k]) => !["Window Cleaning", "Gutter Cleaning", "Power Washing"].includes(k))
            .map(([, v]) => v)
            .filter(v => v > 0);
        if (!sizePrices.length) return null;
        return `from $${Math.min(...sizePrices).toFixed(0)}`;
    }

    return (
        <div className="pb-24">
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-7 text-primary-foreground">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xl font-extrabold">Book a Clean</div>
                        <div className="mt-0.5 text-sm opacity-85">Tap a service to configure and add to cart</div>
                    </div>
                    <Link href="/customer/book/cart" className="relative shrink-0">
                        <div className="flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2">
                            <ShoppingCart className="size-5" />
                        </div>
                        {cartCount > 0 && (
                            <Badge className="absolute -right-1.5 -top-1.5 size-5 justify-center rounded-full border-2 border-primary bg-destructive p-0 text-[11px] text-white hover:bg-destructive">
                                {cartCount}
                            </Badge>
                        )}
                    </Link>
                </div>
            </div>

            <div className="p-4">
                <p className="mb-3.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Choose a Service</p>

                <div className="mb-5 grid grid-cols-2 gap-3">
                    {SERVICE_CARDS.map(svc => {
                        const price = fromPrice(svc);
                        return (
                            <Card key={svc.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => router.push(`/customer/book/${svc.id}`)}>
                                <CardContent className="p-3.5 text-left">
                                    <div className="mb-2.5 flex size-11 items-center justify-center rounded-xl text-2xl" style={{ background: svc.bg }}>
                                        {svc.icon}
                                    </div>
                                    <p className="text-[13px] font-extrabold leading-tight text-foreground">{svc.name}</p>
                                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{svc.subtitle}</p>
                                    {price && <p className="mt-1.5 text-xs font-bold text-primary">{price}</p>}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {cartCount > 0 && (
                    <Link href="/customer/book/cart" className="flex items-center justify-between rounded-2xl bg-primary px-5 py-4 font-bold text-primary-foreground">
                        <span className="flex items-center gap-2"><ShoppingCart className="size-4" /> View Cart</span>
                        <span className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-sm">
                            {cartCount} item{cartCount > 1 ? "s" : ""} <ArrowRight className="size-3.5" />
                        </span>
                    </Link>
                )}
            </div>
        </div>
    );
}
