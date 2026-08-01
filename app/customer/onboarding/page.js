"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PROVINCES = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL", "NT", "YT", "NU"];

const STEPS = ["Your Name", "Email Address", "Service Address"];

export default function CustomerOnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [province, setProvince] = useState("ON");
    const [postalCode, setPostalCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    // Pre-fill any data already in profile (from existing bookings)
    useEffect(() => {
        fetch("/api/customer/profile")
            .then(r => r.json())
            .then(d => {
                const p = d.profile || {};
                if (p.name) setName(p.name);
                if (p.email) setEmail(p.email);
                if (p.address) setAddress(p.address);
                if (p.city) setCity(p.city);
                if (p.province) setProvince(p.province);
                if (p.postalCode) setPostalCode(p.postalCode);
            })
            .catch(() => {});
    }, []);

    function next() {
        setErr("");
        if (step === 0 && !name.trim()) { setErr("Please enter your full name."); return; }
        if (step === 1 && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Please enter a valid email address."); return; }
        if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
        // Last step — save and redirect
        finish();
    }

    async function finish() {
        setSaving(true); setErr("");
        try {
            const res = await fetch("/api/customer/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, address, city, province, postalCode }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Could not save. Please try again.");
            router.push("/customer/home");
        } catch (e) { setErr(e.message); }
        finally { setSaving(false); }
    }

    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-background to-muted/40 px-5 py-6">
            <Card className="w-full max-w-sm shadow-lg">
                <CardContent className="p-8">
                    <div className="mb-6 text-center">
                        <div className="text-2xl font-black tracking-tight text-primary">Smartouch Clean</div>
                        <div className="mt-1 text-sm text-muted-foreground">Let&apos;s get you set up</div>
                    </div>

                    <div className="mb-6">
                        <div className="mb-1.5 flex justify-between">
                            {STEPS.map((label, i) => (
                                <span key={label} className={cn("text-[10px] font-bold uppercase tracking-wide", i <= step ? "text-primary" : "text-muted-foreground/50")}>
                                    {label}
                                </span>
                            ))}
                        </div>
                        <Progress value={progress} />
                    </div>

                    {step === 0 && (
                        <>
                            <p className="mb-1 text-lg font-extrabold text-foreground">What&apos;s your name?</p>
                            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                                This is how we&apos;ll greet you and personalize your experience.
                            </p>
                            <Input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && next()} placeholder="Full Name" className="h-12 text-base" />
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <p className="mb-1 text-lg font-extrabold text-foreground">Email address?</p>
                            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                                For receipts, invoices, and appointment reminders. You can skip this for now.
                            </p>
                            <Input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && next()} placeholder="you@example.com (optional)" className="h-12 text-base" />
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <p className="mb-1 text-lg font-extrabold text-foreground">Your service address?</p>
                            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                                Where do you want us to clean? You can update this anytime.
                            </p>
                            <div className="flex flex-col gap-2.5">
                                <Input autoFocus value={address} onChange={e => setAddress(e.target.value)} placeholder="Street address" className="h-12 text-base" />
                                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="h-12 text-base" />
                                <div className="flex gap-2.5">
                                    <Select value={province} onValueChange={setProvince}>
                                        <SelectTrigger className="h-12 flex-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Input value={postalCode} onChange={e => setPostalCode(e.target.value.toUpperCase())} placeholder="Postal Code" maxLength={7} className="h-12 flex-1 text-base" />
                                </div>
                            </div>
                        </>
                    )}

                    {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}

                    <Button size="lg" className="mt-5 w-full" onClick={next} disabled={saving}>
                        {saving ? "Saving…" : step < STEPS.length - 1 ? "Continue →" : "All Done — Let's Go!"}
                    </Button>

                    {step > 0 && (
                        <button className="mt-3 w-full py-2 text-center text-xs text-muted-foreground" onClick={() => { setStep(s => s - 1); setErr(""); }}>
                            ← Back
                        </button>
                    )}

                    {step === 1 && (
                        <button className="mt-1 w-full py-1 text-center text-xs text-muted-foreground" onClick={next}>
                            Skip for now
                        </button>
                    )}

                    {step === 2 && (
                        <button className="mt-1 w-full py-1 text-center text-xs text-muted-foreground" onClick={finish} disabled={saving}>
                            Skip address for now
                        </button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
