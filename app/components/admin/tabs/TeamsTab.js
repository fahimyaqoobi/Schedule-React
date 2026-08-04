"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import {
    AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Camera, Search, UserX, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_FILTER_OPTIONS = [
    { value: "all", label: "All Roles" },
    { value: "cleaner", label: "Cleaner" },
    { value: "supervisor", label: "Supervisor" },
    { value: "employee", label: "Employee" },
    { value: "subcontractor", label: "Subcontractor" },
];

function isEmploymentActive(member) {
    return (member.employmentStatus || "Active") === "Active";
}

const EMPLOYMENT_STATUS_OPTIONS = [
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Suspended", label: "Suspended" },
    { value: "On Leave", label: "On Leave" },
];

// Employment-status controls shown on a staff profile: a quick Active/
// Inactive switch for day-to-day availability, a granular status select for
// Suspended/On Leave nuance, and a destructive Retire/Terminate action
// (confirmed via AlertDialog) that also revokes login — separate from a
// simple Inactive toggle since it's a harder-to-reverse step. Reused by
// both the mobile and desktop profile layouts so the two never drift.
function EmploymentActions({ member, canManagePeopleProfiles, staffProfileSaving, handleUpdateEmploymentStatus }) {
    if (!canManagePeopleProfiles) return null;
    const active = isEmploymentActive(member);
    const disabled = member.status === "disabled";

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Quick Toggle</span>
                    <label className="flex items-center gap-2">
                        <Switch
                            checked={active}
                            disabled={staffProfileSaving}
                            onCheckedChange={checked => handleUpdateEmploymentStatus(member.uid, checked ? "Active" : "Inactive")}
                        />
                        <span className="text-xs font-semibold">{active ? "Active" : "Inactive"}</span>
                    </label>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Status Detail</span>
                    <select
                        value={member.employmentStatus || "Active"}
                        onChange={e => handleUpdateEmploymentStatus(member.uid, e.target.value)}
                        disabled={staffProfileSaving}
                        className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    >
                        {EMPLOYMENT_STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="border-t border-border pt-3">
                    {disabled ? (
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-destructive">Retired — login revoked</p>
                                <p className="text-[11px] text-muted-foreground">Historical jobs and payroll remain intact.</p>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={staffProfileSaving}
                                onClick={() => handleUpdateEmploymentStatus(member.uid, "Active", "approved")}
                            >
                                <UserCheck className="size-3.5" /> Reactivate
                            </Button>
                        </div>
                    ) : (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={staffProfileSaving} className="w-full">
                                    <UserX className="size-3.5" /> Retire / Terminate Employee
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Retire {member.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This sets their employment status to Inactive and revokes their login access immediately. They will disappear from the Calendar and job assignment. Historical jobs, time cards, and payroll records stay intact and this can be reversed later.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-destructive text-white hover:bg-destructive/90"
                                        onClick={() => handleUpdateEmploymentStatus(member.uid, "Inactive", "disabled")}
                                    >
                                        Retire Employee
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function TeamsTab({
    isViewingOwnCleanerProfile,
    peopleRoster,
    bookings,
    selectedStaffMember,
    activeStaffProfileDraft,
    selectedStaffCompletedJobs,
    staffProfileFeedback,
    staffProfileRejectReason,
    staffProfileMobileTab,
    staffProfileEditOpen,
    staffDocumentUploading,
    staffProfileSaving,
    profilePhotoUploading,
    blockedDateInput,
    staffAddressSuggestions,
    showStaffAddressSuggestions,
    staffAutocompleteRef,
    selectedStaffIdentityCards,
    selectedStaffEmploymentCards,
    selectedStaffAvailability,
    selectedStaffBlockedDates,
    canEditSelectedStaffProfile,
    canAdminDirectEditSelectedStaffProfile,
    canManagePeopleProfiles,
    Icons,
    getInitials,
    getRoleLabel,
    normalizeStaffProfile,
    setSelectedStaffUid,
    setStaffProfileDraftOwnerUid,
    setStaffProfileDraft,
    setStaffProfileFeedback,
    setStaffProfileRejectReason,
    setStaffProfileEditOpen,
    setStaffProfileMobileTab,
    setBlockedDateInput,
    updateStaffDraftField,
    handleStaffAddressChange,
    selectStaffAddressSuggestion,
    handleProfilePhotoCapture,
    handleReviewStaffProfileRequest,
    handleSaveStaffProfileDirect,
    handleSubmitStaffProfile,
    handleStaffDocumentUpload,
    updateAvailabilityDayShift,
    addBlockedDateToDraft,
    removeBlockedDateFromDraft,
    handleUpdateEmploymentStatus,
}) {
    const approvedEmployees = peopleRoster.filter(member => member.status === "approved");

    const [rosterSearch, setRosterSearch] = useState("");
    const [rosterRoleFilter, setRosterRoleFilter] = useState("all");
    const [showInactiveStaff, setShowInactiveStaff] = useState(false);

    const filteredEmployees = useMemo(() => {
        const query = rosterSearch.trim().toLowerCase();
        return approvedEmployees.filter(member => {
            if (!showInactiveStaff && !isEmploymentActive(member)) return false;
            if (rosterRoleFilter !== "all" && member.role !== rosterRoleFilter) return false;
            if (query && !(member.name || member.email || "").toLowerCase().includes(query)) return false;
            return true;
        });
    }, [approvedEmployees, rosterSearch, rosterRoleFilter, showInactiveStaff]);

    const inactiveCount = approvedEmployees.filter(member => !isEmploymentActive(member)).length;

    const renderRosterCard = (member) => {
        const assignedJobs = bookings.filter(b => b.assignedStaffIds?.includes(member.uid) && b.status !== "Cancelled");
        const completedCount = assignedJobs.filter(b => b.status === "Completed").length;
        const initials = getInitials(member.name || member.email || "FS");
        const requestPending = member.staffProfileRequest?.requestedProfile;
        const active = isEmploymentActive(member);
        const isSelected = selectedStaffMember?.uid === member.uid;

        return (
            <Card
                key={member.uid}
                className={cn(
                    "cursor-pointer gap-3 py-3 transition hover:border-primary/40",
                    isSelected && "border-primary shadow-md",
                    !active && "opacity-70"
                )}
                onClick={() => {
                    setSelectedStaffUid(member.uid);
                    setStaffProfileDraftOwnerUid(member.uid);
                    setStaffProfileDraft(normalizeStaffProfile(member.staffProfile));
                    setStaffProfileFeedback("");
                    setStaffProfileRejectReason("");
                    setStaffProfileEditOpen(false);
                }}
            >
                <CardContent className="flex flex-col items-center gap-2 px-3 text-center">
                    <div className="relative">
                        <Avatar className={cn("size-14 ring-2", isSelected ? "ring-primary" : "ring-border")}>
                            {member.photoURL && <AvatarImage src={member.photoURL} alt={member.name || member.email} />}
                            <AvatarFallback className="font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <span className={cn("absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background", active ? "bg-emerald-500" : "bg-slate-400")} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="line-clamp-2 text-xs font-bold text-foreground">{member.name}</h4>
                        <span className="text-[10px] text-muted-foreground">{getRoleLabel(member.role)}</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1">
                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">J{assignedJobs.length}</Badge>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">C{completedCount}</Badge>
                        {requestPending && <Badge className="bg-amber-100 px-1.5 py-0 text-[9px] text-amber-700 hover:bg-amber-100">Review</Badge>}
                        {!active && <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">{member.employmentStatus}</Badge>}
                    </div>
                    {canManagePeopleProfiles && (
                        <label
                            className="flex items-center gap-1.5 pt-1 text-[10px] font-semibold text-muted-foreground"
                            onClick={e => e.stopPropagation()}
                        >
                            <Switch
                                checked={active}
                                disabled={staffProfileSaving}
                                onCheckedChange={checked => handleUpdateEmploymentStatus(member.uid, checked ? "Active" : "Inactive")}
                            />
                            {active ? "Active" : "Inactive"}
                        </label>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="animate-fade flex flex-col gap-6">
            {!isViewingOwnCleanerProfile && (
                <div className="ops-control-header">
                    <div>
                        <p className="ops-eyebrow">People Management</p>
                        <h3 className="ops-title">Field Staff Profiles</h3>
                        <p className="ops-copy">
                            Open a staff profile to review branch status, required documents, eligibility, and approval requests. Staff can submit updates from their own login for branch admin approval.
                        </p>
                    </div>
                    <span className="ops-chip">{peopleRoster.length} Visible Staff</span>
                </div>
            )}
            {peopleRoster.length === 0 ? (
                <div className="empty-state p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-md">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-slate-300"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <h4 className="font-extrabold text-slate-700 text-sm mb-1">No approved field staff yet</h4>
                    <p className="text-xs text-slate-400 max-w-[280px] mx-auto">Register and approve cleaners, supervisors, employees, or subcontractors to assign them to jobs.</p>
                </div>
            ) : (
                <div className="people-management-shell">
                    {!isViewingOwnCleanerProfile && (
                        <div className="people-roster-section flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="people-roster-section-head">
                                    <h4>Team Roster</h4>
                                    <span className="ops-chip">{filteredEmployees.length} of {approvedEmployees.length}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative w-full sm:w-56">
                                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={rosterSearch}
                                        onChange={e => setRosterSearch(e.target.value)}
                                        placeholder="Search staff..."
                                        className="h-8 pl-8 text-xs"
                                    />
                                </div>
                                <Select value={rosterRoleFilter} onValueChange={setRosterRoleFilter}>
                                    <SelectTrigger className="h-8 w-full text-xs sm:w-40">
                                        <span data-slot="select-value">
                                            {ROLE_FILTER_OPTIONS.find(o => o.value === rosterRoleFilter)?.label}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent align="start" alignItemWithTrigger={false}>
                                        {ROLE_FILTER_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <Switch checked={showInactiveStaff} onCheckedChange={setShowInactiveStaff} />
                                    Show Inactive {inactiveCount > 0 && `(${inactiveCount})`}
                                </label>
                            </div>
                            {filteredEmployees.length === 0 ? (
                                <div className="py-4 text-xs text-muted-foreground">No staff match these filters.</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                                    {filteredEmployees.map(renderRosterCard)}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedStaffMember && activeStaffProfileDraft && (
                        <section className="people-profile-canvas">
                            <section className={`people-mobile-profile-shell ${isViewingOwnCleanerProfile ? "people-mobile-profile-shell-self" : ""}`}>
                                <Card className="border-none shadow-none">
                                    <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                                        <div className="relative">
                                            <Avatar className="size-20 ring-4 ring-primary/15">
                                                {selectedStaffMember.photoURL && <AvatarImage src={selectedStaffMember.photoURL} alt={selectedStaffMember.name || selectedStaffMember.email} />}
                                                <AvatarFallback className="text-lg font-bold">{getInitials(selectedStaffMember.name || selectedStaffMember.email || "FS")}</AvatarFallback>
                                            </Avatar>
                                            <span className={cn("absolute bottom-0 right-0 size-4 rounded-full border-2 border-background", isEmploymentActive(selectedStaffMember) ? "bg-emerald-500" : "bg-slate-400")} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-extrabold text-foreground">{selectedStaffMember.name}</h3>
                                            <Badge variant={isEmploymentActive(selectedStaffMember) ? "secondary" : "destructive"} className="mt-1 gap-1">
                                                <span className={cn("size-1.5 rounded-full", isEmploymentActive(selectedStaffMember) ? "bg-emerald-500" : "bg-current")} />
                                                {selectedStaffMember.employmentStatus || "Active"}
                                                {selectedStaffMember.status === "disabled" && " · Login Revoked"}
                                            </Badge>
                                        </div>
                                        {canEditSelectedStaffProfile && (
                                            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                                <Camera className="size-3.5" />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="user"
                                                    className="hidden"
                                                    onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                                    disabled={profilePhotoUploading}
                                                />
                                                {profilePhotoUploading ? "Uploading Photo…" : "Take Live Photo"}
                                            </label>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardContent className="grid grid-cols-2 divide-x divide-border p-4 text-center">
                                        <div>
                                            <p className="text-xl font-extrabold text-primary">{selectedStaffCompletedJobs.length}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jobs Completed</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-extrabold text-primary">{activeStaffProfileDraft.employment.yearsExperience || "0"}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Years Exp.</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {staffProfileFeedback && (
                                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-center text-sm text-primary">
                                        {staffProfileFeedback}
                                    </div>
                                )}

                                {canManagePeopleProfiles && selectedStaffMember.staffProfileRequest?.requestedProfile && (
                                    <div className="people-review-panel people-mobile-review-panel">
                                        <div>
                                            <p className="ops-eyebrow">Approval Queue</p>
                                            <h4>Pending Staff Profile Request</h4>
                                            <p>
                                                Submitted by {selectedStaffMember.staffProfileRequest.submittedByName} on {selectedStaffMember.staffProfileRequest.submittedAt?.split("T")[0]}.
                                            </p>
                                        </div>
                                        <textarea
                                            placeholder="Optional rejection reason for branch admin feedback"
                                            value={staffProfileRejectReason}
                                            onChange={e => setStaffProfileRejectReason(e.target.value)}
                                        />
                                        <div className="people-review-actions">
                                            <button type="button" className="team-primary-action" onClick={() => handleReviewStaffProfileRequest("approve")} disabled={staffProfileSaving}>
                                                Approve Changes
                                            </button>
                                            <button type="button" className="team-secondary-action" onClick={() => handleReviewStaffProfileRequest("reject")} disabled={staffProfileSaving}>
                                                Reject Changes
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <Tabs value={staffProfileMobileTab} onValueChange={setStaffProfileMobileTab}>
                                    <TabsList className="w-full">
                                        <TabsTrigger value="identity">Identity</TabsTrigger>
                                        <TabsTrigger value="employment">Employment</TabsTrigger>
                                        <TabsTrigger value="availability">Availability</TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <div className="people-mobile-profile-content">
                                    {staffProfileMobileTab === "identity" && !staffProfileEditOpen && (
                                        <div className="flex flex-col gap-4">
                                            <section className="flex flex-col gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Information</p>
                                                <div className="flex flex-col gap-2">
                                                    {selectedStaffIdentityCards.map(card => (
                                                        <Card key={card.key}>
                                                            <CardContent className="flex items-center gap-3 p-3">
                                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{card.icon}</div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs text-muted-foreground">{card.label}</p>
                                                                    <p className="truncate text-sm font-semibold text-foreground">{card.value}</p>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </section>
                                            <section className="flex flex-col gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact</p>
                                                <Card>
                                                    <CardContent className="flex items-center justify-between gap-3 p-3">
                                                        <div>
                                                            <p className="text-sm font-bold text-foreground">{activeStaffProfileDraft.emergency.contactName || "Not submitted"}</p>
                                                            <p className="text-xs text-muted-foreground">{activeStaffProfileDraft.emergency.relationship || "Relationship pending"}</p>
                                                            <p className="text-xs text-muted-foreground">{activeStaffProfileDraft.emergency.phone || "Phone pending"}</p>
                                                        </div>
                                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{Icons.Contact()}</div>
                                                    </CardContent>
                                                </Card>
                                            </section>
                                        </div>
                                    )}

                                    {staffProfileMobileTab === "employment" && !staffProfileEditOpen && (
                                        <div className="flex flex-col gap-4">
                                            <section className="flex flex-col gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {selectedStaffEmploymentCards.map(card => (
                                                        <Card key={card.key}>
                                                            <CardContent className="p-3">
                                                                <p className="text-xs text-muted-foreground">{card.label}</p>
                                                                <p className="text-sm font-semibold text-foreground">{card.value}</p>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                                <EmploymentActions
                                                    member={selectedStaffMember}
                                                    canManagePeopleProfiles={canManagePeopleProfiles}
                                                    staffProfileSaving={staffProfileSaving}
                                                    handleUpdateEmploymentStatus={handleUpdateEmploymentStatus}
                                                />
                                            </section>
                                            <section className="flex flex-col gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal Notes</p>
                                                <Card>
                                                    <CardContent className="p-3 text-sm text-muted-foreground">
                                                        {activeStaffProfileDraft.employment.availabilityNotes || "Staff profile notes will appear here after branch admin approval."}
                                                    </CardContent>
                                                </Card>
                                            </section>
                                        </div>
                                    )}

                                    {staffProfileMobileTab === "availability" && !staffProfileEditOpen && (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Weekly Schedule</p>
                                                    <p className="text-xs text-muted-foreground">Live scheduling data from Firestore</p>
                                                </div>
                                                <Badge variant="secondary">Max {selectedStaffAvailability.maxJobsPerDay} Jobs/Week</Badge>
                                            </div>
                                            <Card>
                                                <CardContent className="flex flex-col gap-4 p-4">
                                                    <div className="grid grid-cols-7 gap-1 text-center">
                                                        {selectedStaffAvailability.weekdays.map((day, index) => (
                                                            <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-1">
                                                                <span className="text-[10px] font-semibold text-muted-foreground">{day.label}</span>
                                                                <div className={cn(
                                                                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                                                                    day.status !== "A" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                                                                )}>{day.status}</div>
                                                                <span className="text-[9px] text-muted-foreground">{day.shifts?.morning ? "M" : "-"}/{day.shifts?.afternoon ? "A" : "-"}/{day.shifts?.evening ? "E" : "-"}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
                                                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Morning (08:00 – 12:00)</span><span className="font-semibold text-foreground">Per day</span></div>
                                                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Afternoon (13:00 – 17:00)</span><span className="font-semibold text-foreground">Per day</span></div>
                                                        <div className="flex items-center justify-between"><span className="text-muted-foreground/60">Evening (18:00+)</span><span className="font-semibold text-muted-foreground/60">Per day</span></div>
                                                    </div>
                                                    <div>
                                                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming Blocked Dates</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedStaffBlockedDates.length > 0 ? selectedStaffBlockedDates.map(date => (
                                                                <Badge key={date} variant="outline">{date}</Badge>
                                                            )) : <span className="text-sm text-muted-foreground">No blocked dates</span>}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}

                                    {staffProfileEditOpen && (
                                        <section className="people-mobile-editor">
                                            {staffProfileMobileTab === "identity" && (
                                                <div className="people-mobile-editor-section">
                                                    <label className="span-2"><span>Legal name</span><input value={activeStaffProfileDraft.personal.legalName} onChange={e => updateStaffDraftField("personal", "legalName", e.target.value)} /></label>
                                                    <label><span>Preferred name</span><input value={activeStaffProfileDraft.personal.preferredName} onChange={e => updateStaffDraftField("personal", "preferredName", e.target.value)} /></label>
                                                    {canAdminDirectEditSelectedStaffProfile && (
                                                        <label><span>Email</span><input type="email" value={activeStaffProfileDraft.personal.email || selectedStaffMember.email || ""} onChange={e => updateStaffDraftField("personal", "email", e.target.value)} /></label>
                                                    )}
                                                    {canAdminDirectEditSelectedStaffProfile && (
                                                        <label><span>Phone</span><input value={activeStaffProfileDraft.personal.phone} onChange={e => updateStaffDraftField("personal", "phone", e.target.value)} /></label>
                                                    )}
                                                    <label className="span-2 people-address-field" ref={staffAutocompleteRef}><span>Address</span><input value={activeStaffProfileDraft.personal.address} onChange={e => handleStaffAddressChange(e.target.value)} />
                                                        {showStaffAddressSuggestions && staffAddressSuggestions.length > 0 && (
                                                            <div className="places-suggestion-list">
                                                                {staffAddressSuggestions.map(suggestion => (
                                                                    <button key={suggestion.place_id} type="button" className="places-suggestion-item" onClick={() => selectStaffAddressSuggestion(suggestion)}>
                                                                        {suggestion.description}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </label>
                                                    <label><span>City</span><input value={activeStaffProfileDraft.personal.city} onChange={e => updateStaffDraftField("personal", "city", e.target.value)} /></label>
                                                    <label><span>Postal code</span><input value={activeStaffProfileDraft.personal.postalCode} onChange={e => updateStaffDraftField("personal", "postalCode", e.target.value)} /></label>
                                                    <label className="span-2"><span>Emergency Contact Name</span><input value={activeStaffProfileDraft.emergency.contactName} onChange={e => updateStaffDraftField("emergency", "contactName", e.target.value)} /></label>
                                                    <label><span>Relationship</span><input value={activeStaffProfileDraft.emergency.relationship} onChange={e => updateStaffDraftField("emergency", "relationship", e.target.value)} /></label>
                                                    <label><span>Emergency phone</span><input value={activeStaffProfileDraft.emergency.phone} onChange={e => updateStaffDraftField("emergency", "phone", e.target.value)} /></label>
                                                </div>
                                            )}

                                            {staffProfileMobileTab === "employment" && (
                                                <div className="people-mobile-editor-section">
                                                    {canAdminDirectEditSelectedStaffProfile && (
                                                        <label>
                                                            <span>Worker type</span>
                                                            <select value={activeStaffProfileDraft.employment.workerType || "employee"} onChange={e => updateStaffDraftField("employment", "workerType", e.target.value)}>
                                                                <option value="employee">Employee</option>
                                                                <option value="subcontractor">Subcontractor</option>
                                                            </select>
                                                        </label>
                                                    )}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Years experience</span><input value={activeStaffProfileDraft.employment.yearsExperience} onChange={e => updateStaffDraftField("employment", "yearsExperience", e.target.value)} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Hourly rate</span><input type="number" min="0" step="0.01" value={activeStaffProfileDraft.employment.hourlyRate || 20} onChange={e => updateStaffDraftField("employment", "hourlyRate", parseFloat(e.target.value || "0"))} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Overtime rate</span><input type="number" min="0" step="0.01" value={activeStaffProfileDraft.employment.overtimeRate || 30} onChange={e => updateStaffDraftField("employment", "overtimeRate", parseFloat(e.target.value || "0"))} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Overtime after hrs/week</span><input type="number" min="0" step="1" value={activeStaffProfileDraft.employment.overtimeAfterHours || 44} onChange={e => updateStaffDraftField("employment", "overtimeAfterHours", parseFloat(e.target.value || "0"))} /></label>}
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Payroll status</span><input value={activeStaffProfileDraft.employment.payrollStatus || "active"} onChange={e => updateStaffDraftField("employment", "payrollStatus", e.target.value)} /></label>}
                                                    <label className="span-2 people-file-upload-field">
                                                        <span>Photo ID Upload</span>
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => handleStaffDocumentUpload(e.target.files?.[0], "photoIdUpload", "Photo ID")} disabled={staffDocumentUploading} />
                                                        <strong>{staffDocumentUploading ? "Uploading document..." : (activeStaffProfileDraft.eligibility.photoIdUpload?.name || "No photo ID uploaded yet")}</strong>
                                                    </label>
                                                    <label className="span-2 people-file-upload-field">
                                                        <span>Work Permit Document</span>
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => handleStaffDocumentUpload(e.target.files?.[0], "documentUpload", "Work permit document")} disabled={staffDocumentUploading} />
                                                        <strong>{staffDocumentUploading ? "Uploading document..." : (activeStaffProfileDraft.eligibility.documentUpload?.name || "No work permit uploaded yet")}</strong>
                                                    </label>
                                                    {canAdminDirectEditSelectedStaffProfile && <label><span>Background check</span><input value={activeStaffProfileDraft.compliance.backgroundCheckStatus} onChange={e => updateStaffDraftField("compliance", "backgroundCheckStatus", e.target.value)} /></label>}
                                                    <label className="span-2"><span>Availability notes</span><textarea value={activeStaffProfileDraft.employment.availabilityNotes} onChange={e => updateStaffDraftField("employment", "availabilityNotes", e.target.value)} /></label>
                                                </div>
                                            )}

                                            {staffProfileMobileTab === "availability" && (
                                                <div className="people-mobile-editor-section">
                                                    <div className="people-mobile-weekday-matrix">
                                                        <div className="people-mobile-weekday-matrix-head">
                                                            <span>Day</span>
                                                            <span>Morning</span>
                                                            <span>Afternoon</span>
                                                            <span>Evening</span>
                                                        </div>
                                                        {activeStaffProfileDraft.availability.weekdays.map((day, index) => (
                                                            <div key={`${day.label}-${index}`} className="people-mobile-weekday-row">
                                                                <strong>{day.label}</strong>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.morning)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "morning", e.target.checked))} /></label>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.afternoon)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "afternoon", e.target.checked))} /></label>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.evening)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "evening", e.target.checked))} /></label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <label><span>Max jobs per week</span><input type="number" value={activeStaffProfileDraft.availability.maxJobsPerDay} onChange={e => updateStaffDraftField("availability", "maxJobsPerDay", parseInt(e.target.value || "0", 10))} /></label>
                                                    <div className="span-2 people-file-upload-field">
                                                        <span>Blocked dates</span>
                                                        <div className="flex gap-2 items-center flex-wrap">
                                                            <input type="date" value={blockedDateInput} onChange={e => setBlockedDateInput(e.target.value)} />
                                                            <button type="button" className="team-secondary-action" onClick={addBlockedDateToDraft}>Add date</button>
                                                        </div>
                                                        <div className="people-blocked-dates">
                                                            {(activeStaffProfileDraft.availability.blockedDates || []).length > 0 ? activeStaffProfileDraft.availability.blockedDates.map(date => (
                                                                <button key={date} type="button" className="people-blocked-date-remove" onClick={() => removeBlockedDateFromDraft(date)}>{date} ×</button>
                                                            )) : <span>No blocked dates</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="people-mobile-editor-actions">
                                                <button type="button" className="team-secondary-action" onClick={() => setStaffProfileEditOpen(false)} disabled={staffProfileSaving}>
                                                    Cancel
                                                </button>
                                                {canAdminDirectEditSelectedStaffProfile ? (
                                                    <button type="button" className="team-primary-action" onClick={handleSaveStaffProfileDirect} disabled={staffProfileSaving}>
                                                        {staffProfileSaving ? "Saving..." : "Save Directly"}
                                                    </button>
                                                ) : (
                                                    <>
                                                        {staffProfileMobileTab === "identity" && (
                                                            <button type="button" className="team-primary-action" onClick={() => setStaffProfileMobileTab("employment")} disabled={staffProfileSaving}>
                                                                Next
                                                            </button>
                                                        )}
                                                        {staffProfileMobileTab === "employment" && (
                                                            <button type="button" className="team-primary-action" onClick={() => setStaffProfileMobileTab("availability")} disabled={staffProfileSaving}>
                                                                Next
                                                            </button>
                                                        )}
                                                        {staffProfileMobileTab === "availability" && (
                                                            <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                                {staffProfileSaving ? "Submitting..." : "Submit"}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </section>
                                    )}
                                </div>

                                {(canEditSelectedStaffProfile || canAdminDirectEditSelectedStaffProfile) && (
                                    <button
                                        type="button"
                                        className="people-mobile-fab"
                                        onClick={() => {
                                            setStaffProfileDraftOwnerUid(selectedStaffMember.uid);
                                            setStaffProfileDraft(normalizeStaffProfile(selectedStaffMember.staffProfileRequest?.requestedProfile || selectedStaffMember.staffProfile));
                                            setStaffProfileFeedback("");
                                            setStaffProfileEditOpen(true);
                                        }}
                                    >
                                        {Icons.Edit()}
                                    </button>
                                )}
                            </section>

                            <div className="people-profile-desktop-shell">
                                <div className="people-profile-breadcrumb">
                                    <button type="button" onClick={() => setSelectedStaffUid(selectedStaffMember.uid)}>
                                        Staff Management
                                    </button>
                                    <span>/</span>
                                    <strong>{selectedStaffMember.name}</strong>
                                </div>

                                <div className="people-profile-stat-grid people-profile-stat-grid-top">
                                    <div className="people-profile-stat-card">
                                        <p>Jobs Completed</p>
                                        <strong>{selectedStaffCompletedJobs.length}</strong>
                                    </div>
                                    <div className="people-profile-stat-card">
                                        <p>Exp. Level</p>
                                        <strong>{activeStaffProfileDraft.employment.yearsExperience || "0"} Years</strong>
                                    </div>
                                </div>

                                <div className="people-profile-hero people-profile-hero-reference">
                                    <div className="people-profile-hero-main">
                                        <div className="people-profile-photo-card">
                                            <div className={`people-profile-photo ${selectedStaffMember.photoURL ? "people-profile-photo-image" : ""}`}>
                                                {selectedStaffMember.photoURL ? (
                                                    <img src={selectedStaffMember.photoURL} alt={selectedStaffMember.name || selectedStaffMember.email} className="avatar-image" />
                                                ) : getInitials(selectedStaffMember.name || selectedStaffMember.email || "FS")}
                                            </div>
                                            <span
                                                className="people-profile-active-badge"
                                                style={!isEmploymentActive(selectedStaffMember) ? { background: "#7f1d1d" } : undefined}
                                            >
                                                {selectedStaffMember.employmentStatus || "Active"}
                                            </span>
                                        </div>
                                        <div className="people-profile-headings">
                                            <h3>{selectedStaffMember.name}</h3>
                                            <p>{selectedStaffMember.branchName || "Ottawa"} • {getRoleLabel(selectedStaffMember.role)}</p>
                                        </div>
                                    </div>
                                    <div className="people-profile-hero-actions">
                                        <button
                                            type="button"
                                            className="people-icon-action"
                                            disabled={!canEditSelectedStaffProfile && !canAdminDirectEditSelectedStaffProfile}
                                            onClick={() => {
                                                if (!canEditSelectedStaffProfile && !canAdminDirectEditSelectedStaffProfile) return;
                                                setStaffProfileDraftOwnerUid(selectedStaffMember.uid);
                                                setStaffProfileDraft(normalizeStaffProfile(selectedStaffMember.staffProfileRequest?.requestedProfile || selectedStaffMember.staffProfile));
                                                setStaffProfileFeedback("");
                                                setStaffProfileEditOpen(true);
                                            }}
                                        >
                                            {Icons.Edit()}
                                        </button>
                                    </div>
                                </div>

                                {staffProfileFeedback && (
                                    <div className="people-profile-message">
                                        {staffProfileFeedback}
                                    </div>
                                )}

                                {canManagePeopleProfiles && selectedStaffMember.staffProfileRequest?.requestedProfile && (
                                    <div className="people-review-panel">
                                        <div>
                                            <p className="ops-eyebrow">Approval Queue</p>
                                            <h4>Pending Staff Profile Request</h4>
                                            <p>
                                                Submitted by {selectedStaffMember.staffProfileRequest.submittedByName} on {selectedStaffMember.staffProfileRequest.submittedAt?.split("T")[0]}.
                                            </p>
                                        </div>
                                        <textarea
                                            placeholder="Optional rejection reason for branch admin feedback"
                                            value={staffProfileRejectReason}
                                            onChange={e => setStaffProfileRejectReason(e.target.value)}
                                        />
                                        <div className="people-review-actions">
                                            <button type="button" className="team-primary-action" onClick={() => handleReviewStaffProfileRequest("approve")} disabled={staffProfileSaving}>
                                                Approve Changes
                                            </button>
                                            <button type="button" className="team-secondary-action" onClick={() => handleReviewStaffProfileRequest("reject")} disabled={staffProfileSaving}>
                                                Reject Changes
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!staffProfileEditOpen ? (
                                    <div className="people-profile-reference-grid">
                                        <article className="people-profile-section">
                                            <div className="people-profile-section-head">
                                                <p className="ops-eyebrow">Identity</p>
                                                <h4>Identity</h4>
                                            </div>
                                            <div className="people-profile-read-list">
                                                <div><span>Email Address</span><strong>{activeStaffProfileDraft.personal.email || selectedStaffMember.email}</strong></div>
                                                <div><span>Phone</span><strong>{activeStaffProfileDraft.personal.phone || "Not submitted"}</strong></div>
                                                <div className="people-profile-divider"></div>
                                                <div><span className="people-alert-label">Emergency Contact</span><strong>{activeStaffProfileDraft.emergency.contactName || "Not submitted"}</strong></div>
                                                <div><span>Relationship</span><strong>{activeStaffProfileDraft.emergency.relationship || "Not submitted"}</strong></div>
                                                <div><span>Phone</span><strong>{activeStaffProfileDraft.emergency.phone || "Not submitted"}</strong></div>
                                            </div>
                                        </article>

                                        <article className="people-profile-section">
                                            <div className="people-profile-section-head">
                                                <p className="ops-eyebrow">Availability</p>
                                                <h4>Availability</h4>
                                            </div>
                                            <div className="people-availability-header">
                                                <strong>Max {selectedStaffAvailability.maxJobsPerDay} Jobs/Week</strong>
                                            </div>
                                            <div className="people-availability-week">
                                                {selectedStaffAvailability.weekdays.map((day, index) => (
                                                    <div key={`${day.label}-${index}`} className="people-day-tile-wrap">
                                                        <span>{day.label}</span>
                                                        <div className={`people-day-tile ${day.status !== "A" ? "people-day-tile-passive" : ""}`}>{day.status}</div>
                                                        <small>{day.shifts?.morning ? "M" : "-"}/{day.shifts?.afternoon ? "A" : "-"}/{day.shifts?.evening ? "E" : "-"}</small>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="people-availability-shifts">
                                                <div className="people-shift-row"><span className="people-shift-dot"></span><span>Morning (08:00 - 12:00)</span><strong>Per day</strong></div>
                                                <div className="people-shift-row"><span className="people-shift-dot"></span><span>Afternoon (13:00 - 17:00)</span><strong>Per day</strong></div>
                                                <div className="people-shift-row people-shift-row-muted"><span className="people-shift-dot"></span><span>Evening (18:00+)</span><strong>Per day</strong></div>
                                            </div>
                                            <div className="people-profile-divider"></div>
                                            <div>
                                                <span className="people-subsection-title">Upcoming Blocked Dates</span>
                                                <div className="people-blocked-dates">
                                                    {selectedStaffBlockedDates.length > 0 ? selectedStaffBlockedDates.map(date => (
                                                        <span key={date}>{date}</span>
                                                    )) : <span>No blocked dates</span>}
                                                </div>
                                            </div>
                                        </article>

                                        <article className="people-profile-section">
                                            <div className="people-profile-section-head">
                                                <p className="ops-eyebrow">Employment</p>
                                                <h4>Employment</h4>
                                            </div>
                                            {canManagePeopleProfiles && (
                                                <EmploymentActions
                                                    member={selectedStaffMember}
                                                    canManagePeopleProfiles={canManagePeopleProfiles}
                                                    staffProfileSaving={staffProfileSaving}
                                                    handleUpdateEmploymentStatus={handleUpdateEmploymentStatus}
                                                />
                                            )}
                                            <div className="people-profile-read-list">
                                                <div><span>Worker Type</span><strong>{activeStaffProfileDraft.employment.workerType || getRoleLabel(selectedStaffMember.role)}</strong></div>
                                                <div><span>Hourly Rate</span><strong>${Number(activeStaffProfileDraft.employment.hourlyRate || 20).toFixed(2)}/hr</strong></div>
                                                <div><span>Overtime Rate</span><strong>${Number(activeStaffProfileDraft.employment.overtimeRate || 30).toFixed(2)}/hr</strong></div>
                                                <div><span>Overtime After</span><strong>{Number(activeStaffProfileDraft.employment.overtimeAfterHours || 44)} hrs/week</strong></div>
                                                <div><span>Payroll Status</span><strong>{activeStaffProfileDraft.employment.payrollStatus || "active"}</strong></div>
                                                <div>
                                                    <span>Work Permit Document</span>
                                                    {activeStaffProfileDraft.eligibility.documentUpload?.url ? (
                                                        <a href={activeStaffProfileDraft.eligibility.documentUpload.url} target="_blank" rel="noreferrer"><strong>{activeStaffProfileDraft.eligibility.documentUpload.name || "View document"}</strong></a>
                                                    ) : (
                                                        <strong>No document uploaded</strong>
                                                    )}
                                                </div>
                                                <div>
                                                    <span>Photo ID Upload</span>
                                                    {activeStaffProfileDraft.eligibility.photoIdUpload?.url ? (
                                                        <a href={activeStaffProfileDraft.eligibility.photoIdUpload.url} target="_blank" rel="noreferrer"><strong>{activeStaffProfileDraft.eligibility.photoIdUpload.name || "View photo ID"}</strong></a>
                                                    ) : (
                                                        <strong>No photo ID uploaded</strong>
                                                    )}
                                                </div>
                                                <div><span>Police Clearance</span><strong>{activeStaffProfileDraft.compliance.backgroundCheckStatus || "Pending"}</strong></div>
                                                <div><span>Start Date</span><strong>{selectedStaffMember.createdAt ? selectedStaffMember.createdAt.split("T")[0] : "Pending"}</strong></div>
                                                <div className="people-note-card">
                                                    &ldquo;{activeStaffProfileDraft.employment.availabilityNotes || "Staff profile notes will appear here after branch admin approval."}&rdquo;
                                                </div>
                                            </div>
                                        </article>
                                    </div>
                                ) : (
                                    <section className="people-profile-editor people-profile-editor-full">
                                        <div className="people-profile-section-head">
                                            <p className="ops-eyebrow">Edit Profile</p>
                                            <h4>{canAdminDirectEditSelectedStaffProfile ? "Edit Staff Profile" : "Submit Profile Changes For Review"}</h4>
                                        </div>
                                        <div className="people-edit-groups">
                                            <section className="people-edit-group">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Approval Required</p>
                                                    <h4>Identity</h4>
                                                </div>
                                                <div className="people-profile-form-grid people-profile-form-grid-wide">
                                                    <label><span>Legal name</span><input value={activeStaffProfileDraft.personal.legalName} onChange={e => updateStaffDraftField("personal", "legalName", e.target.value)} /></label>
                                                    <label><span>Preferred name</span><input value={activeStaffProfileDraft.personal.preferredName} onChange={e => updateStaffDraftField("personal", "preferredName", e.target.value)} /></label>
                                                    {canAdminDirectEditSelectedStaffProfile && (
                                                        <label><span>Email</span><input type="email" value={activeStaffProfileDraft.personal.email || selectedStaffMember.email || ""} onChange={e => updateStaffDraftField("personal", "email", e.target.value)} /></label>
                                                    )}
                                                    {canAdminDirectEditSelectedStaffProfile && (
                                                        <label><span>Phone</span><input value={activeStaffProfileDraft.personal.phone} onChange={e => updateStaffDraftField("personal", "phone", e.target.value)} /></label>
                                                    )}
                                                    <label><span>Date of birth</span><input type="date" value={activeStaffProfileDraft.personal.dateOfBirth} onChange={e => updateStaffDraftField("personal", "dateOfBirth", e.target.value)} /></label>
                                                    <label className="span-2 people-address-field" ref={staffAutocompleteRef}><span>Address</span><input value={activeStaffProfileDraft.personal.address} onChange={e => handleStaffAddressChange(e.target.value)} />
                                                        {showStaffAddressSuggestions && staffAddressSuggestions.length > 0 && (
                                                            <div className="places-suggestion-list">
                                                                {staffAddressSuggestions.map(suggestion => (
                                                                    <button key={suggestion.place_id} type="button" className="places-suggestion-item" onClick={() => selectStaffAddressSuggestion(suggestion)}>
                                                                        {suggestion.description}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </label>
                                                    <label><span>City</span><input value={activeStaffProfileDraft.personal.city} onChange={e => updateStaffDraftField("personal", "city", e.target.value)} /></label>
                                                    <label><span>Postal code</span><input value={activeStaffProfileDraft.personal.postalCode} onChange={e => updateStaffDraftField("personal", "postalCode", e.target.value)} /></label>
                                                </div>
                                            </section>

                                            <section className="people-edit-group">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Approval Required</p>
                                                    <h4>Emergency Contact</h4>
                                                </div>
                                                <div className="people-profile-form-grid people-profile-form-grid-wide">
                                                    <label><span>Emergency Contact Name</span><input value={activeStaffProfileDraft.emergency.contactName} onChange={e => updateStaffDraftField("emergency", "contactName", e.target.value)} /></label>
                                                    <label><span>Relationship</span><input value={activeStaffProfileDraft.emergency.relationship} onChange={e => updateStaffDraftField("emergency", "relationship", e.target.value)} /></label>
                                                    <label><span>Emergency phone</span><input value={activeStaffProfileDraft.emergency.phone} onChange={e => updateStaffDraftField("emergency", "phone", e.target.value)} /></label>
                                                </div>
                                            </section>

                                            <section className="people-edit-group">
                                                <div className="people-profile-section-head">
                                                    <p className="ops-eyebrow">Scheduling Logic</p>
                                                    <h4>Availability</h4>
                                                </div>
                                                <div className="people-availability-edit-grid">
                                                    <div className="people-availability-matrix">
                                                        <div className="people-availability-matrix-head">
                                                            <span>Day</span>
                                                            <span>Morning</span>
                                                            <span>Afternoon</span>
                                                            <span>Evening</span>
                                                        </div>
                                                        {activeStaffProfileDraft.availability.weekdays.map((day, index) => (
                                                            <div key={`${day.label}-${index}`} className="people-availability-matrix-row">
                                                                <strong>{day.label}</strong>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.morning)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "morning", e.target.checked))} /></label>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.afternoon)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "afternoon", e.target.checked))} /></label>
                                                                <label className="people-matrix-check"><input type="checkbox" checked={Boolean(day.shifts?.evening)} onChange={e => updateStaffDraftField("availability", "weekdays", updateAvailabilityDayShift(activeStaffProfileDraft.availability.weekdays, index, "evening", e.target.checked))} /></label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <label><span>Max jobs per week</span><input type="number" value={activeStaffProfileDraft.availability.maxJobsPerDay} onChange={e => updateStaffDraftField("availability", "maxJobsPerDay", parseInt(e.target.value || "0", 10))} /></label>
                                                    <div className="span-2 people-file-upload-field">
                                                        <span>Blocked dates</span>
                                                        <div className="flex gap-2 items-center flex-wrap">
                                                            <input type="date" value={blockedDateInput} onChange={e => setBlockedDateInput(e.target.value)} />
                                                            <button type="button" className="team-secondary-action" onClick={addBlockedDateToDraft}>Add date</button>
                                                        </div>
                                                        <div className="people-blocked-dates">
                                                            {(activeStaffProfileDraft.availability.blockedDates || []).length > 0 ? activeStaffProfileDraft.availability.blockedDates.map(date => (
                                                                <button key={date} type="button" className="people-blocked-date-remove" onClick={() => removeBlockedDateFromDraft(date)}>{date} ×</button>
                                                            )) : <span>No blocked dates</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                        <div className="people-profile-form-grid people-profile-form-grid-wide">
                                            {canAdminDirectEditSelectedStaffProfile && (
                                                <label>
                                                    <span>Worker type</span>
                                                    <select value={activeStaffProfileDraft.employment.workerType || "employee"} onChange={e => updateStaffDraftField("employment", "workerType", e.target.value)}>
                                                        <option value="employee">Employee</option>
                                                        <option value="subcontractor">Subcontractor</option>
                                                    </select>
                                                </label>
                                            )}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Years experience</span><input value={activeStaffProfileDraft.employment.yearsExperience} onChange={e => updateStaffDraftField("employment", "yearsExperience", e.target.value)} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Languages</span><input value={activeStaffProfileDraft.employment.languages} onChange={e => updateStaffDraftField("employment", "languages", e.target.value)} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Hourly rate</span><input type="number" min="0" step="0.01" value={activeStaffProfileDraft.employment.hourlyRate || 20} onChange={e => updateStaffDraftField("employment", "hourlyRate", parseFloat(e.target.value || "0"))} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Overtime rate</span><input type="number" min="0" step="0.01" value={activeStaffProfileDraft.employment.overtimeRate || 30} onChange={e => updateStaffDraftField("employment", "overtimeRate", parseFloat(e.target.value || "0"))} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Overtime after hrs/week</span><input type="number" min="0" step="1" value={activeStaffProfileDraft.employment.overtimeAfterHours || 44} onChange={e => updateStaffDraftField("employment", "overtimeAfterHours", parseFloat(e.target.value || "0"))} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Payroll status</span><input value={activeStaffProfileDraft.employment.payrollStatus || "active"} onChange={e => updateStaffDraftField("employment", "payrollStatus", e.target.value)} /></label>}
                                            <label><span>T-shirt size</span><input value={activeStaffProfileDraft.employment.tshirtSize} onChange={e => updateStaffDraftField("employment", "tshirtSize", e.target.value)} /></label>
                                            <label className="span-2"><span>Availability notes</span><textarea value={activeStaffProfileDraft.employment.availabilityNotes} onChange={e => updateStaffDraftField("employment", "availabilityNotes", e.target.value)} /></label>
                                            <label className="span-2 people-file-upload-field">
                                                <span>Photo ID Upload</span>
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => handleStaffDocumentUpload(e.target.files?.[0], "photoIdUpload", "Photo ID")} disabled={staffDocumentUploading} />
                                                <strong>{staffDocumentUploading ? "Uploading document..." : (activeStaffProfileDraft.eligibility.photoIdUpload?.name || "No photo ID uploaded yet")}</strong>
                                                {canAdminDirectEditSelectedStaffProfile && activeStaffProfileDraft.eligibility.photoIdUpload?.url && (
                                                    <a href={activeStaffProfileDraft.eligibility.photoIdUpload.url} target="_blank" rel="noreferrer">View uploaded photo ID</a>
                                                )}
                                            </label>
                                            <label className="span-2 people-file-upload-field">
                                                <span>Work Permit Document</span>
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={e => handleStaffDocumentUpload(e.target.files?.[0], "documentUpload", "Work permit document")} disabled={staffDocumentUploading} />
                                                <strong>{staffDocumentUploading ? "Uploading document..." : (activeStaffProfileDraft.eligibility.documentUpload?.name || "No work permit uploaded yet")}</strong>
                                                {canAdminDirectEditSelectedStaffProfile && activeStaffProfileDraft.eligibility.documentUpload?.url && (
                                                    <a href={activeStaffProfileDraft.eligibility.documentUpload.url} target="_blank" rel="noreferrer">View uploaded work permit</a>
                                                )}
                                            </label>
                                            <label><span>Permit expiry</span><input type="date" value={activeStaffProfileDraft.eligibility.workPermitExpiry} onChange={e => updateStaffDraftField("eligibility", "workPermitExpiry", e.target.value)} /></label>
                                            <label><span>SIN last 4</span><input value={activeStaffProfileDraft.eligibility.sinLast4} onChange={e => updateStaffDraftField("eligibility", "sinLast4", e.target.value)} /></label>
                                            <label><span>License class</span><input value={activeStaffProfileDraft.eligibility.driversLicenseClass} onChange={e => updateStaffDraftField("eligibility", "driversLicenseClass", e.target.value)} /></label>
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Background check</span><input value={activeStaffProfileDraft.compliance.backgroundCheckStatus} onChange={e => updateStaffDraftField("compliance", "backgroundCheckStatus", e.target.value)} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Background expiry</span><input type="date" value={activeStaffProfileDraft.compliance.backgroundCheckExpiry} onChange={e => updateStaffDraftField("compliance", "backgroundCheckExpiry", e.target.value)} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Insurance status</span><input value={activeStaffProfileDraft.compliance.insuranceStatus} onChange={e => updateStaffDraftField("compliance", "insuranceStatus", e.target.value)} /></label>}
                                            {canAdminDirectEditSelectedStaffProfile && <label><span>Insurance expiry</span><input type="date" value={activeStaffProfileDraft.compliance.insuranceExpiry} onChange={e => updateStaffDraftField("compliance", "insuranceExpiry", e.target.value)} /></label>}
                                            <label><span>Training status</span><input value={activeStaffProfileDraft.compliance.trainingStatus} onChange={e => updateStaffDraftField("compliance", "trainingStatus", e.target.value)} /></label>
                                        </div>
                                        <div className="people-profile-footer">
                                            <p>
                                                This profile is stored in Firestore. Identity and emergency contact changes require admin approval. Availability follows separate scheduling rules with the next 48 hours locked from direct cleaner changes.
                                            </p>
                                            <div className="people-editor-actions">
                                                <button type="button" className="team-secondary-action" onClick={() => setStaffProfileEditOpen(false)} disabled={staffProfileSaving}>
                                                    Cancel
                                                </button>
                                                {canAdminDirectEditSelectedStaffProfile ? (
                                                    <button type="button" className="team-primary-action" onClick={handleSaveStaffProfileDirect} disabled={staffProfileSaving}>
                                                        {staffProfileSaving ? "Saving..." : "Save Directly"}
                                                    </button>
                                                ) : (
                                                    <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                        {staffProfileSaving ? "Submitting..." : "Submit For Review"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {!canManagePeopleProfiles && (
                                    <div className="people-profile-footer">
                                        <p>
                                            Profile changes go to branch admin for approval. Availability restrictions are enforced by scheduling logic and are not shown as editable warnings in the UI.
                                        </p>
                                        {canEditSelectedStaffProfile && (
                                            <button type="button" className="team-primary-action" onClick={handleSubmitStaffProfile} disabled={staffProfileSaving}>
                                                {staffProfileSaving ? "Submitting..." : "Submit Profile Update"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
