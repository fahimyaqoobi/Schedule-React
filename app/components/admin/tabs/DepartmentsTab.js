"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader className="flex-row flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Organization</p>
                        <CardTitle className="text-xl">Departments</CardTitle>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">View every operating department, its responsibilities, and the modules connected to it.</p>
                    </div>
                    <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">{DEPARTMENTS.length} Departments</Badge>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {DEPARTMENTS.map((department, index) => {
                        const targetTab = DEPARTMENT_TAB_TARGETS[department.id];
                        const hasAccess = canViewDepartment(department.id);
                        return (
                            <Card key={department.id} className="overflow-hidden p-0">
                                <div className={cn("h-1.5 bg-gradient-to-r", ACCENTS[index % ACCENTS.length])} />
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="rounded-xl bg-primary/10 p-3 text-primary"><LayoutGrid className="size-5" /></div>
                                        <Badge variant={hasAccess ? "default" : "secondary"} className={hasAccess ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                                            {hasAccess ? "Available" : "Restricted"}
                                        </Badge>
                                    </div>
                                    <h4 className="mt-4 text-lg font-black text-foreground">{department.name}</h4>
                                    <p className="mt-2 min-h-[60px] text-sm leading-6 text-muted-foreground">{department.description}</p>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {department.modules.map(module => (
                                            <Badge key={module} variant="outline" className="text-[11px] font-bold">{module}</Badge>
                                        ))}
                                    </div>
                                    <Button
                                        variant="secondary"
                                        disabled={!hasAccess || !targetTab}
                                        onClick={() => targetTab && setActiveTab(targetTab)}
                                        className="mt-4 w-full"
                                    >
                                        {!hasAccess ? "Access Restricted" : targetTab ? "Open Department" : "Workspace Coming Next"}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">People Management</p>
                        <CardTitle className="text-lg">People Management Department</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">Recruitment, onboarding, staff directory, and compliance for the current branch.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">Post New Job</Button>
                        <Button size="sm" onClick={() => setActiveTab("teams")}>Open Staff Profiles</Button>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                            ["Open Roles", Math.max(3, pendingUsers.length), "Recruitment active"],
                            ["New Applications", pendingUsers.length, "Needs review"],
                            ["Total Employees", fieldStaff.filter(m => m.status === "approved").length, "Approved staff"],
                            ["Pending Documents", fieldStaff.filter(m => !m.staffProfile?.eligibility?.documentUpload?.url || !m.staffProfile?.eligibility?.photoIdUpload?.url).length, "Compliance required", true],
                        ].map(([label, value, sub, alert]) => (
                            <div key={label} className={cn("rounded-lg border p-3.5", alert ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : "border-border")}>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-foreground">Recruitment Pipeline</h4>
                                    <span className="text-xs font-semibold text-primary">View All</span>
                                </div>
                                <div className="flex flex-col divide-y divide-border">
                                    {pendingUsers.length === 0 ? (
                                        <p className="py-4 text-sm text-muted-foreground">No pending recruitment records right now.</p>
                                    ) : pendingUsers.slice(0, 4).map(user => (
                                        <div key={user.uid} className="flex items-center justify-between py-2.5">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{getRoleLabel(user.role)} · {user.branchName || activeBranch?.name}</p>
                                            </div>
                                            <span className="text-xs italic text-muted-foreground">{user.status === "pending_approval" ? "Awaiting approval" : "Ready"}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-foreground">Onboarding Tasks</h4>
                                    <Badge variant="secondary">{fieldStaff.length}</Badge>
                                </div>
                                <div className="flex flex-col divide-y divide-border">
                                    {fieldStaff.slice(0, 4).map(member => {
                                        const missingPermit = !member.staffProfile?.eligibility?.documentUpload?.url;
                                        const missingPhotoId = !member.staffProfile?.eligibility?.photoIdUpload?.url;
                                        const pending = missingPermit || missingPhotoId;
                                        return (
                                            <div key={member.uid} className="flex items-center justify-between py-2.5">
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground">{pending ? "Documents pending" : "Onboarding complete"}</p>
                                                </div>
                                                <Badge variant={pending ? "outline" : "secondary"} className={pending ? "border-amber-300 text-amber-700" : ""}>
                                                    {pending ? "Action Required" : "Ready"}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-foreground">Staff Directory</h4>
                                    <Badge variant="secondary">{fieldStaff.length}</Badge>
                                </div>
                                <div className="flex flex-col divide-y divide-border">
                                    {fieldStaff.slice(0, 5).map(member => (
                                        <div key={member.uid} className="flex items-center justify-between py-2.5">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{member.name}</p>
                                                <p className="text-xs text-muted-foreground">{getRoleLabel(member.role)} · {member.branchName || activeBranch?.name}</p>
                                            </div>
                                            <span className="text-xs italic text-muted-foreground">{member.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                            <CardContent className="p-4">
                                <div className="mb-2 flex items-center gap-1.5">
                                    <TriangleAlert className="size-4 text-amber-600" />
                                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Compliance</h4>
                                </div>
                                <p className="text-xs text-amber-900 dark:text-amber-200">Track photo ID, work permit, background check, and insurance readiness before cleaners go fully active.</p>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                    {[
                                        [fieldStaff.filter(m => !m.staffProfile?.eligibility?.photoIdUpload?.url).length, "Missing photo ID"],
                                        [fieldStaff.filter(m => !m.staffProfile?.eligibility?.documentUpload?.url).length, "Missing work permit"],
                                        [fieldStaff.filter(m => !m.staffProfile?.compliance?.backgroundCheckStatus).length, "Background checks pending"],
                                    ].map(([count, label]) => (
                                        <div key={label}>
                                            <p className="text-xl font-black text-amber-800 dark:text-amber-300">{count}</p>
                                            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-400">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
