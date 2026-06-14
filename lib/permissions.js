export const DEPARTMENTS = [
    {
        id: "operations",
        name: "Operations",
        description: "Bookings, dispatch, jobs, calendars, service completion, and supervisor review.",
        modules: ["Dashboard", "Bookings", "Calendar", "Jobs", "Edit Review"]
    },
    {
        id: "people",
        name: "People Management",
        description: "Cleaners, crews, supervisors, HR records, work eligibility, ratings, and documents.",
        modules: ["Teams", "Cleaners", "Crews", "HR"]
    },
    {
        id: "sales",
        name: "Sales & Customers",
        description: "Leads, quotes, customer portal, promos, discounts, and customer follow-up.",
        modules: ["Leads", "Customer Portal", "Promotions"]
    },
    {
        id: "inventory",
        name: "Supply Management",
        description: "Cleaning supplies, supplier directory, purchase orders, stock levels, and project supplies.",
        modules: ["Inventory", "Suppliers", "Purchase Orders", "Projects"]
    },
    {
        id: "fleet",
        name: "Tools, Equipment & Fleet",
        description: "Vehicles, tools, equipment, maintenance, licenses, and crew assignments.",
        modules: ["Fleet", "Tools", "Equipment", "Maintenance"]
    },
    {
        id: "finance",
        name: "Finance",
        description: "Invoices, payments, payroll, cleaner bonuses, customer discounts, and branch currencies.",
        modules: ["Invoices", "Payments", "Payroll", "Bonuses"]
    },
    {
        id: "administration",
        name: "Administration",
        description: "Branches, catalog studio, settings, permissions, audit logs, and system configuration.",
        modules: ["Catalog Studio", "Settings", "Permissions", "Branches"]
    }
];

export const ROLE_DEFINITIONS = {
    "super-admin": {
        label: "Super Admin",
        legacyRoles: ["admin"],
        portal: "Admin Portal",
        departments: DEPARTMENTS.map((department) => department.id),
        permissions: ["*"],
        canSwitchBranches: true,
        canManagePermissions: true,
        description: "Global owner with access to every branch, department, catalog, and permission."
    },
    "branch-admin": {
        label: "Branch Admin",
        portal: "Admin Portal",
        departments: ["operations", "people", "sales", "inventory", "fleet", "finance", "administration"],
        permissions: ["dashboard.view", "booking.create", "booking.manage", "jobs.manage", "customers.manage", "people.manage", "inventory.manage", "finance.manage", "reports.view", "settings.branch"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Runs one branch across bookings, people, supplies, finance, and settings."
    },
    supervisor: {
        label: "Supervisor",
        portal: "Supervisor Portal",
        departments: ["operations", "people", "fleet"],
        permissions: ["jobs.assign", "jobs.review", "schedule.manage", "cleaners.rate", "quality.approve", "editRequests.approve"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Controls schedules, crews, job review, quality checks, and field operations."
    },
    cleaner: {
        label: "Cleaner",
        legacyRoles: ["team-leader"],
        portal: "Cleaner Portal",
        departments: ["operations"],
        permissions: ["jobs.own.view", "jobs.own.start", "jobs.own.checklist", "jobs.own.photos", "jobs.own.complete", "schedule.own.view"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Sees assigned jobs, checklists, live job tools, and schedule details."
    },
    "sales-team": {
        label: "Sales Team",
        legacyRoles: ["sales"],
        portal: "Sales Portal",
        departments: ["sales", "operations"],
        permissions: ["leads.manage", "quotes.create", "customers.view", "booking.create", "discount.request", "sales.performance.view"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Handles leads, quotes, customer booking flow, and follow-up."
    },
    employee: {
        label: "Employee",
        portal: "Employee Portal",
        departments: ["operations"],
        permissions: ["dashboard.view", "assignedModules.view"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Internal staff profile with branch-scoped operational access."
    },
    subcontractor: {
        label: "Subcontractor",
        portal: "Cleaner Portal",
        departments: ["operations"],
        permissions: ["jobs.own.view", "jobs.own.start", "jobs.own.checklist", "jobs.own.photos", "jobs.own.complete", "schedule.own.view", "pay.own.view"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "External cleaner or crew with restricted assigned-job access."
    },
    customer: {
        label: "Customer",
        legacyRoles: ["customer"],
        portal: "Customer Portal",
        departments: ["sales"],
        permissions: ["booking.own.create", "booking.own.view", "booking.own.changeRequest", "invoices.own.view", "promos.own.view", "profile.own.manage"],
        canSwitchBranches: false,
        canManagePermissions: false,
        description: "Customer portal access for bookings, reminders, invoices, and promos."
    }
};

export const ROLE_OPTIONS = Object.entries(ROLE_DEFINITIONS).map(([id, role]) => ({
    id,
    label: role.label
}));

export function normalizeRole(role) {
    if (!role) return "customer";
    if (ROLE_DEFINITIONS[role]) return role;
    const match = Object.entries(ROLE_DEFINITIONS).find(([, definition]) =>
        definition.legacyRoles?.includes(role)
    );
    return match ? match[0] : role;
}

export function getRoleDefinition(role) {
    return ROLE_DEFINITIONS[normalizeRole(role)] || ROLE_DEFINITIONS.customer;
}

export function getRoleLabel(role) {
    return getRoleDefinition(role).label;
}

export function roleHasDepartment(role, departmentId) {
    return getRoleDefinition(role).departments.includes(departmentId);
}

export function roleHasPermission(role, permission) {
    const permissions = getRoleDefinition(role).permissions || [];
    return permissions.includes("*") || permissions.includes(permission);
}

export function canManageSystem(user) {
    return Boolean(getRoleDefinition(user?.role).canManagePermissions);
}

export function canManageBranch(user) {
    return ["super-admin", "branch-admin", "admin"].includes(user?.role) || normalizeRole(user?.role) === "super-admin";
}
