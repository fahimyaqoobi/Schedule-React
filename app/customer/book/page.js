"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SERVICE_CARDS } from "../../../lib/bookingServices";
import { getCartCount } from "../../../lib/customerCart";

const BRAND = "#005691";
const ACTION = "#0A6CB8";

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
        <div style={{ paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 28px", color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>Book a Clean</div>
                        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Tap a service to configure and add to cart</div>
                    </div>

                    {/* Cart badge */}
                    <Link href="/customer/book/cart" style={{ position: "relative", textDecoration: "none", flexShrink: 0 }}>
                        <div style={{ background: "rgba(255,255,255,0.18)", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 14, padding: "9px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 20 }}>🛒</span>
                            {cartCount > 0 && (
                                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{cartCount}</span>
                            )}
                        </div>
                        {cartCount > 0 && (
                            <div style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, border: "2px solid #fff" }}>
                                {cartCount}
                            </div>
                        )}
                    </Link>
                </div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    Choose a Service
                </div>

                {/* 2-column service grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {SERVICE_CARDS.map(svc => {
                        const price = fromPrice(svc);
                        return (
                            <button
                                key={svc.id}
                                onClick={() => router.push(`/customer/book/${svc.id}`)}
                                style={{ background: "#fff", border: "1.5px solid #f1f5f9", borderRadius: 20, padding: "18px 14px", textAlign: "left", cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", fontFamily: "inherit", transition: "box-shadow 0.15s" }}
                            >
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: svc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 10 }}>
                                    {svc.icon}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 3, lineHeight: 1.3 }}>{svc.name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4, marginBottom: 6 }}>{svc.subtitle}</div>
                                {price && <div style={{ fontSize: 12, fontWeight: 700, color: ACTION }}>{price}</div>}
                            </button>
                        );
                    })}
                </div>

                {/* Sticky cart CTA when items in cart */}
                {cartCount > 0 && (
                    <Link href="/customer/book/cart" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: ACTION, color: "#fff", borderRadius: 16, padding: "16px 20px", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                        <span>🛒 View Cart</span>
                        <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "4px 12px", fontSize: 13 }}>
                            {cartCount} item{cartCount > 1 ? "s" : ""} →
                        </span>
                    </Link>
                )}
            </div>
        </div>
    );
}
