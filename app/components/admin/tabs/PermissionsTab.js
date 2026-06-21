"use client";

export default function PermissionsTab({ ROLE_DEFINITIONS, DEPARTMENTS }) {
    return (
        <div className="animate-fade flex flex-col gap-6">
            <div className="ops-control-header">
                <div>
                    <p className="ops-eyebrow">Access control</p>
                    <h3 className="ops-title">Permissions & Roles</h3>
                    <p className="ops-copy">
                        Legacy roles remain compatible while we introduce real departments, branch rules, and people management.
                    </p>
                </div>
                <span className="ops-chip ops-chip-green">Super Admin controlled</span>
            </div>

            <div className="permissions-grid">
                {Object.entries(ROLE_DEFINITIONS).map(([roleId, definition]) => (
                    <article key={roleId} className="permission-card">
                        <div className="permission-card-head">
                            <div>
                                <h4>{definition.label}</h4>
                                <p>{definition.description}</p>
                            </div>
                            <span className="ops-chip">{roleId}</span>
                        </div>
                        <div className="permission-departments">
                            {DEPARTMENTS.map(department => (
                                <span
                                    key={department.id}
                                    className={definition.departments.includes(department.id) ? "allowed" : ""}
                                >
                                    {department.name}
                                </span>
                            ))}
                        </div>
                        <div className="permission-flags">
                            <span>{definition.canSwitchBranches ? "Can switch branches" : "Branch scoped"}</span>
                            <span>{definition.canManagePermissions ? "Can manage permissions" : "No permission edits"}</span>
                        </div>
                    </article>
                ))}
            </div>

            <div className="notification-readiness-panel">
                <div>
                    <p className="ops-eyebrow">Communication infrastructure</p>
                    <h3 className="ops-title">Email, SMS, and App Push Requirements</h3>
                    <p className="ops-copy">
                        To send reminders from info@smartouchclean.com and notify customers, cleaners, supervisors, and admins,
                        the app needs these production services connected.
                    </p>
                </div>
                <div className="notification-requirements-grid">
                    <div>
                        <strong>Email</strong>
                        <span>SendGrid, Resend, Postmark, or Gmail Workspace SMTP with SPF/DKIM/DMARC configured for smartouchclean.com.</span>
                    </div>
                    <div>
                        <strong>SMS / Phone</strong>
                        <span>Twilio or Telnyx number, consent tracking, opt-out handling, and customer/cleaner phone verification.</span>
                    </div>
                    <div>
                        <strong>Web Push</strong>
                        <span>PWA manifest, service worker, VAPID keys, browser permission prompts, and saved push subscriptions per user/device.</span>
                    </div>
                    <div>
                        <strong>In-App Notes</strong>
                        <span>Firestore notifications collection for supervisor notes, admin alerts, job comments, unread counts, and audit trail.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
