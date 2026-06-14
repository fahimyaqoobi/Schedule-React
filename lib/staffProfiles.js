const STAFF_PROFILE_TEMPLATE = {
    personal: {
        legalName: "",
        preferredName: "",
        phone: "",
        dateOfBirth: "",
        address: "",
        city: "",
        province: "ON",
        postalCode: ""
    },
    emergency: {
        contactName: "",
        relationship: "",
        phone: ""
    },
    employment: {
        workerType: "",
        yearsExperience: "",
        languages: "",
        tshirtSize: "",
        availabilityNotes: ""
    },
    eligibility: {
        workStatus: "",
        workPermitExpiry: "",
        sinLast4: "",
        hasDriversLicense: false,
        driversLicenseClass: "",
        hasVehicle: false
    },
    compliance: {
        backgroundCheckStatus: "",
        backgroundCheckExpiry: "",
        insuranceStatus: "",
        insuranceExpiry: "",
        contractSigned: false,
        trainingStatus: ""
    },
    notes: ""
};

const STAFF_PROFILE_META_TEMPLATE = {
    status: "incomplete",
    approvedAt: "",
    lastSubmittedAt: "",
    lastEligibilityUpdateAt: "",
    lastAdminReviewAt: "",
    rejectionReason: ""
};

export const STAFF_SELF_SERVICE_ROLES = ["cleaner", "subcontractor", "employee", "supervisor"];
export const ELIGIBILITY_EDIT_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export function cloneStaffProfileTemplate() {
    return JSON.parse(JSON.stringify(STAFF_PROFILE_TEMPLATE));
}

export function cloneStaffProfileMetaTemplate() {
    return { ...STAFF_PROFILE_META_TEMPLATE };
}

export function normalizeStaffProfile(profile = {}) {
    return {
        personal: { ...STAFF_PROFILE_TEMPLATE.personal, ...(profile.personal || {}) },
        emergency: { ...STAFF_PROFILE_TEMPLATE.emergency, ...(profile.emergency || {}) },
        employment: { ...STAFF_PROFILE_TEMPLATE.employment, ...(profile.employment || {}) },
        eligibility: { ...STAFF_PROFILE_TEMPLATE.eligibility, ...(profile.eligibility || {}) },
        compliance: { ...STAFF_PROFILE_TEMPLATE.compliance, ...(profile.compliance || {}) },
        notes: typeof profile.notes === "string" ? profile.notes : STAFF_PROFILE_TEMPLATE.notes
    };
}

export function normalizeStaffProfileMeta(meta = {}) {
    return {
        ...STAFF_PROFILE_META_TEMPLATE,
        ...(meta || {})
    };
}

export function normalizeStaffMember(member = {}) {
    const personalProfile = normalizeStaffProfile(member.staffProfile);
    return {
        ...member,
        staffProfile: personalProfile,
        staffProfileMeta: normalizeStaffProfileMeta(member.staffProfileMeta),
        staffProfileRequest: member.staffProfileRequest || null
    };
}

export function getChangedStaffProfileSections(currentProfile = {}, nextProfile = {}) {
    const normalizedCurrent = normalizeStaffProfile(currentProfile);
    const normalizedNext = normalizeStaffProfile(nextProfile);
    return Object.keys(normalizedCurrent).filter((section) => {
        return JSON.stringify(normalizedCurrent[section]) !== JSON.stringify(normalizedNext[section]);
    });
}

export function isEligibilityOnlyChange(changedSections = []) {
    return changedSections.length > 0 && changedSections.every((section) => section === "eligibility");
}

export function canSelfEditEligibility(meta = {}, now = Date.now()) {
    const normalizedMeta = normalizeStaffProfileMeta(meta);
    if (!normalizedMeta.approvedAt) return true;
    if (!normalizedMeta.lastEligibilityUpdateAt) return true;
    return now - new Date(normalizedMeta.lastEligibilityUpdateAt).getTime() >= ELIGIBILITY_EDIT_COOLDOWN_MS;
}
