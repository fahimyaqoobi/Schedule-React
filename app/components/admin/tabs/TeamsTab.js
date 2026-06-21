"use client";

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
}) {
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
                        <div className="grid grid-cols-4 gap-3 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                            {peopleRoster.map(member => {
                                const assignedJobs = bookings.filter(b => b.assignedStaffIds?.includes(member.uid) && b.status !== "Cancelled");
                                const completedCount = assignedJobs.filter(b => b.status === "Completed").length;
                                const initials = getInitials(member.name || member.email || "FS");
                                const requestPending = member.staffProfileRequest?.requestedProfile;
                                return (
                                    <button
                                        key={member.uid}
                                        type="button"
                                        onClick={() => {
                                            setSelectedStaffUid(member.uid);
                                            setStaffProfileDraftOwnerUid(member.uid);
                                            setStaffProfileDraft(normalizeStaffProfile(member.staffProfile));
                                            setStaffProfileFeedback("");
                                            setStaffProfileRejectReason("");
                                            setStaffProfileEditOpen(false);
                                        }}
                                        className={`rounded-[28px] border p-3 text-left shadow-sm transition ${selectedStaffMember?.uid === member.uid ? "border-blue-500 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-slate-300"}`}
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <div className={`relative h-16 w-16 overflow-hidden rounded-full border-4 ${selectedStaffMember?.uid === member.uid ? "border-blue-500" : "border-slate-100"} bg-blue-600 text-white flex items-center justify-center text-lg font-extrabold`}>
                                                {member.photoURL ? (
                                                    <img src={member.photoURL} alt={member.name || member.email} className="h-full w-full object-cover" />
                                                ) : initials}
                                                <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white ${member.status === "approved" ? "bg-emerald-500" : "bg-amber-400"}`}></span>
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-1">
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${member.staffProfileMeta?.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>P</span>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${assignedJobs.length > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>J{assignedJobs.length}</span>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${completedCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>C{completedCount}</span>
                                                {requestPending && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">R</span>}
                                            </div>
                                            <div className="text-center">
                                                <h4 className="line-clamp-2 text-xs font-bold text-slate-800">{member.name}</h4>
                                                <span className="text-[10px] text-slate-500">{getRoleLabel(member.role)}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {selectedStaffMember && activeStaffProfileDraft && (
                        <section className="people-profile-canvas">
                            <section className={`people-mobile-profile-shell ${isViewingOwnCleanerProfile ? "people-mobile-profile-shell-self" : ""}`}>
                                <div className="people-mobile-profile-top">
                                    <div className="people-mobile-profile-avatar-wrap">
                                        <div className={`people-mobile-profile-avatar ${selectedStaffMember.photoURL ? "people-mobile-profile-avatar-photo" : ""}`}>
                                            {selectedStaffMember.photoURL ? (
                                                <img src={selectedStaffMember.photoURL} alt={selectedStaffMember.name || selectedStaffMember.email} className="avatar-image" />
                                            ) : getInitials(selectedStaffMember.name || selectedStaffMember.email || "FS")}
                                        </div>
                                        <span className="people-mobile-profile-presence"></span>
                                    </div>
                                    <h3>{selectedStaffMember.name}</h3>
                                    <div className="people-mobile-profile-status">
                                        <span></span>
                                        Active
                                    </div>
                                    {canEditSelectedStaffProfile && (
                                        <label className="people-photo-upload-button">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="user"
                                                onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                                disabled={profilePhotoUploading}
                                            />
                                            {profilePhotoUploading ? "Uploading Photo..." : "Take Live Photo"}
                                        </label>
                                    )}
                                </div>

                                <div className="people-mobile-profile-stats">
                                    <div>
                                        <strong>4.9</strong>
                                        <span>Rating</span>
                                    </div>
                                    <div>
                                        <strong>{selectedStaffCompletedJobs.length}</strong>
                                        <span>Jobs</span>
                                    </div>
                                    <div>
                                        <strong>98%</strong>
                                        <span>On-Time</span>
                                    </div>
                                </div>

                                {staffProfileFeedback && (
                                    <div className="people-profile-message people-mobile-profile-message">
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

                                <nav className="people-mobile-profile-tabs">
                                    <button type="button" className={staffProfileMobileTab === "identity" ? "active" : ""} onClick={() => setStaffProfileMobileTab("identity")}>Identity</button>
                                    <button type="button" className={staffProfileMobileTab === "employment" ? "active" : ""} onClick={() => setStaffProfileMobileTab("employment")}>Employment</button>
                                    <button type="button" className={staffProfileMobileTab === "availability" ? "active" : ""} onClick={() => setStaffProfileMobileTab("availability")}>Availability</button>
                                </nav>

                                <div className="people-mobile-profile-content">
                                    {staffProfileMobileTab === "identity" && !staffProfileEditOpen && (
                                        <div className="people-mobile-section-stack">
                                            <section className="people-mobile-card-group">
                                                <label>Contact Information</label>
                                                <div className="people-mobile-info-stack">
                                                    {selectedStaffIdentityCards.map(card => (
                                                        <article key={card.key} className="people-mobile-info-card">
                                                            <div className="people-mobile-info-icon">{card.icon}</div>
                                                            <div>
                                                                <span>{card.label}</span>
                                                                <strong>{card.value}</strong>
                                                            </div>
                                                        </article>
                                                    ))}
                                                </div>
                                            </section>
                                            <section className="people-mobile-card-group">
                                                <label>Emergency Contact</label>
                                                <article className="people-mobile-emergency-card">
                                                    <div>
                                                        <strong>{activeStaffProfileDraft.emergency.contactName || "Not submitted"}</strong>
                                                        <span>{activeStaffProfileDraft.emergency.relationship || "Relationship pending"}</span>
                                                        <p>{activeStaffProfileDraft.emergency.phone || "Phone pending"}</p>
                                                    </div>
                                                    <div className="people-mobile-info-icon">{Icons.Contact()}</div>
                                                </article>
                                            </section>
                                        </div>
                                    )}

                                    {staffProfileMobileTab === "employment" && !staffProfileEditOpen && (
                                        <div className="people-mobile-section-stack">
                                            <section className="people-mobile-card-group">
                                                <label>Employment</label>
                                                <div className="people-mobile-mini-grid">
                                                    {selectedStaffEmploymentCards.map(card => (
                                                        <article key={card.key} className="people-mobile-mini-card">
                                                            <span>{card.label}</span>
                                                            <strong>{card.value}</strong>
                                                        </article>
                                                    ))}
                                                </div>
                                            </section>
                                            <section className="people-mobile-card-group">
                                                <label>Internal Notes</label>
                                                <article className="people-mobile-note-card">
                                                    {activeStaffProfileDraft.employment.availabilityNotes || "Staff profile notes will appear here after branch admin approval."}
                                                </article>
                                            </section>
                                        </div>
                                    )}

                                    {staffProfileMobileTab === "availability" && !staffProfileEditOpen && (
                                        <div className="people-mobile-section-stack">
                                            <section className="people-mobile-availability-hero">
                                                <div>
                                                    <strong>Weekly Schedule</strong>
                                                    <span>Live scheduling data from Firestore</span>
                                                </div>
                                                <span>Max {selectedStaffAvailability.maxJobsPerDay} Jobs/Week</span>
                                            </section>
                                            <section className="people-mobile-availability-card">
                                                <div className="people-mobile-availability-week">
                                                    {selectedStaffAvailability.weekdays.map((day, index) => (
                                                        <div key={`${day.label}-${index}`} className="people-mobile-availability-day">
                                                            <span>{day.label}</span>
                                                            <div className={`people-mobile-day-pill ${day.status !== "A" ? "passive" : ""}`}>{day.status}</div>
                                                            <small>{day.shifts?.morning ? "M" : "-"}/{day.shifts?.afternoon ? "A" : "-"}/{day.shifts?.evening ? "E" : "-"}</small>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="people-mobile-availability-shifts">
                                                    <div className="people-mobile-shift-row"><div><span className="people-mobile-shift-dot"></span><p>Morning (08:00 - 12:00)</p></div><strong>Per day</strong></div>
                                                    <div className="people-mobile-shift-row"><div><span className="people-mobile-shift-dot"></span><p>Afternoon (13:00 - 17:00)</p></div><strong>Per day</strong></div>
                                                    <div className="people-mobile-shift-row muted"><div><span className="people-mobile-shift-dot"></span><p>Evening (18:00+)</p></div><strong>Per day</strong></div>
                                                </div>
                                                <div className="people-mobile-blocked-wrap">
                                                    <label>Upcoming Blocked Dates</label>
                                                    <div className="people-blocked-dates people-mobile-blocked-dates">
                                                        {selectedStaffBlockedDates.length > 0 ? selectedStaffBlockedDates.map(date => (
                                                            <span key={date}>{date}</span>
                                                        )) : <span>No blocked dates</span>}
                                                    </div>
                                                </div>
                                            </section>
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
                                        <p>Rating</p>
                                        <strong>4.9</strong>
                                    </div>
                                    <div className="people-profile-stat-card">
                                        <p>Jobs Completed</p>
                                        <strong>{selectedStaffCompletedJobs.length}</strong>
                                    </div>
                                    <div className="people-profile-stat-card">
                                        <p>On-Time</p>
                                        <strong>98.5%</strong>
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
                                            <span className="people-profile-active-badge">Active</span>
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
                                                <p className="ops-eyebrow">Performance</p>
                                                <h4>Performance</h4>
                                            </div>
                                            <div className="people-performance-rating">
                                                <span>Customer Rating</span>
                                                <strong>4.9 ★</strong>
                                            </div>
                                            <div className="people-performance-bar"><span></span></div>
                                            <div className="people-performance-metrics">
                                                <div><span>No-Shows</span><strong>0</strong></div>
                                                <div><span>Late (&gt;15m)</span><strong>2</strong></div>
                                                <div><span>Cancellations</span><strong>1</strong></div>
                                            </div>
                                        </article>

                                        <article className="people-profile-section">
                                            <div className="people-profile-section-head">
                                                <p className="ops-eyebrow">Employment</p>
                                                <h4>Employment</h4>
                                            </div>
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

                                        <article className="people-profile-section">
                                            <div className="people-profile-section-head">
                                                <p className="ops-eyebrow">Skills & Restrictions</p>
                                                <h4>Skills & Restrictions</h4>
                                            </div>
                                            <div className="people-skill-group">
                                                <span className="people-subsection-title">Approved Services</span>
                                                <div className="people-chip-list">
                                                    <span>Standard Cleaning</span>
                                                    <span>Deep Cleaning</span>
                                                    <span>Move-in/out</span>
                                                    <span>Carpet Steam</span>
                                                </div>
                                            </div>
                                            <div className="people-skill-group">
                                                <span className="people-subsection-title">Work Restrictions</span>
                                                <div className="people-restrictions-list">
                                                    <div><strong>No Pets</strong><span>(Allergy)</span></div>
                                                    <div><strong>Can work alone</strong></div>
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
