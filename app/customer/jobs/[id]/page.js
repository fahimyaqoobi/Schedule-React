"use client";
import { useEffect, useState, use } from "react";
import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobChatCard from "../../../components/shared/JobChatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, PartyPopper, Check, Download, Star, Repeat, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// The customer portal authenticates via the "cst" session cookie, sent
// automatically with same-origin fetches — no bearer token needed here.
const getPortalAuthHeaders = async () => ({ "Content-Type": "application/json" });

const STEPS = [
    { label: "Estimate", desc: "Review your quote" },
    { label: "Confirmed", desc: "Appointment locked in" },
    { label: "Invoice", desc: "Service completed" },
    { label: "Complete", desc: "All done" },
];

function lifecycleStep(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

function fmt$(n) { return `$${parseFloat(n || 0).toFixed(2)}`; }

export default function JobDetailPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const sp = new URLSearchParams(window.location.search);
            if (sp.get("paid") === "true") setPaid(true);
        }
        fetch(`/api/customer/booking?bookingId=${id}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) setErr(d.error);
                else setBooking(d);
            })
            .catch(() => setErr("Could not load this job."))
            .finally(() => setLoading(false));
    }, [id]);

    async function handleConfirm() {
        setActionLoading(true); setErr(""); setMsg("");
        try {
            const res = await fetch("/api/customer/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: id }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMsg("Appointment confirmed! We'll see you soon. ✓");
            setBooking(prev => ({ ...prev, customerConfirmed: true }));
        } catch (e) { setErr(e.message); }
        finally { setActionLoading(false); }
    }

    async function handlePay() {
        setActionLoading(true); setErr("");
        try {
            const res = await fetch("/api/customer/pay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId: id,
                    successPath: `/customer/jobs/${id}?paid=true`,
                    cancelPath: `/customer/jobs/${id}`,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            window.location.href = data.url;
        } catch (e) { setErr(e.message); setActionLoading(false); }
    }

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading…</div>
            </div>
        );
    }

    if (err && !booking) {
        return (
            <div className="p-10 text-center">
                <div className="text-sm text-destructive">{err}</div>
                <Link href="/customer/jobs" className="mt-5 inline-block text-sm font-bold text-primary">← Back to Jobs</Link>
            </div>
        );
    }

    const step = lifecycleStep(booking);

    const hasPrice = Number(booking?.price) > 0;
    const subtotal = Number(booking?.subtotal || booking?.price || 0);
    const tax = Number(booking?.tax || 0);
    const promoDiscount = Number(booking?.promoDiscount || 0);
    const total = Number(booking?.price || 0);
    const amountReceived = Number(booking?.amountReceived || 0);
    const balanceDue = Math.max(0, total - amountReceived);
    const isPartiallyPaid = booking?.paymentStatus === "partial" && amountReceived > 0;

    return (
        <div>
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-6 text-primary-foreground">
                <Button variant="ghost" size="sm" className="mb-3 h-auto gap-1 bg-white/15 px-3 py-1.5 text-primary-foreground hover:bg-white/25 hover:text-primary-foreground" onClick={() => router.push("/customer/jobs")}>
                    <ChevronLeft className="size-4" /> Jobs
                </Button>
                <div className="text-xl font-extrabold">{booking?.service}</div>
                <div className="mt-0.5 text-sm opacity-85">{booking?.date} · {booking?.time || "Time TBD"}</div>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {paid && (
                    <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                        <CardContent className="flex flex-col items-center gap-1 p-5 text-center">
                            <PartyPopper className="size-7 text-emerald-600" />
                            <p className="font-bold text-emerald-800 dark:text-emerald-300">Payment received!</p>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">Thank you — your receipt has been emailed.</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="p-4">
                        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Job Status</p>
                        <div className="flex items-start">
                            {STEPS.map((s, i) => {
                                const done = i < step;
                                const active = i === step;
                                return (
                                    <Fragment key={s.label}>
                                        <div className="flex-none text-center" style={{ minWidth: 64 }}>
                                            <div className={cn(
                                                "mx-auto mb-1.5 flex size-7 items-center justify-center rounded-full",
                                                done ? "bg-emerald-500" : active ? "border-2 border-primary bg-primary/10" : "border border-border bg-muted"
                                            )}>
                                                {done ? <Check className="size-3.5 text-white" /> : <span className={cn("size-2 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />}
                                            </div>
                                            <p className={cn("text-[10px] font-bold", done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground")}>{s.label}</p>
                                            {active && <p className="mt-0.5 text-[9px] text-muted-foreground">{s.desc}</p>}
                                        </div>
                                        {i < STEPS.length - 1 && (
                                            <div className={cn("mt-3.5 h-0.5 flex-1", i < step ? "bg-emerald-500" : "bg-border")} />
                                        )}
                                    </Fragment>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {step === 0 && (
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-base font-bold text-foreground">Confirm Your Appointment</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                                Your booking is pending your confirmation. Please review the details and confirm to lock it in.
                            </p>
                            {msg && <p className="mt-3 text-sm font-semibold text-emerald-600">{msg}</p>}
                            {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
                            <Button className="mt-3.5 w-full" size="lg" onClick={handleConfirm} disabled={actionLoading}>
                                {actionLoading ? "Confirming…" : "Confirm Appointment"}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 1 && (
                    <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                        <CardContent className="flex flex-col items-center gap-1 p-5 text-center">
                            <Check className="size-6 text-emerald-600" />
                            <p className="font-bold text-emerald-800 dark:text-emerald-300">Appointment Confirmed</p>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                We&apos;ll see you on <strong>{booking?.date}</strong>. We&apos;ll be in touch closer to the date.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {step === 2 && (
                    <Card>
                        <CardContent className="p-4">
                            <p className="mb-3.5 text-base font-bold text-foreground">Invoice — Payment Due</p>
                            {hasPrice && (
                                <div className="mb-4 flex flex-col gap-1.5 text-sm">
                                    {subtotal > 0 && subtotal !== total && (
                                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt$(subtotal)}</span></div>
                                    )}
                                    {promoDiscount > 0 && (
                                        <div className="flex justify-between text-emerald-600"><span>Promo ({booking?.promoCode})</span><span>-{fmt$(promoDiscount)}</span></div>
                                    )}
                                    {tax > 0 && (
                                        <div className="flex justify-between text-muted-foreground"><span>HST (13%)</span><span>{fmt$(tax)}</span></div>
                                    )}
                                    <div className="flex justify-between text-muted-foreground"><span>Total</span><span>{fmt$(total)}</span></div>
                                    {isPartiallyPaid && (
                                        <div className="flex justify-between text-emerald-600"><span>Amount Received</span><span>-{fmt$(amountReceived)}</span></div>
                                    )}
                                    <div className="mt-2 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                                        <span className="font-bold">{isPartiallyPaid ? "Balance Due" : "Total Due"}</span>
                                        <span className="text-lg font-black">{fmt$(balanceDue)}</span>
                                    </div>
                                </div>
                            )}
                            {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
                            <Button asChild variant="outline" className="mb-2.5 w-full">
                                <a href={`/api/customer/invoice-pdf?bookingId=${id}`} download><Download className="size-4" /> View / Download Invoice PDF</a>
                            </Button>
                            <Button size="lg" className="w-full" onClick={handlePay} disabled={actionLoading}>
                                {actionLoading ? "Redirecting…" : `Pay ${hasPrice ? fmt$(isPartiallyPaid ? balanceDue : total) : ""} Now →`}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 3 && (
                    <Card>
                        <CardContent className="p-4">
                            {booking?.assignedStaff?.length > 0 && (
                                <div className="mb-4 rounded-lg bg-muted/50 p-3.5">
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                        Your Cleaner{booking.assignedStaff.length > 1 ? "s" : ""}
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {booking.assignedStaff.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2.5">
                                                <Avatar size="sm"><AvatarFallback>{(s.name || "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                                                <span className="text-sm font-semibold text-foreground">{s.name || "Staff"}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mb-4 text-center">
                                <Star className="mx-auto mb-2 size-7 fill-amber-400 text-amber-400" />
                                <p className="font-bold text-foreground">How was your clean?</p>
                                <p className="text-sm text-muted-foreground">A quick review helps us improve and supports our team.</p>
                            </div>
                            <Button asChild className="mb-2.5 w-full bg-amber-400 text-amber-950 hover:bg-amber-400/90">
                                <a href="https://g.page/r/smartouchclean/review" target="_blank" rel="noopener noreferrer"><Star className="size-4" /> Leave a Google Review</a>
                            </Button>
                            <Button asChild className="w-full">
                                <Link href="/customer/book"><Repeat className="size-4" /> Book Again</Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="p-4">
                        <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Details</p>
                        <div className="flex flex-col">
                            {[
                                ["Service", booking?.service],
                                ["Date", booking?.date],
                                ["Time", booking?.time || "TBD"],
                                ["Address", [booking?.address1, booking?.address2, booking?.city, booking?.postalCode].filter(Boolean).join(", ")],
                                booking?.estimateNumber && ["Estimate #", booking.estimateNumber],
                                booking?.invoiceNumber && ["Invoice #", booking.invoiceNumber],
                            ].filter(Boolean).map(([label, value]) => value ? (
                                <div key={label} className="flex items-start justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="max-w-[60%] text-right font-semibold text-foreground">{value}</span>
                                </div>
                            ) : null)}
                        </div>
                    </CardContent>
                </Card>

                <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        <MessageCircle className="size-3.5" /> Chat
                    </p>
                    <JobChatCard bookingId={id} getAuthHeaders={getPortalAuthHeaders} title="Chat with Your Cleaner" />
                </div>
            </div>
        </div>
    );
}
