"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Tag } from "lucide-react";
import CallButton from "./CallButton";
import { customerKeyForBooking, normalizePhone } from "@/lib/phone";

function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// The right-side panel from the reference layout — phone (with the Call
// button), email, location, lead source, and the same lifetime paid/owing
// snapshot the Customer Profile shows, all visible at a glance next to the
// timeline instead of buried further down the modal. Replaces the old
// "Client Information" detail-card, which only ever had name/phone/email —
// everything it showed lives here now, just with more room to read it.
export default function QuickFactsPanel({ booking, getAuthHeaders, onViewProfile }) {
    const [stats, setStats] = useState(null);
    const customerKey = customerKeyForBooking(booking);
    const phone = normalizePhone(booking.customerPortalPhone || booking.phone || "");

    useEffect(() => {
        if (!customerKey) return;
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/customers?key=${encodeURIComponent(customerKey)}`, { headers });
                const data = await res.json();
                if (res.ok) setStats(data);
            } catch {
                // Nice-to-have — the rest of the panel still works without it.
            }
        })();
    }, [customerKey, getAuthHeaders]);

    return (
        <Card className="h-fit lg:sticky lg:top-0">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Quick Facts"}</CardTitle>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Facts</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                        <p className="truncate text-base font-bold text-foreground">{booking.phone || "—"}</p>
                    </div>
                    {phone && <CallButton phone={phone} bookingId={booking.id} getAuthHeaders={getAuthHeaders} />}
                </div>

                {booking.email && (
                    <div className="flex items-start gap-2.5">
                        <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                            <p className="truncate text-base text-foreground">{booking.email}</p>
                        </div>
                    </div>
                )}

                {(booking.address1 || booking.city) && (
                    <div className="flex items-start gap-2.5">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                            <p className="text-base text-foreground">{[booking.address1, booking.city].filter(Boolean).join(", ")}</p>
                        </div>
                    </div>
                )}

                {booking.leadSource && (
                    <div className="flex items-start gap-2.5">
                        <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead Source</p>
                            <p className="text-base text-foreground">{booking.leadSource}</p>
                        </div>
                    </div>
                )}

                {stats && (
                    <div className="flex flex-col gap-1 border-t border-border pt-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer History</p>
                        <p className="text-base text-foreground">{stats.totalBookings} total booking{stats.totalBookings === 1 ? "" : "s"}</p>
                        <p className="text-base font-bold text-foreground">Paid {money(stats.totalPaid)}</p>
                        {stats.totalOwing > 0 && <p className="text-base font-bold text-destructive">Owing {money(stats.totalOwing)}</p>}
                    </div>
                )}

                {onViewProfile && (
                    <Button type="button" variant="secondary" className="w-full" onClick={onViewProfile}>
                        View Full History →
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
