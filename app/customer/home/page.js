"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, ArrowRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Estimate", "Confirmed", "Invoice", "Complete"];

function lifecycleOf(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

function LifecycleStepper({ step }) {
    return (
        <div className="mt-3 flex items-center">
            {STEPS.map((label, i) => {
                const done = i < step;
                const active = i === step;
                return (
                    <div key={label} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                            <span className={cn(
                                "size-2.5 rounded-full",
                                done ? "bg-emerald-500" : active ? "bg-primary ring-2 ring-primary/30" : "bg-muted"
                            )} />
                            <span className={cn("text-[9px] font-bold", done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground/60")}>{label}</span>
                        </div>
                        {i < STEPS.length - 1 && <div className={cn("mx-1 -mt-3.5 h-0.5 flex-1", i < step ? "bg-emerald-500" : "bg-muted")} />}
                    </div>
                );
            })}
        </div>
    );
}

export default function CustomerHomePage() {
    const [profile, setProfile] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/customer/profile").then(r => r.json()),
            fetch("/api/customer/bookings").then(r => r.json()),
        ]).then(([p, b]) => {
            setProfile(p.profile || {});
            setBookings(b.bookings || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-primary to-primary/80">
                <div className="text-sm text-primary-foreground/75">Loading…</div>
            </div>
        );
    }

    const active = bookings.filter(b => b.status !== "Cancelled" && b.paymentStatus !== "paid");
    active.sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
    const nextJob = active[0];

    const pendingPayment = bookings.find(b => (b.status === "Completed" || b.documentStage === "invoice") && b.paymentStatus !== "paid");

    const name = (profile?.name || "").split(" ")[0] || "there";
    const points = profile?.rewardPoints || 0;
    const referralCode = profile?.referralCode || "";

    return (
        <div>
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-7 text-primary-foreground">
                <div className="text-xl font-extrabold">Hi, {name} 👋</div>
                <div className="mt-0.5 text-sm opacity-85">Welcome back to Smartouch Clean</div>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {pendingPayment && (
                    <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                        <CardContent className="p-4">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">⚡ Invoice Ready — Payment Due</p>
                            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                                {pendingPayment.service} · {pendingPayment.date} · <strong>${parseFloat(pendingPayment.price || 0).toFixed(2)}</strong>
                            </p>
                            <div className="mt-3 flex gap-2">
                                <Button asChild variant="outline" size="sm" className="flex-1 border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300">
                                    <a href={`/api/customer/invoice-pdf?bookingId=${pendingPayment.id}`} download><Download className="size-3.5" /> View Invoice</a>
                                </Button>
                                <Button asChild size="sm" className="flex-1 bg-amber-600 text-white hover:bg-amber-600/90">
                                    <Link href={`/customer/jobs/${pendingPayment.id}`}>Pay Now <ArrowRight className="size-3.5" /></Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next Appointment</p>

                {nextJob ? (
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-base font-extrabold text-foreground">{nextJob.service}</p>
                                    <p className="mt-0.5 text-sm text-muted-foreground">{nextJob.date} · {nextJob.time}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground/80">{nextJob.address1}</p>
                                </div>
                                <Badge variant="secondary">{nextJob.status}</Badge>
                            </div>
                            <LifecycleStepper step={lifecycleOf(nextJob)} />
                            {lifecycleOf(nextJob) === 0 && (
                                <Button asChild className="mt-4 w-full">
                                    <Link href={`/customer/jobs/${nextJob.id}`}>Review &amp; Confirm Appointment</Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 p-7 text-center">
                            <div className="text-4xl">🧹</div>
                            <div>
                                <p className="font-bold text-foreground">No upcoming cleanings</p>
                                <p className="mt-1 text-sm text-muted-foreground">Book your next appointment today.</p>
                            </div>
                            <Button asChild>
                                <Link href="/customer/book">Book Now</Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rewards</p>
                <Card className="overflow-hidden border-none bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div>
                            <div className="flex items-center gap-1.5 text-3xl font-black leading-none">
                                <Sparkles className="size-6" /> {points}
                            </div>
                            <p className="mt-1 text-xs opacity-90">reward points earned</p>
                        </div>
                        <Button asChild variant="secondary" size="sm" className="bg-white/20 text-white hover:bg-white/30">
                            <Link href="/customer/rewards">View <ArrowRight className="size-3.5" /></Link>
                        </Button>
                    </CardContent>
                </Card>

                {referralCode && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-4">
                            <p className="flex items-center gap-1.5 text-sm font-bold text-primary"><Gift className="size-4" /> Refer a Friend, Earn $30</p>
                            <p className="mt-1 text-sm text-foreground/80">
                                Give friends $30 off their first clean. Your code: <strong>{referralCode}</strong>
                            </p>
                            <Button asChild size="sm" className="mt-3">
                                <Link href="/customer/rewards">Share Code <ArrowRight className="size-3.5" /></Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
