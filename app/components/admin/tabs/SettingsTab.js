"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, ChevronRight, X, LayoutGrid, ShoppingBag, DollarSign, Shield } from "lucide-react";

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
    canViewAdministration,
    setActiveTab,
}) {
    const [localSources, setLocalSources] = useState(leadSources || []);
    const [newSource, setNewSource] = useState("");

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
        </div>
    );
}
