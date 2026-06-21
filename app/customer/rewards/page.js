"use client";
import { useEffect, useState } from "react";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

function ShareButton({ label, color, onClick, icon }) {
    return (
        <button onClick={onClick} style={{ flex: 1, background: color, color: "#fff", border: "none", borderRadius: 14, padding: "13px 8px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
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
            <div style={{ background: `linear-gradient(135deg,${GREEN} 0%,#5f8730 100%)`, padding: "52px 20px 28px", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Rewards</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Earn points, refer friends, save more</div>
            </div>

            <div style={{ padding: "16px 16px 0" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>Loading…</div>
                ) : (
                    <>
                        {/* Points balance */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14, textAlign: "center" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Your Balance</div>
                            <div style={{ fontSize: 56, fontWeight: 900, color: GREEN, lineHeight: 1 }}>{points}</div>
                            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>reward points</div>
                            <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 12, padding: "12px 16px" }}>
                                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
                                    Earn <strong>1 point per $1</strong> spent on every clean. Points can be redeemed for discounts on future bookings.
                                </div>
                            </div>
                        </div>

                        {/* Referral section */}
                        {referralCode && (
                            <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Refer a Friend</div>
                                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
                                    Share your code and you both get <strong>$30 off</strong> — you earn when your friend completes their first paid clean.
                                </div>

                                <div style={{ background: "#f0f9ff", border: "2px dashed #bae6fd", borderRadius: 14, padding: "14px 16px", textAlign: "center", marginBottom: 16 }}>
                                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>YOUR CODE</div>
                                    <div style={{ fontSize: 26, fontWeight: 900, color: BRAND, letterSpacing: "0.08em" }}>{referralCode}</div>
                                </div>

                                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                                    <ShareButton label="WhatsApp" color="#25D366" icon="💬" onClick={shareWhatsApp} />
                                    <ShareButton label="SMS" color="#007AFF" icon="📱" onClick={shareSMS} />
                                    <ShareButton label="Share" color={ACTION} icon="🔗" onClick={shareNative} />
                                </div>
                                <button onClick={copyCode} style={{ width: "100%", background: copied ? GREEN : "#f1f5f9", color: copied ? "#fff" : "#475569", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                                    {copied ? "✓ Code Copied!" : "Copy Code"}
                                </button>
                            </div>
                        )}

                        {/* Referrals list */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                                People You&apos;ve Referred
                                <span style={{ marginLeft: 8, background: referrals.length > 0 ? GREEN : "#e2e8f0", color: referrals.length > 0 ? "#fff" : "#94a3b8", borderRadius: 8, padding: "2px 8px", fontSize: 10 }}>
                                    {referrals.length}
                                </span>
                            </div>
                            {referrals.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "20px 0" }}>
                                    <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
                                    <div style={{ fontSize: 13, color: "#64748b" }}>No referrals yet — share your code to start earning!</div>
                                </div>
                            ) : (
                                referrals.map((ref, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < referrals.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: ref.hasPaidBooking ? GREEN + "20" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                                            {ref.hasPaidBooking ? "✓" : "⏳"}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{ref.firstName}</div>
                                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{ref.maskedPhone}</div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: ref.hasPaidBooking ? GREEN : "#f59e0b", background: ref.hasPaidBooking ? GREEN + "15" : "#fef3c7", borderRadius: 8, padding: "3px 9px" }}>
                                                {ref.hasPaidBooking ? "Booked ✓" : "Not booked yet"}
                                            </div>
                                            {ref.hasPaidBooking && (
                                                <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginTop: 3 }}>+$30 earned</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Promo history */}
                        {promoHistory.length > 0 && (
                            <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Promo History</div>
                                {promoHistory.slice().reverse().map((p, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < promoHistory.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{p.code}</div>
                                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.usedAt ? new Date(p.usedAt).toLocaleDateString() : ""}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: GREEN, fontSize: 15 }}>-${parseFloat(p.discount || 0).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* How it works */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>How Points Work</div>
                            {[
                                ["💳", "Pay for a clean", "Earn 1 point per $1 spent"],
                                ["👥", "Refer a friend", "Get $30 when they pay for their first clean"],
                                ["🎁", "Use promos", "Apply codes at booking to save instantly"],
                            ].map(([icon, title, desc]) => (
                                <div key={title} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
                                    <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{title}</div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
