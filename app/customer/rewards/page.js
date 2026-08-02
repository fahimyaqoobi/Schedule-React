"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Smartphone, Share2, Copy, Check, Users, CreditCard, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZonedDate } from "@/lib/timezone";

function ShareButton({ label, className, onClick, Icon }) {
    return (
        <button onClick={onClick} className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg py-3 text-xs font-bold text-white", className)}>
            <Icon className="size-5" />
            {label}
        </button>
    );
}

export default function CustomerRewardsPage() {
    const [profile, setProfile] = useState(null);
    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/api/customer/profile").then(r => r.json()),
            fetch("/api/customer/referrals").then(r => r.json()),
        ]).then(([p, r]) => {
            setProfile(p.profile || {});
            setReferrals(r.referrals || []);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const points = profile?.rewardPoints || 0;
    const referralCode = profile?.referralCode || "";
    const promoHistory = profile?.promoHistory || [];
    const shareText = `Use my Smartouch Clean referral code ${referralCode} to get $30 off your first clean! 🧹 Book at smartouchclean.com`;

    function copyCode() {
        navigator.clipboard?.writeText(referralCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }
    function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank"); }
    function shareSMS() { window.open(`sms:?&body=${encodeURIComponent(shareText)}`, "_blank"); }
    function shareNative() {
        if (navigator.share) { navigator.share({ title: "Smartouch Clean", text: shareText }); }
        else { copyCode(); }
    }

    return (
        <div>
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 pt-13 pb-7 text-white">
                <div className="text-xl font-extrabold">Rewards</div>
                <div className="mt-0.5 text-sm opacity-85">Earn points, refer friends, save more</div>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : (
                    <>
                        <Card>
                            <CardContent className="flex flex-col items-center p-6 text-center">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your Balance</p>
                                <p className="text-6xl font-black leading-none text-emerald-600">{points}</p>
                                <p className="mt-1.5 text-sm text-muted-foreground">reward points</p>
                                <div className="mt-4 w-full rounded-lg bg-muted/50 p-3.5 text-xs leading-relaxed text-muted-foreground">
                                    Earn <strong className="text-foreground">1 point per $1</strong> spent on every clean. Points can be redeemed for discounts on future bookings.
                                </div>
                            </CardContent>
                        </Card>

                        {referralCode && (
                            <Card>
                                <CardContent className="p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Refer a Friend</p>
                                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                                        Share your code and you both get <strong>$30 off</strong> — you earn when your friend completes their first paid clean.
                                    </p>

                                    <div className="mt-3.5 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 py-3.5 text-center">
                                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">YOUR CODE</p>
                                        <p className="text-2xl font-black tracking-wide text-primary">{referralCode}</p>
                                    </div>

                                    <div className="mt-3.5 flex gap-2.5">
                                        <ShareButton label="WhatsApp" Icon={MessageCircle} className="bg-[#25D366]" onClick={shareWhatsApp} />
                                        <ShareButton label="SMS" Icon={Smartphone} className="bg-[#007AFF]" onClick={shareSMS} />
                                        <ShareButton label="Share" Icon={Share2} className="bg-primary" onClick={shareNative} />
                                    </div>
                                    <Button
                                        variant={copied ? "default" : "secondary"}
                                        className={cn("mt-2.5 w-full", copied && "bg-emerald-600 text-white hover:bg-emerald-600/90")}
                                        onClick={copyCode}
                                    >
                                        {copied ? <><Check className="size-4" /> Code Copied!</> : <><Copy className="size-4" /> Copy Code</>}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                    People You&apos;ve Referred
                                    <Badge variant={referrals.length > 0 ? "default" : "secondary"}>{referrals.length}</Badge>
                                </div>
                                {referrals.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-5 text-center">
                                        <Users className="size-6 text-muted-foreground/50" />
                                        <p className="text-sm text-muted-foreground">No referrals yet — share your code to start earning!</p>
                                    </div>
                                ) : (
                                    referrals.map((ref, i) => (
                                        <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                                            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-lg", ref.hasPaidBooking ? "bg-emerald-100" : "bg-muted")}>
                                                {ref.hasPaidBooking ? "✓" : "⏳"}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-foreground">{ref.firstName}</p>
                                                <p className="text-xs text-muted-foreground">{ref.maskedPhone}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="outline" className={ref.hasPaidBooking ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}>
                                                    {ref.hasPaidBooking ? "Booked ✓" : "Not booked yet"}
                                                </Badge>
                                                {ref.hasPaidBooking && <p className="mt-1 text-xs font-bold text-emerald-600">+$30 earned</p>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {promoHistory.length > 0 && (
                            <Card>
                                <CardContent className="p-4">
                                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Promo History</p>
                                    {promoHistory.slice().reverse().map((p, i) => (
                                        <div key={i} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{p.code}</p>
                                                <p className="text-xs text-muted-foreground">{p.usedAt ? formatZonedDate(new Date(p.usedAt)) : ""}</p>
                                            </div>
                                            <span className="text-base font-bold text-emerald-600">-${parseFloat(p.discount || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">How Points Work</p>
                                {[
                                    [CreditCard, "Pay for a clean", "Earn 1 point per $1 spent"],
                                    [Users, "Refer a friend", "Get $30 when they pay for their first clean"],
                                    [Gift, "Use promos", "Apply codes at booking to save instantly"],
                                ].map(([Icon, title, desc]) => (
                                    <div key={title} className="flex gap-3 border-b border-border/60 py-2.5 last:border-0">
                                        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{title}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
