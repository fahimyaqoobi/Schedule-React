"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CircleCheck, ArrowRight } from "lucide-react";

const STEPS = [
    "We review your booking request",
    "Team reaches out to confirm date & time",
    "Invoice sent to your email",
    "Cleaner arrives on your scheduled day",
];

function ConfirmationContent() {
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("bookingId");

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
            <div className="w-full max-w-sm text-center">
                <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                    <CircleCheck className="size-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-black text-foreground">Booking Requested!</h1>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    Your booking request has been submitted. Our team will review it and reach out to confirm the details and send your invoice.
                </p>

                <Card className="mb-6 mt-6 text-left">
                    <CardContent className="p-4">
                        <p className="mb-1 text-xs text-muted-foreground">What happens next</p>
                        <div className="flex flex-col gap-2.5 pt-2">
                            {STEPS.map((step, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <span className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm leading-relaxed text-foreground/85">{step}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Button asChild size="lg" className="mb-3 w-full">
                    <Link href="/customer/home">Go to My Portal <ArrowRight className="size-4" /></Link>
                </Button>
                {bookingId && (
                    <Button asChild variant="secondary" size="lg" className="w-full">
                        <Link href={`/customer/jobs/${bookingId}`}>View This Booking</Link>
                    </Button>
                )}
            </div>
        </div>
    );
}

export default function ConfirmationPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
            <ConfirmationContent />
        </Suspense>
    );
}
