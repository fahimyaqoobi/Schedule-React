"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function PermissionsTab({ ROLE_DEFINITIONS, DEPARTMENTS }) {
    return (
        <div className="animate-fade flex flex-col gap-4">
            <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Access control</p>
                        <CardTitle className="text-xl">Permissions &amp; Roles</CardTitle>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Legacy roles remain compatible while we introduce real departments, branch rules, and people management.
                        </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Super Admin controlled</Badge>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(ROLE_DEFINITIONS).map(([roleId, definition]) => (
                    <Card key={roleId}>
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground">{definition.label}</h4>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{definition.description}</p>
                                </div>
                                <Badge variant="outline" className="shrink-0 text-[10px]">{roleId}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {DEPARTMENTS.map(department => (
                                    <Badge
                                        key={department.id}
                                        variant={definition.departments.includes(department.id) ? "default" : "secondary"}
                                        className={cn("text-[10px]", !definition.departments.includes(department.id) && "opacity-50")}
                                    >
                                        {department.name}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex flex-col gap-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
                                <span>{definition.canSwitchBranches ? "Can switch branches" : "Branch scoped"}</span>
                                <span>{definition.canManagePermissions ? "Can manage permissions" : "No permission edits"}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Communication infrastructure</p>
                    <CardTitle className="text-lg">Email, SMS, and App Push Requirements</CardTitle>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        To send reminders from info@smartouchclean.com and notify customers, cleaners, supervisors, and admins,
                        the app needs these production services connected.
                    </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                        ["Email", "SendGrid, Resend, Postmark, or Gmail Workspace SMTP with SPF/DKIM/DMARC configured for smartouchclean.com."],
                        ["SMS / Phone", "Twilio or Telnyx number, consent tracking, opt-out handling, and customer/cleaner phone verification."],
                        ["Web Push", "PWA manifest, service worker, VAPID keys, browser permission prompts, and saved push subscriptions per user/device."],
                        ["In-App Notes", "Firestore notifications collection for supervisor notes, admin alerts, job comments, unread counts, and audit trail."],
                    ].map(([title, desc]) => (
                        <div key={title} className="rounded-lg border border-border p-3.5">
                            <p className="text-sm font-bold text-foreground">{title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
