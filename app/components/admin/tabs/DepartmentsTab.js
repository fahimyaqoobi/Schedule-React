"use client";

const DepartmentsIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1"></rect>
    </svg>
);

const DEPARTMENT_TAB_TARGETS = {
    operations: "dashboard",
    people: "teams",
    sales: "bookings",
    finance: "payroll",
    administration: "settings",
};

const ACCENTS = [
    "from-blue-600 to-cyan-500",
    "from-emerald-600 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-violet-600 to-indigo-500",
    "from-slate-700 to-slate-500",
    "from-cyan-700 to-blue-600",
    "from-rose-600 to-orange-500",
];

export default function DepartmentsTab({
    DEPARTMENTS,
    canViewDepartment,
    setActiveTab,
    pendingUsers,
    fieldStaff,
    getRoleLabel,
    activeBranch,
}) {
    return (
        <div className="animate-fade flex flex-col gap-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="ops-eyebrow">Organization</p>
                        <h3 className="ops-title">Departments</h3>
                        <p className="ops-copy">View every operating department, its responsibilities, and the modules connected to it.</p>
                    </div>
                    <span className="w-fit rounded-full bg-cyan-100 px-4 py-2 text-xs font-black uppercase tracking-wider text-cyan-800">{DEPARTMENTS.length} Departments</span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {DEPARTMENTS.map((department, index) => {
                        const targetTab = DEPARTMENT_TAB_TARGETS[department.id];
                        const hasAccess = canViewDepartment(department.id);
                        return (
                            <article key={department.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
                                <div className={`h-2 bg-gradient-to-r ${ACCENTS[index % ACCENTS.length]}`}></div>
                                <div className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="rounded-xl bg-white p-3 text-blue-800 shadow-sm"><DepartmentsIcon /></div>
                                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${hasAccess ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"}`}>{hasAccess ? "Available" : "Restricted"}</span>
                                    </div>
                                    <h4 className="mt-4 text-xl font-black text-slate-900">{department.name}</h4>
                                    <p className="mt-2 min-h-[60px] text-sm leading-6 text-slate-500">{department.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {department.modules.map(module => (
                                            <span key={module} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">{module}</span>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!hasAccess || !targetTab}
                                        onClick={() => targetTab && setActiveTab(targetTab)}
                                        className="btn btn-secondary btn-sm mt-5 w-full"
                                    >
                                        {!hasAccess ? "Access Restricted" : targetTab ? "Open Department" : "Workspace Coming Next"}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <div className="hr-hub-shell">
                <div className="hr-hub-hero">
                    <div>
                        <p className="ops-eyebrow">People Management</p>
                        <h3 className="ops-title">People Management Department</h3>
                        <p className="ops-copy">Recruitment, onboarding, staff directory, and compliance for the current branch.</p>
                    </div>
                    <div className="hr-hub-actions">
                        <button type="button" className="team-secondary-action">Post New Job</button>
                        <button type="button" className="team-primary-action" onClick={() => setActiveTab("teams")}>Open Staff Profiles</button>
                    </div>
                </div>

                <div className="hr-hub-metrics">
                    <article className="hr-hub-metric-card">
                        <span>Open Roles</span>
                        <strong>{Math.max(3, pendingUsers.length)}</strong>
                        <em>Recruitment active</em>
                    </article>
                    <article className="hr-hub-metric-card">
                        <span>New Applications</span>
                        <strong>{pendingUsers.length}</strong>
                        <em>Needs review</em>
                    </article>
                    <article className="hr-hub-metric-card">
                        <span>Total Employees</span>
                        <strong>{fieldStaff.filter(m => m.status === "approved").length}</strong>
                        <em>Approved staff</em>
                    </article>
                    <article className="hr-hub-metric-card hr-hub-metric-alert">
                        <span>Pending Documents</span>
                        <strong>{fieldStaff.filter(m => !m.staffProfile?.eligibility?.documentUpload?.url || !m.staffProfile?.eligibility?.photoIdUpload?.url).length}</strong>
                        <em>Compliance required</em>
                    </article>
                </div>

                <div className="hr-hub-grid">
                    <section className="hr-hub-panel">
                        <div className="cleaner-section-head"><h4>Recruitment Pipeline</h4><span>View All</span></div>
                        <div className="hr-hub-list">
                            {pendingUsers.length === 0 ? (
                                <div className="admin-cart-empty">No pending recruitment records right now.</div>
                            ) : pendingUsers.slice(0, 4).map(user => (
                                <article key={user.uid} className="hr-hub-list-item">
                                    <div>
                                        <strong>{user.name}</strong>
                                        <span>{getRoleLabel(user.role)} · {user.branchName || activeBranch?.name}</span>
                                    </div>
                                    <em>{user.status === "pending_approval" ? "Awaiting approval" : "Ready"}</em>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="hr-hub-panel">
                        <div className="cleaner-section-head"><h4>Onboarding Tasks</h4><span>{fieldStaff.length}</span></div>
                        <div className="hr-hub-list">
                            {fieldStaff.slice(0, 4).map(member => {
                                const missingPermit = !member.staffProfile?.eligibility?.documentUpload?.url;
                                const missingPhotoId = !member.staffProfile?.eligibility?.photoIdUpload?.url;
                                return (
                                    <article key={member.uid} className="hr-hub-list-item">
                                        <div>
                                            <strong>{member.name}</strong>
                                            <span>{missingPermit || missingPhotoId ? "Documents pending" : "Onboarding complete"}</span>
                                        </div>
                                        <em>{missingPermit || missingPhotoId ? "Action Required" : "Ready"}</em>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section className="hr-hub-panel">
                        <div className="cleaner-section-head"><h4>Staff Directory</h4><span>{fieldStaff.length}</span></div>
                        <div className="hr-hub-list">
                            {fieldStaff.slice(0, 5).map(member => (
                                <article key={member.uid} className="hr-hub-list-item">
                                    <div>
                                        <strong>{member.name}</strong>
                                        <span>{getRoleLabel(member.role)} · {member.branchName || activeBranch?.name}</span>
                                    </div>
                                    <em>{member.status}</em>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="hr-hub-panel hr-hub-panel-alert">
                        <div className="cleaner-section-head"><h4>Compliance</h4><span>Attention</span></div>
                        <p>Track photo ID, work permit, background check, and insurance readiness before cleaners go fully active.</p>
                        <div className="hr-hub-compliance-list">
                            <div><strong>{fieldStaff.filter(m => !m.staffProfile?.eligibility?.photoIdUpload?.url).length}</strong><span>Missing photo ID</span></div>
                            <div><strong>{fieldStaff.filter(m => !m.staffProfile?.eligibility?.documentUpload?.url).length}</strong><span>Missing work permit</span></div>
                            <div><strong>{fieldStaff.filter(m => !m.staffProfile?.compliance?.backgroundCheckStatus).length}</strong><span>Background checks pending</span></div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
