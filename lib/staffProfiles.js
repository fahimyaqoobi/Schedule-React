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
    availability: {
        maxJobsPerDay: 3,
        weekdays: [
            { label: "M", enabled: true },
            { label: "T", enabled: true },
            { label: "W", enabled: true },
            { label: "T", enabled: true },
            { label: "F", enabled: true },
            { label: "S", enabled: false },
            { label: "S", enabled: false }
        ],
        shifts: {
            morning: true,
            afternoon: true,
            evening: false
        },
        blockedDates: []
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
export const AVAILABILITY_APPROVAL_WINDOW_MS = 48 * 60 * 60 * 1000;
export const STAFF_APPROVAL_REQUIRED_SECTIONS = ["personal", "emergency", "employment", "eligibility", "compliance", "notes"];
export const STAFF_SELF_EDITABLE_SECTIONS = ["availability"];
const WEEKDAY_INDEX_TO_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

function getAvailabilityWeekdayIndex(dateWeekday) {
    return dateWeekday === 0 ? 6 : dateWeekday - 1;
}

export function cloneStaffProfileTemplate() {
    return JSON.parse(JSON.stringify(STAFF_PROFILE_TEMPLATE));
}

export function cloneStaffProfileMetaTemplate() {
    return { ...STAFF_PROFILE_META_TEMPLATE };
}

export function normalizeStaffProfile(profile = {}) {
    const availability = profile.availability || {};
    return {
        personal: { ...STAFF_PROFILE_TEMPLATE.personal, ...(profile.personal || {}) },
        emergency: { ...STAFF_PROFILE_TEMPLATE.emergency, ...(profile.emergency || {}) },
        employment: { ...STAFF_PROFILE_TEMPLATE.employment, ...(profile.employment || {}) },
        availability: {
            ...STAFF_PROFILE_TEMPLATE.availability,
            ...availability,
            weekdays: Array.isArray(availability.weekdays) && availability.weekdays.length
                ? availability.weekdays.map((day, index) => ({
                    ...(STAFF_PROFILE_TEMPLATE.availability.weekdays[index] || STAFF_PROFILE_TEMPLATE.availability.weekdays[0]),
                    ...day
                }))
                : STAFF_PROFILE_TEMPLATE.availability.weekdays.map(day => ({ ...day })),
            shifts: {
                ...STAFF_PROFILE_TEMPLATE.availability.shifts,
                ...(availability.shifts || {})
            },
            blockedDates: Array.isArray(availability.blockedDates) ? availability.blockedDates : []
        },
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

export function isAvailabilityOnlyChange(changedSections = []) {
    return changedSections.length > 0 && changedSections.every((section) => section === "availability");
}

export function canSelfEditEligibility(meta = {}, now = Date.now()) {
    const normalizedMeta = normalizeStaffProfileMeta(meta);
    if (!normalizedMeta.approvedAt) return true;
    if (!normalizedMeta.lastEligibilityUpdateAt) return true;
    return now - new Date(normalizedMeta.lastEligibilityUpdateAt).getTime() >= ELIGIBILITY_EDIT_COOLDOWN_MS;
}

function startOfLocalDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function hasAvailabilityWindowConflictForDate(currentAvailability, nextAvailability, date) {
    const weekdayIndex = getAvailabilityWeekdayIndex(date.getDay());
    const currentDay = currentAvailability.weekdays?.[weekdayIndex];
    const nextDay = nextAvailability.weekdays?.[weekdayIndex];

    if (Boolean(currentDay?.enabled) !== Boolean(nextDay?.enabled)) {
        return true;
    }

    if (JSON.stringify(currentAvailability.shifts || {}) !== JSON.stringify(nextAvailability.shifts || {})) {
        return true;
    }

    if ((currentAvailability.maxJobsPerDay || 0) !== (nextAvailability.maxJobsPerDay || 0)) {
        return true;
    }

    const isoDate = toDateInputValue(date);
    const currentBlocked = new Set(currentAvailability.blockedDates || []);
    const nextBlocked = new Set(nextAvailability.blockedDates || []);
    return currentBlocked.has(isoDate) !== nextBlocked.has(isoDate);
}

export function availabilityNeedsAdminApproval(currentAvailability = {}, nextAvailability = {}, now = Date.now()) {
    const normalizedCurrent = normalizeStaffProfile({ availability: currentAvailability }).availability;
    const normalizedNext = normalizeStaffProfile({ availability: nextAvailability }).availability;

    if (JSON.stringify(normalizedCurrent) === JSON.stringify(normalizedNext)) {
        return false;
    }

    const windowEnd = new Date(now + AVAILABILITY_APPROVAL_WINDOW_MS);
    const cursor = new Date(now);
    while (cursor <= windowEnd) {
        if (hasAvailabilityWindowConflictForDate(normalizedCurrent, normalizedNext, cursor)) {
            return true;
        }
        cursor.setHours(cursor.getHours() + 12);
    }

    const currentBlocked = new Set(normalizedCurrent.blockedDates || []);
    const nextBlocked = new Set(normalizedNext.blockedDates || []);
    for (const value of new Set([...currentBlocked, ...nextBlocked])) {
        const blockedDate = startOfLocalDay(new Date(`${value}T00:00:00`));
        if (Number.isNaN(blockedDate.getTime())) continue;
        if (blockedDate <= windowEnd && blockedDate >= startOfLocalDay(new Date(now))) {
            if (currentBlocked.has(value) !== nextBlocked.has(value)) {
                return true;
            }
        }
    }

    return false;
}

export function buildAvailabilitySnapshot(availability = {}) {
    const normalized = normalizeStaffProfile({ availability }).availability;
    const weekdayStatus = normalized.weekdays.map((day, index) => ({
        label: day.label || WEEKDAY_INDEX_TO_LABEL[index],
        status: day.enabled ? "A" : "P"
    }));

    return {
        maxJobsPerDay: normalized.maxJobsPerDay || 0,
        weekdays: weekdayStatus,
        shifts: [
            { label: "Morning (08:00 - 12:00)", active: Boolean(normalized.shifts.morning) },
            { label: "Afternoon (13:00 - 17:00)", active: Boolean(normalized.shifts.afternoon) },
            { label: "Evening (18:00+)", active: Boolean(normalized.shifts.evening) }
        ],
        blockedDates: normalized.blockedDates
    };
}
