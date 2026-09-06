"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, ChevronRight, X, LayoutGrid, ShoppingBag, DollarSign, Shield, CalendarOff, Trash2, Mail } from "lucide-react";

function formatBlockedDateLabel(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const CONFIG_ICONS = { Departments: LayoutGrid, Catalog: ShoppingBag, Cash: DollarSign, Shield };

export default function SettingsTab({
    currentUser,
    profileName,
    setProfileName,
    profileLoading,
    profilePhotoUploading,
    profilePhotoStatus,
    handleProfileUpdate,
    handleProfilePhotoCapture,
    canManagePermissions,
    roleLabel,
    handleSignout,
    securityForm,
    setSecurityForm,
    securityLoading,
    handlePasswordChange,
    getInitials,
    leadSources,
    handleSaveLeadSources,
    arrivalWindowMinutes,
    handleSaveArrivalWindow,
    activeBranch,
    blockedDates,
    blockedDatesSaving,
    handleAddBlockedDate,
    handleRemoveBlockedDate,
    canManageBlockedDates,
    canViewAdministration,
    setActiveTab,
    getAuthHeaders,
}) {
    const [localSources, setLocalSources] = useState(leadSources || []);
    const [newSource, setNewSource] = useState("");
    const [localArrivalWindow, setLocalArrivalWindow] = useState(arrivalWindowMinutes || 120);
    const [newBlockedDate, setNewBlockedDate] = useState("");
    const [newBlockedReason, setNewBlockedReason] = useState("");
    const [gmailStatus, setGmailStatus] = useState(null);
    const [gmailConnecting, setGmailConnecting] = useState(false);
    const [gmailFeedback, setGmailFeedback] = useState(null);

    // Only relevant to whoever can actually connect this (super-admin, same
    // tier the server-side /api/google-gmail/connect route requires).
    useEffect(() => {
        if (!canManagePermissions || !getAuthHeaders) return;
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch("/api/google-gmail/status", { headers });
                const data = await res.json();
                if (res.ok) setGmailStatus(data);
            } catch { /* status is a nice-to-have, ignore failures */ }
        })();

        // Google redirects back here with ?gmailConnect=success|error after
        // the OAuth consent screen — surface that once, then clean the URL.
        const params = new URLSearchParams(window.location.search);
        const result = params.get("gmailConnect");
        if (result) {
            setGmailFeedback(result === "success"
                ? { ok: true, message: "Gmail connected — Google leads will now sync automatically." }
                : { ok: false, message: `Gmail connection failed (${params.get("reason") || "unknown error"}).` });
            params.delete("gmailConnect");
            params.delete("reason");
            const query = params.toString();
            window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        }
    }, [canManagePermissions, getAuthHeaders]);

    const handleConnectGmail = async () => {
        setGmailConnecting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/google-gmail/connect", { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not start Gmail connection.");
            window.location.href = data.url;
        } catch (err) {
            setGmailFeedback({ ok: false, message: err.message });
            setGmailConnecting(false);
        }
    };

    const addSource = () => {
        const trimmed = newSource.trim();
        if (!trimmed || localSources.includes(trimmed)) return;
        setLocalSources(prev => [...prev, trimmed]);
        setNewSource("");
    };

    const removeSource = (src) => setLocalSources(prev => prev.filter(s => s !== src));

    const saveLeadSources = () => handleSaveLeadSources?.(localSources);

    const configItems = [
        { tab: "departments", label: "Departments", desc: "Org structure, department access, HR modules.", icon: "Departments", show: canViewAdministration },
        { tab: "catalog", label: "Catalog Studio", desc: "Services, sizes, add-ons, and pricing tiers.", icon: "Catalog", show: canViewAdministration },
        { tab: "promotions", label: "Promotions Manager", desc: "Promo codes, referral rules, document copy.", icon: "Cash", show: canViewAdministration },
        { tab: "permissions", label: "Permissions & Roles", desc: "Role definitions and department access.", icon: "Shield", show: canManagePermissions },
    ].filter(item => item.show);

    return (
        <div className="animate-fade flex flex-col gap-4">
            {configItems.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Configuration</CardTitle>
                        <p className="text-xs text-muted-foreground">Administration and setup tools, grouped out of the way of day-to-day work.</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {configItems.map(item => {
                            const Icon = CONFIG_ICONS[item.icon];
                            return (
                                <button
                                    key={item.tab}
                                    type="button"
                                    onClick={() => setActiveTab(item.tab)}
                                    className="flex items-center gap-3 rounded-lg border border-border p-3.5 text-left transition-colors hover:bg-muted/50"
                                >
                                    {Icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="size-4" /></div>}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                                        <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                                </button>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle className="text-sm">User Profile Specifications</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileUpdate} className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="size-14">
                                {currentUser.photoURL && <AvatarImage src={currentUser.photoURL} alt={currentUser.name} />}
                                <AvatarFallback className="text-base font-bold">{getInitials(currentUser.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-bold text-foreground">{currentUser.name}</p>
                                <p className="text-xs text-muted-foreground">{roleLabel}</p>
                            </div>
                        </div>
                        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-input px-4 py-3 text-center text-sm font-semibold text-muted-foreground hover:bg-muted">
                            <input
                                type="file"
                                accept="image/*"
                                capture="user"
                                className="hidden"
                                onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                disabled={profilePhotoUploading}
                            />
                            {profilePhotoUploading ? "Uploading Photo…" : "Take Or Upload Profile Photo"}
                        </label>
                        {profilePhotoStatus && <p className="text-sm text-primary">{profilePhotoStatus}</p>}
                        <div className="flex flex-col gap-1.5">
                            <Label>Display Name</Label>
                            <Input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} required />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Email Address (Read-only)</Label>
                            <Input type="email" value={currentUser.email} disabled />
                        </div>
                        {!canManagePermissions && (
                            <div className="flex flex-col gap-1.5">
                                <Label>Assigned Cleaning Crew</Label>
                                <Input type="text" value={currentUser.teamId || "None"} disabled />
                            </div>
                        )}
                        <Button type="submit" disabled={profileLoading}>
                            {profileLoading ? "Updating Profile…" : "Save Profile Details"}
                        </Button>
                        <div className="mt-1 border-t border-border pt-4">
                            <Button type="button" variant="destructive" className="w-full" onClick={handleSignout}>
                                <LogOut className="size-3.5" /> Log Out of Account
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-sm">Security &amp; Password Management</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Current Password</Label>
                            <Input
                                type="password"
                                value={securityForm.currentPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>New Password</Label>
                            <Input
                                type="password"
                                value={securityForm.newPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                required
                                placeholder="Min 6 characters"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Confirm New Password</Label>
                            <Input
                                type="password"
                                value={securityForm.confirmPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <Button type="submit" variant="destructive" disabled={securityLoading}>
                            {securityLoading ? "Updating Password…" : "Change Security Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {canManagePermissions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Lead Sources</CardTitle>
                        <p className="text-xs text-muted-foreground">Manage the lead source options available when creating or editing bookings.</p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-2">
                            {localSources.map(src => (
                                <Badge key={src} variant="secondary" className="gap-1.5 pr-1.5">
                                    {src}
                                    <button type="button" onClick={() => removeSource(src)} className="text-muted-foreground hover:text-foreground">
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                value={newSource}
                                onChange={e => setNewSource(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addSource()}
                                placeholder="e.g. Google, bark.com, Instagram…"
                                className="flex-1"
                            />
                            <Button variant="secondary" onClick={addSource}>Add</Button>
                        </div>
                        <Button className="w-fit" onClick={saveLeadSources}>Save Lead Sources</Button>
                    </CardContent>
                </Card>
            )}

            {canManagePermissions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Arrival Windows</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Customers see a time range instead of an exact time in booking confirmations and receipts — e.g. a 2-hour window on a 9:00 AM job shows as &ldquo;between 9:00 AM and 11:00 AM&rdquo;.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Default Window Length (minutes)</Label>
                            <Input
                                type="number" min={0} step={15}
                                value={localArrivalWindow}
                                onChange={e => setLocalArrivalWindow(Math.max(0, Number(e.target.value) || 0))}
                                className="max-w-40"
                            />
                        </div>
                        <Button className="w-fit" onClick={() => handleSaveArrivalWindow?.(localArrivalWindow)}>Save Arrival Window</Button>
                    </CardContent>
                </Card>
            )}

            {canManageBlockedDates && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm"><CalendarOff className="size-4" /> Blocked Dates</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Holidays or closures — no new booking or reschedule can land on a blocked date. Scoped to <strong>{activeBranch?.name || "this branch"}</strong> only; other branches keep their own schedule. Switch branches with the selector up top to manage a different one.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {blockedDates?.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {blockedDates.map(entry => (
                                    <div key={entry.date} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-foreground">{formatBlockedDateLabel(entry.date)}</p>
                                            <p className="truncate text-xs text-muted-foreground">{entry.reason}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            disabled={blockedDatesSaving}
                                            onClick={() => handleRemoveBlockedDate?.(entry.date)}
                                            title="Unblock this date"
                                        >
                                            <Trash2 className="size-3.5 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No blocked dates for {activeBranch?.name || "this branch"} yet.</p>
                        )}
                        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Label>Date</Label>
                                <Input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} />
                            </div>
                            <div className="flex flex-[1.5] flex-col gap-1.5">
                                <Label>Reason</Label>
                                <Input
                                    type="text"
                                    value={newBlockedReason}
                                    onChange={e => setNewBlockedReason(e.target.value)}
                                    placeholder="e.g. Christmas Day, Staff Training…"
                                />
                            </div>
                            <Button
                                type="button"
                                disabled={blockedDatesSaving || !newBlockedDate}
                                onClick={() => {
                                    handleAddBlockedDate?.(newBlockedDate, newBlockedReason);
                                    setNewBlockedDate("");
                                    setNewBlockedReason("");
                                }}
                            >
                                {blockedDatesSaving ? "Saving…" : "Block Date"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {canManagePermissions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-1.5 text-sm"><Mail className="size-4" /> Google Leads (Gmail Sync)</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Connects the Gmail inbox that receives your Local Services Ads lead notifications. Once connected, new leads sync into Bookings as <strong>Lead Source: Google</strong> automatically — live, the moment they arrive — with an alert texted to the office number and a reply box that sends back through the same Google conversation thread.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {gmailFeedback && (
                            <p className={`text-sm ${gmailFeedback.ok ? "text-green-600" : "text-destructive"}`}>
                                {gmailFeedback.ok ? "✓" : "⚠️"} {gmailFeedback.message}
                            </p>
                        )}
                        {gmailStatus?.connected ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                                <div>
                                    <p className="text-sm font-bold text-foreground">✓ Connected</p>
                                    <p className="text-xs text-muted-foreground">
                                        {gmailStatus.connectedAt ? `Since ${new Date(gmailStatus.connectedAt).toLocaleDateString()}` : ""}
                                    </p>
                                </div>
                                <Button type="button" variant="secondary" size="sm" disabled={gmailConnecting} onClick={handleConnectGmail}>
                                    Reconnect
                                </Button>
                            </div>
                        ) : (
                            <Button type="button" className="w-fit" disabled={gmailConnecting} onClick={handleConnectGmail}>
                                {gmailConnecting ? "Redirecting to Google…" : "Connect Gmail"}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
