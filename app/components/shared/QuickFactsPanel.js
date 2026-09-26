"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Tag } from "lucide-react";
import CallButton from "./CallButton";
import { customerKeyForBooking, normalizePhone } from "@/lib/phone";

function money(n) {
    return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// A single icon-badge row — colored circle icon, label, value — matching the
// reference layout's "Quick Facts" panel instead of a plain icon-then-text
// line. `tone` picks the badge's color so phone/email/location/lead-source
// each read as a distinct chip at a glance.
const TONES = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-sky-100 text-sky-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
};

function FactRow({ icon: Icon, tone = "slate", label, value, action }) {
    return (
        <div className="flex items-start gap-3">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="truncate text-base font-semibold text-foreground">{value}</p>
            </div>
            {action}
        </div>
    );
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

    const displayName = booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Quick Facts";

    return (
        <Card className="h-fit lg:sticky lg:top-0">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                    </span>
                    <div className="min-w-0">
                        <CardTitle className="truncate text-base">{displayName}</CardTitle>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Facts</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <FactRow
                    icon={Phone}
                    tone="blue"
                    label="Phone"
                    value={booking.phone || "—"}
                    action={phone && <CallButton phone={phone} bookingId={booking.id} getAuthHeaders={getAuthHeaders} />}
                />

                {booking.email && (
                    <FactRow icon={Mail} tone="slate" label="Email" value={booking.email} />
                )}

                {(booking.address1 || booking.city) && (
                    <FactRow icon={MapPin} tone="amber" label="Location" value={[booking.address1, booking.city].filter(Boolean).join(", ")} />
                )}

                {booking.leadSource && (
                    <FactRow icon={Tag} tone="violet" label="Lead Source" value={booking.leadSource} />
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
