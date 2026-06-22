"use client";
import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

function ConfirmationContent() {
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("bookingId");

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "#f8fafc" }}>
            <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: GREEN + "20", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 40 }}>
                    ✓
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Booking Requested!
                </h1>
                <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.7, marginBottom: 28 }}>
                    Your booking request has been submitted. Our team will review it and reach out to confirm the details and send your invoice.
                </p>

                <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 24, textAlign: "left" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>What happens next</div>
                    {[
                        "We review your booking request",
                        "Team reaches out to confirm date & time",
                        "Invoice sent to your email",
                        "Cleaner arrives on your scheduled day",
                    ].map((step, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: ACTION, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                                {i + 1}
                            </div>
                            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{step}</div>
                        </div>
                    ))}
                </div>

                <Link href="/customer/home" style={{ display: "block", background: ACTION, color: "#fff", borderRadius: 14, padding: "15px 0", fontWeight: 700, fontSize: 16, textDecoration: "none", marginBottom: 12 }}>
                    Go to My Portal →
                </Link>
                {bookingId && (
                    <Link href={`/customer/jobs/${bookingId}`} style={{ display: "block", background: "#f1f5f9", color: BRAND, borderRadius: 14, padding: "14px 0", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
                        View This Booking
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</div>}>
            <ConfirmationContent />
        </Suspense>
    );
}
