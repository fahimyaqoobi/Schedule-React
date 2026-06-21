"use client";

const LogoutIcon = () => (
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
);

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
}) {
    return (
        <div className="animate-fade">
            <div className="settings-container">
                {/* Card 1: User Profile */}
                <div className="settings-card">
                    <div className="panel-header border-b border-slate-100 pb-3">
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">User Profile Specifications</h4>
                    </div>
                    <form onSubmit={handleProfileUpdate} className="settings-form">
                        <div className="settings-avatar-group">
                            <div className={`settings-avatar ${currentUser.photoURL ? "settings-avatar-photo" : ""}`}>
                                {currentUser.photoURL ? (
                                    <img src={currentUser.photoURL} alt={currentUser.name} className="avatar-image" />
                                ) : getInitials(currentUser.name)}
                            </div>
                            <div>
                                <h5 className="settings-profile-name">{currentUser.name}</h5>
                                <span className="settings-profile-role">{roleLabel}</span>
                            </div>
                        </div>
                        <label className="settings-photo-upload">
                            <input
                                type="file"
                                accept="image/*"
                                capture="user"
                                onChange={e => handleProfilePhotoCapture(e.target.files?.[0])}
                                disabled={profilePhotoUploading}
                            />
                            {profilePhotoUploading ? "Uploading Photo..." : "Take Or Upload Profile Photo"}
                        </label>
                        {profilePhotoStatus && (
                            <div className="people-profile-message">{profilePhotoStatus}</div>
                        )}
                        <div className="form-group">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={profileName}
                                onChange={e => setProfileName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email Address (Read-only)</label>
                            <input type="email" value={currentUser.email} disabled className="input-readonly" />
                        </div>
                        {!canManagePermissions && (
                            <div className="form-group">
                                <label>Assigned Cleaning Crew</label>
                                <input type="text" value={currentUser.teamId || "None"} disabled className="input-readonly" />
                            </div>
                        )}
                        <button type="submit" disabled={profileLoading} className="btn btn-primary h-[44px] rounded-lg text-white font-bold transition mt-2">
                            {profileLoading ? "Updating Profile..." : "Save Profile Details"}
                        </button>
                        <div className="mt-4 pt-4 border-t border-slate-100/80 w-full">
                            <button
                                type="button"
                                onClick={handleSignout}
                                className="btn btn-danger w-full h-[44px] flex items-center justify-center gap-2 font-bold transition-all mt-2"
                            >
                                <LogoutIcon /> Log Out of Account
                            </button>
                        </div>
                    </form>
                </div>

                {/* Card 2: Security & Password */}
                <div className="settings-card">
                    <div className="panel-header border-b border-slate-100 pb-3">
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Security & Password Management</h4>
                    </div>
                    <form onSubmit={handlePasswordChange} className="settings-form">
                        <div className="form-group">
                            <label>Current Password</label>
                            <input
                                type="password"
                                value={securityForm.currentPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={securityForm.newPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                required
                                placeholder="Min 6 characters"
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                value={securityForm.confirmPassword}
                                onChange={e => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                        <button type="submit" disabled={securityLoading} className="btn btn-danger h-[44px] rounded-lg font-bold transition mt-2">
                            {securityLoading ? "Updating Password..." : "Change Security Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
