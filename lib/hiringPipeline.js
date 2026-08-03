import { roleHasDepartment, roleHasPermission, canManageBranch, canManageSystem } from "./permissions";

// Single source of truth for hiring-pipeline stage metadata — mirrors
// lib/bookingStatus.js's shape so the Pipeline Board's Kanban columns and
// any small stage badges never visually drift apart.
//
// "job_posted" is intentionally NOT a candidate stage: every application
// that exists came from a posted job, so it's implicit in the application's
// existence rather than a state a candidate sits in. The first real stage a
// submitted application is in is "application_review".
export const HIRING_STAGES = [
    { value: "application_review", label: "Application Review", color: "#78716c", bg: "#fafaf9", border: "#e7e5e4", fill: "#78716c", fillText: "#ffffff" },
    { value: "interview", label: "Interview", color: "#a16207", bg: "#fefce8", border: "#fef08a", fill: "#a16207", fillText: "#ffffff" },
    { value: "initial_orientation", label: "Initial Orientation", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", fill: "#7c3aed", fillText: "#ffffff" },
    { value: "job_site_interview", label: "Job Site Interview", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", fill: "#6366f1", fillText: "#ffffff" },
    { value: "job_quality_check", label: "Job Quality Check", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", fill: "#0891b2", fillText: "#ffffff" },
    { value: "final_safety_onboarding", label: "Final Safety & Onboarding", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", fill: "#ea580c", fillText: "#ffffff" },
    { value: "approval_for_scheduling", label: "Approval for Scheduling", color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4", fill: "#0d9488", fillText: "#ffffff" },
    { value: "hired", label: "★ Hired", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", fill: "#16a34a", fillText: "#ffffff" },
];

// Terminal, non-advancing outcomes reachable from any active stage above.
export const HIRING_TERMINAL_STATUSES = [
    { value: "rejected", label: "✕ Rejected", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", fill: "#dc2626", fillText: "#ffffff" },
    { value: "withdrawn", label: "Withdrawn", color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0", fill: "#64748b", fillText: "#ffffff" },
];

export const ALL_HIRING_STATUSES = [...HIRING_STAGES, ...HIRING_TERMINAL_STATUSES];

const UNKNOWN_STAGE_META = { label: "", color: "#64748b", bg: "#f1f5f9", border: "#e2e8f0", fill: "#64748b", fillText: "#ffffff" };

export function getStageMeta(status) {
    const known = ALL_HIRING_STATUSES.find(o => o.value === status);
    if (known) return known;
    return { ...UNKNOWN_STAGE_META, label: status || "Unknown" };
}

// Ordered stage identifiers a candidate advances through, active stages only
// (excludes the terminal "hired"/"rejected"/"withdrawn" outcomes).
export const HIRING_STAGE_ORDER = HIRING_STAGES.filter(s => s.value !== "hired").map(s => s.value);

export function getNextStage(currentStage) {
    const index = HIRING_STAGE_ORDER.indexOf(currentStage);
    if (index === -1 || index === HIRING_STAGE_ORDER.length - 1) return "hired";
    return HIRING_STAGE_ORDER[index + 1];
}

// Which stages require a document upload alongside the structured
// actor/date/decision/notes capture (compliance-bearing stages only).
export const STAGES_REQUIRING_DOCUMENT = ["final_safety_onboarding"];

// Worker-type taxonomy the public apply form offers — constrained to the
// same 4 roles GET /api/users?type=field-staff already scopes to, since
// that's the only role set lib/staffProfiles.js and lib/permissions.js
// understand for field staff.
export const WORKER_TYPE_OPTIONS = [
    { value: "cleaner", label: "Cleaner" },
    { value: "supervisor", label: "Supervisor" },
    { value: "employee", label: "Employee" },
    { value: "subcontractor", label: "Subcontractor" },
];

// Maps each pipeline stage to the least-privileged EXISTING permission
// primitive that can act on it — reused verbatim from lib/permissions.js,
// no new granular permission types invented. `stage` is the CURRENT stage
// being reviewed/advanced/rejected (not the destination stage).
export function canActOnHiringStage(user, stage) {
    switch (stage) {
        case "application_review":
        case "interview":
        case "initial_orientation":
        case "job_site_interview":
            return roleHasDepartment(user?.role, "people");
        case "job_quality_check":
            return roleHasPermission(user?.role, "quality.approve");
        case "final_safety_onboarding":
            return canManageBranch(user);
        case "approval_for_scheduling":
            return canManageSystem(user);
        default:
            return false;
    }
}

// Every stage-transition write follows this same shape (actor/date/decision/
// notes, optional document) — one uniform record type for all 6 review-type
// stages, so a single form + write-helper handles every transition instead
// of 6 bespoke shapes.
export function buildStageEntry({ actor, decision, notes = "", documentUrl = "", documentName = "" } = {}) {
    return {
        actor: actor || "",
        date: new Date().toISOString(),
        decision: decision || "pass",
        notes,
        ...(documentUrl ? { documentUrl, documentName } : {}),
    };
}

// Mirrors lib/staffProfiles.js's cloneStaffProfileTemplate() pattern — the
// canonical empty shape for a new job_applications Firestore doc.
export function cloneJobApplicationTemplate() {
    return {
        applicationToken: "",
        branchId: "",
        workerTypeInterest: "",
        personal: {
            legalName: "",
            email: "",
            phone: "",
            city: "",
            province: "ON",
            resumeUrl: "",
            resumeFileName: "",
            coverNote: "",
        },
        status: "application_review",
        currentStageEnteredAt: new Date().toISOString(),
        stages: {},
        rejection: null,
        withdrawal: null,
        convertedToUid: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "public_apply",
    };
}
