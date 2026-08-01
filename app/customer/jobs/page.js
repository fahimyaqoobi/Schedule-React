"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Estimate", "Confirmed", "Invoice", "Complete"];

function lifecycleStep(b) {
    if (b.paymentStatus === "paid") return 3;
    if (b.status === "Completed" || b.documentStage === "invoice") return 2;
    if (b.customerConfirmed) return 1;
    return 0;
}

const STATUS_BADGE = [
    { label: "Awaiting Confirm", className: "border-amber-300 bg-amber-50 text-amber-700" },
    { label: "Confirmed", className: "border-primary/30 bg-primary/10 text-primary" },
    { label: "Invoice Ready", className: "border-violet-300 bg-violet-50 text-violet-700" },
    { label: "Complete", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
];

function JobCard({ b }) {
    const step = lifecycleStep(b);
    const badge = STATUS_BADGE[step];

    return (
        <Link href={`/customer/jobs/${b.id}`}>
            <Card className="mb-2.5 transition-colors hover:bg-muted/40">
                <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-bold text-foreground">{b.service}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{b.date} · {b.time || "TBD"}</p>
                            {b.address1 && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/80">
                                    <MapPin className="size-3 shrink-0" /> {b.address1}
                                </p>
                            )}
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 whitespace-nowrap text-[10px]", badge.className)}>{badge.label}</Badge>
                    </div>
                    <div className="flex items-center">
                        {STEP_LABELS.map((label, i) => (
                            <div key={label} className="flex flex-1 items-center last:flex-none">
                                <span className={cn("size-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
                                {i < STEP_LABELS.length - 1 && <div className={cn("mx-0.5 h-px flex-1", i < step ? "bg-primary" : "bg-muted")} />}
                            </div>
                        ))}
                    </div>
                    <div className="mt-1.5 flex justify-between">
                        {STEP_LABELS.map((label, i) => (
                            <span key={label} className={cn("text-[9px] font-semibold", i <= step ? "text-primary" : "text-muted-foreground/50")}>{label}</span>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

export default function CustomerJobsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/customer/bookings")
            .then(r => r.json())
            .then(d => setBookings(d.bookings || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const active = bookings.filter(b => b.status !== "Cancelled" && b.paymentStatus !== "paid");
    const past = bookings.filter(b => b.status === "Cancelled" || b.paymentStatus === "paid");
    active.sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
    past.sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);

    return (
        <div>
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-6 text-primary-foreground">
                <div className="text-xl font-extrabold">My Jobs</div>
                <div className="mt-0.5 text-sm opacity-85">Track all your cleanings</div>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : bookings.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                            <ClipboardList className="size-8 text-muted-foreground/50" />
                            <div>
                                <p className="font-bold text-foreground">No bookings yet</p>
                                <p className="mt-1 text-sm text-muted-foreground">Your cleaning history will appear here.</p>
                            </div>
                            <Button asChild><Link href="/customer/book">Book Now</Link></Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {active.length > 0 && (
                            <>
                                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Upcoming</p>
                                {active.map(b => <JobCard key={b.id} b={b} />)}
                            </>
                        )}
                        {past.length > 0 && (
                            <>
                                <p className="mt-2 mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Past</p>
                                {past.map(b => <JobCard key={b.id} b={b} />)}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
