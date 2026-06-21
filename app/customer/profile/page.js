"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const BRAND = "#005691";
const ACTION = "#0A6CB8";
const GREEN = "#78A53E";

function formatPhoneDisplay(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return raw || "";
}

const PROVINCES = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL", "NT", "YT", "NU"];

const inputStyle = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 };
const valueStyle = { fontSize: 15, color: "#0f172a", padding: "12px 0", borderBottom: "1px solid #f1f5f9" };
const emptyStyle = { fontSize: 15, color: "#94a3b8", padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontStyle: "italic" };

export default function CustomerProfilePage() {
    const router = useRouter();
    const fileRef = useRef(null);

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [province, setProvince] = useState("ON");
    const [postalCode, setPostalCode] = useState("");
    const [saving, setSaving] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [logoutLoading, setLogoutLoading] = useState(false);

    useEffect(() => {
        fetch("/api/customer/profile")
            .then(r => r.json())
            .then(d => {
                const p = d.profile || {};
                setProfile(p);
                setName(p.name || "");
                setEmail(p.email || "");
                setAddress(p.address || "");
                setCity(p.city || "");
                setProvince(p.province || "ON");
                setPostalCode(p.postalCode || "");
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const cancelEdit = useCallback(() => {
        setEditing(false); setMsg(""); setErr("");
        if (profile) {
            setName(profile.name || "");
            setEmail(profile.email || "");
            setAddress(profile.address || "");
            setCity(profile.city || "");
            setProvince(profile.province || "ON");
            setPostalCode(profile.postalCode || "");
        }
    }, [profile]);

    async function handlePhotoChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoUploading(true); setErr("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/customer/upload-photo", { method: "POST", body: fd });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Upload failed.");
            setProfile(prev => ({ ...prev, photoURL: data.photoURL }));
            setMsg("Photo updated.");
        } catch (e) { setErr(e.message); }
        finally { setPhotoUploading(false); }
    }

    async function saveProfile() {
        setSaving(true); setMsg(""); setErr("");
        try {
            const updates = { name, email, address, city, province, postalCode };
            const res = await fetch("/api/customer/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Save failed.");
            setProfile(prev => ({ ...prev, ...updates }));
            setEditing(false);
            setMsg("Profile saved.");
        } catch (e) { setErr(e.message); }
        finally { setSaving(false); }
    }

    async function logout() {
        setLogoutLoading(true);
        try { await fetch("/api/customer/logout", { method: "POST" }); } finally {
            router.push("/customer");
        }
    }

    const initials = (profile?.name || "?")[0]?.toUpperCase();

    return (
        <div>
            {/* Header with editable photo */}
            <div style={{ background: `linear-gradient(135deg,${BRAND},${ACTION})`, padding: "52px 20px 28px", color: "#fff" }}>
                <div style={{ position: "relative", width: 72, height: 72, marginBottom: 12 }}>
                    {profile?.photoURL ? (
                        <img src={profile.photoURL} alt="Profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.4)" }} />
                    ) : (
                        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, border: "3px solid rgba(255,255,255,0.35)" }}>
                            {initials}
                        </div>
                    )}
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={photoUploading}
                        title="Change photo"
                        style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                    >
                        {photoUploading ? (
                            <span style={{ fontSize: 10, color: ACTION }}>…</span>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACTION} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                            </svg>
                        )}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{profile?.name || "My Account"}</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{formatPhoneDisplay(profile?.phone)}</div>
            </div>

            <div style={{ padding: "20px 16px 0" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>Loading…</div>
                ) : (
                    <>
                        {msg && <div style={{ color: GREEN, fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 12 }}>{msg}</div>}
                        {err && <div style={{ color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{err}</div>}

                        {/* Personal Info */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Personal Info</div>
                                {!editing ? (
                                    <button onClick={() => { setEditing(true); setMsg(""); setErr(""); }} style={{ background: "none", border: `1.5px solid ${ACTION}`, color: ACTION, borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit</button>
                                ) : (
                                    <button onClick={cancelEdit} style={{ background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: 10, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                                )}
                            </div>

                            {/* Full Name */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Full Name</label>
                                {editing
                                    ? <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" style={inputStyle} />
                                    : profile?.name ? <div style={valueStyle}>{profile.name}</div> : <div style={emptyStyle}>Not set — tap Edit to add</div>
                                }
                            </div>

                            {/* Email */}
                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Email</label>
                                {editing
                                    ? <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For receipts and updates" style={inputStyle} />
                                    : profile?.email ? <div style={valueStyle}>{profile.email}</div> : <div style={emptyStyle}>Not set — tap Edit to add</div>
                                }
                            </div>

                            {/* Phone — always locked */}
                            <div style={{ marginBottom: 4 }}>
                                <label style={labelStyle}>Phone Number</label>
                                <div style={{ ...valueStyle, color: "#64748b" }}>
                                    {formatPhoneDisplay(profile?.phone)}
                                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>• verified</span>
                                </div>
                            </div>
                        </div>

                        {/* Default Address */}
                        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Default Address</div>

                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Street Address</label>
                                {editing
                                    ? <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" style={inputStyle} />
                                    : profile?.address ? <div style={valueStyle}>{profile.address}</div> : <div style={emptyStyle}>Not set — tap Edit to add</div>
                                }
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>City</label>
                                {editing
                                    ? <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ottawa" style={inputStyle} />
                                    : profile?.city ? <div style={valueStyle}>{profile.city}</div> : <div style={emptyStyle}>Not set — tap Edit to add</div>
                                }
                            </div>

                            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Province</label>
                                    {editing
                                        ? <select value={province} onChange={e => setProvince(e.target.value)} style={inputStyle}>{PROVINCES.map(p => <option key={p}>{p}</option>)}</select>
                                        : <div style={valueStyle}>{profile?.province || "ON"}</div>
                                    }
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Postal Code</label>
                                    {editing
                                        ? <input value={postalCode} onChange={e => setPostalCode(e.target.value.toUpperCase())} placeholder="K1A 0A6" maxLength={7} style={inputStyle} />
                                        : profile?.postalCode ? <div style={valueStyle}>{profile.postalCode}</div> : <div style={emptyStyle}>—</div>
                                    }
                                </div>
                            </div>
                        </div>

                        {editing && (
                            <button onClick={saveProfile} disabled={saving} style={{ width: "100%", background: ACTION, color: "#fff", border: "none", borderRadius: 14, padding: "15px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 14, opacity: saving ? 0.7 : 1 }}>
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

                        <button onClick={logout} disabled={logoutLoading} style={{ width: "100%", background: "#f1f5f9", color: "#dc2626", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                            {logoutLoading ? "Signing out…" : "Sign Out"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
