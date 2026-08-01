"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Camera, Gift, MessageCircle, LogOut, BadgeCheck } from "lucide-react";

function formatPhoneDisplay(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return raw || "";
}

const PROVINCES = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "PE", "NL", "NT", "YT", "NU"];

function Field({ label, editing, value, empty, children }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
            {editing ? children : value ? (
                <p className="border-b border-border py-2 text-sm text-foreground">{value}</p>
            ) : (
                <p className="border-b border-border py-2 text-sm italic text-muted-foreground">{empty || "Not set — tap Edit to add"}</p>
            )}
        </div>
    );
}

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
            <div className="bg-gradient-to-br from-primary to-primary/80 px-5 pt-13 pb-7 text-primary-foreground">
                <div className="relative mb-3 size-18">
                    <Avatar className="size-18 ring-2 ring-white/40">
                        {profile?.photoURL && <AvatarImage src={profile.photoURL} alt="Profile" />}
                        <AvatarFallback className="bg-white/20 text-2xl font-bold text-primary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={photoUploading}
                        title="Change photo"
                        className="absolute bottom-0 right-0 flex size-6.5 items-center justify-center rounded-full bg-white text-primary shadow"
                    >
                        {photoUploading ? <span className="text-[10px]">…</span> : <Camera className="size-3.5" />}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>
                <div className="text-xl font-extrabold">{profile?.name || "My Account"}</div>
                <div className="mt-0.5 text-sm opacity-85">{formatPhoneDisplay(profile?.phone)}</div>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : (
                    <>
                        {msg && <p className="text-center text-sm font-semibold text-emerald-600">{msg}</p>}
                        {err && <p className="text-center text-sm text-destructive">{err}</p>}

                        <Card>
                            <CardContent className="flex flex-col gap-4 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Personal Info</p>
                                    {!editing ? (
                                        <Button size="sm" variant="outline" onClick={() => { setEditing(true); setMsg(""); setErr(""); }}>Edit</Button>
                                    ) : (
                                        <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                                    )}
                                </div>

                                <Field label="Full Name" editing={editing} value={profile?.name}>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" />
                                </Field>

                                <Field label="Email" editing={editing} value={profile?.email}>
                                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For receipts and updates" />
                                </Field>

                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Phone Number</Label>
                                    <p className="flex items-center gap-1.5 border-b border-border py-2 text-sm text-muted-foreground">
                                        {formatPhoneDisplay(profile?.phone)}
                                        <span className="flex items-center gap-0.5 text-xs text-emerald-600"><BadgeCheck className="size-3" /> verified</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="flex flex-col gap-4 p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Default Address</p>

                                <Field label="Street Address" editing={editing} value={profile?.address}>
                                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
                                </Field>

                                <Field label="City" editing={editing} value={profile?.city}>
                                    <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ottawa" />
                                </Field>

                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Field label="Province" editing={editing} value={profile?.province || "ON"}>
                                            <Select value={province} onValueChange={setProvince}>
                                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </Field>
                                    </div>
                                    <div className="flex-1">
                                        <Field label="Postal Code" editing={editing} value={profile?.postalCode} empty="—">
                                            <Input value={postalCode} onChange={e => setPostalCode(e.target.value.toUpperCase())} placeholder="K1A 0A6" maxLength={7} />
                                        </Field>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {editing && (
                            <Button size="lg" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                        )}

                        <Card>
                            <CardContent className="p-4">
                                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Account Stats</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg bg-muted/50 p-3.5 text-center">
                                        <p className="text-2xl font-black text-primary">{profile?.rewardPoints || 0}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Reward Points</p>
                                    </div>
                                    <div className="rounded-lg bg-muted/50 p-3.5 text-center">
                                        <p className="text-2xl font-black text-emerald-600">{(profile?.bookingRefs || []).length}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Total Bookings</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Button variant="outline" size="lg" className="border-emerald-400 text-emerald-700 hover:bg-emerald-50" onClick={() => router.push("/customer/rewards")}>
                            <Gift className="size-4" /> Rewards &amp; Referrals
                        </Button>

                        <Button size="lg" onClick={() => router.push("/customer/chat")}>
                            <MessageCircle className="size-4" /> Chat &amp; Support
                        </Button>

                        <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" onClick={logout} disabled={logoutLoading}>
                            <LogOut className="size-4" /> {logoutLoading ? "Signing out…" : "Sign Out"}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
