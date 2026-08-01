"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatPhone(raw) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function CustomerLoginForm() {
    const router = useRouter();
    const [step, setStep] = useState("phone");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");          // single string, not array
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const otpInputRef = useRef(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    // Focus the hidden input whenever the OTP step is shown
    useEffect(() => {
        if (step === "otp") {
            const t = setTimeout(() => otpInputRef.current?.focus(), 120);
            return () => clearTimeout(t);
        }
    }, [step]);

    async function sendOtp() {
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) { setError("Please enter a valid 10-digit number."); return; }
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/customer/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: digits }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Failed to send code.");
            setOtp("");
            setStep("otp");
            setCooldown(60);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    async function verifyOtp() {
        if (otp.length !== 6) { setError("Please enter the 6-digit code."); return; }
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/customer/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.replace(/\D/g, ""), code: otp }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Verification failed.");
            router.push(data.isNewCustomer ? "/customer/onboarding" : "/customer/home");
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-background to-muted/40 px-5 py-6">
            <Card className="w-full max-w-sm shadow-lg">
                <CardContent className="p-8">
                    <div className="mb-7 text-center">
                        <div className="text-2xl font-black tracking-tight text-primary">Smartouch Clean</div>
                        <div className="mt-1 text-sm text-muted-foreground">Your personal cleaning portal</div>
                    </div>

                    {step === "phone" ? (
                        <>
                            <Label className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mobile Number</Label>
                            <Input
                                type="tel"
                                inputMode="numeric"
                                placeholder="(416) 555-0123"
                                value={phone}
                                onChange={e => setPhone(formatPhone(e.target.value))}
                                onKeyDown={e => e.key === "Enter" && sendOtp()}
                                maxLength={14}
                                autoFocus
                                className="h-12 text-lg"
                            />
                            <Button size="lg" className="mt-4.5 w-full" onClick={sendOtp} disabled={loading}>
                                {loading ? "Sending…" : "Send Verification Code"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="mb-1.5 text-center text-sm text-foreground/80">
                                Code sent to <strong>{phone}</strong>
                            </p>

                            <div className="relative my-5 flex cursor-text justify-center gap-2" onClick={() => otpInputRef.current?.focus()}>
                                {Array.from({ length: 6 }, (_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex h-13.5 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] bg-card text-2xl font-bold text-primary",
                                            otp[i] ? "border-primary" : i === otp.length ? "border-muted-foreground" : "border-input"
                                        )}
                                    >
                                        {otp[i] || ""}
                                    </div>
                                ))}

                                <input
                                    ref={otpInputRef}
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={otp}
                                    onChange={e => {
                                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                        setOtp(v);
                                        if (v.length === 6) verifyOtp();
                                    }}
                                    onKeyDown={e => e.key === "Enter" && verifyOtp()}
                                    maxLength={6}
                                    className="absolute inset-0 z-10 size-full cursor-text border-none text-base opacity-0 outline-none"
                                />
                            </div>

                            <Button size="lg" className="w-full" onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                                {loading ? "Verifying…" : "Verify & Sign In"}
                            </Button>

                            <div className="mt-4 text-center">
                                {cooldown > 0 ? (
                                    <span className="text-xs text-muted-foreground">Resend code in {cooldown}s</span>
                                ) : (
                                    <button className="text-xs font-semibold text-primary" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>
                                        ← Change number or resend
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
                </CardContent>
            </Card>
        </div>
    );
}
