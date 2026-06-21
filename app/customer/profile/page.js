"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

export default function CustomerProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [logoutLoading, setLogoutLoading] = useState(false);

    useEffect(() => {
        fetch("/api/customer/profile")
            .then(r => r.json())
            .then(d => {
                const p = d.profile || {};
                setProfile(p);
                setForm({ name: p.name || "", email: p.email || "", address: p.address || "", city: p.city || "", province: p.province || "ON", postalCode: p.postalCode || "" });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    async function saveProfile() {
        setSaving(true); setMsg(""); setErr("");
        try {
            const res = await fetch("/api/customer/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Save failed.");
            setProfile(prev => ({ ...prev, ...form }));
            setEditing(false);
            setMsg("Profile saved.");
        } catch (e) { setErr(e.message); }
        finally { setSaving(false); }
    }

    async function logout() {
        setLogoutLoading(true);
        try {
            await fetch("/api/customer/logout", { method: "POST" });
        } finally {
            router.push("/customer");
        }
    }

    const field = (key, label, type = "text", opts = {}) => (
        <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</label>
            {editing ? (
                opts.select ? (
                    <select
                        value={form[key] || ""}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    >
                        {opts.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : (
                    <input
                        type={type}
                        value={form[key] || ""}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                    />
                )
            ) : (
                <div style={{ fontSize: 15, color: profile?.[key] ? "#0f172a" : "#94a3b8", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                    {profile?.[key] || `No ${label.toLowerCase()} set`}
                </div>
            )}
        </div>
    );

    return (
        <div>
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 28px", color: "#fff" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 12 }}>
                    {(profile?.name || "?")[0]?.toUpperCase()}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{profile?.name || "My Account"}</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{profile?.phone}</div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>Loading…</div>
                ) : (
                    <>
                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Personal Info</div>
                                {!editing ? (
                                    <button onClick={() => setEditing(true)} style={{ background: "none", border: `1.5px solid ${ACTION}`, color: ACTION, borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                                ) : (
                                    <button onClick={() => { setEditing(false); setMsg(""); setErr(""); }} style={{ background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                                )}
                            </div>

                            {field("name", "Full Name")}
                            {field("email", "Email", "email")}

                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Phone</label>
                                <div style={{ fontSize: 15, color: "#94a3b8", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>{profile?.phone} (cannot change)</div>
                            </div>
                        </div>

                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Default Address</div>
                            {field("address", "Street Address")}
                            {field("city", "City")}
                            {field("province", "Province", "text", { select: true, options: ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL", "NT", "YT", "NU"] })}
                            {field("postalCode", "Postal Code")}
                        </div>

                        {msg && <div style={{ color: GREEN, fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 12 }}>{msg}</div>}
                        {err && <div style={{ color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{err}</div>}

                        {editing && (
                            <button
                                onClick={saveProfile}
                                disabled={saving}
                                style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 14, opacity: saving ? 0.7 : 1 }}
                            >
                                {saving ? "Saving…" : "Save Changes"}
                            </button>
                        )}

                        {/* Stats */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Account Stats</div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1, background: "#f8fafc", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                                    <div style={{ fontSize: 26, fontWeight: 900, color: ACTION }}>{profile?.rewardPoints || 0}</div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Reward Points</div>
                                </div>
                                <div style={{ flex: 1, background: "#f8fafc", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                                    <div style={{ fontSize: 26, fontWeight: 900, color: GREEN }}>{(profile?.bookingRefs || []).length}</div>
                                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Total Bookings</div>
                                </div>
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={logout}
                            disabled={logoutLoading}
                            style={{ width: "100%", background: "#f1f5f9", color: "#dc2626", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}
                        >
                            {logoutLoading ? "Signing out…" : "Sign Out"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
