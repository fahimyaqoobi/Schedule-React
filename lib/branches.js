export const DEFAULT_BRANCH_ID = "ottawa-ca";

export const BRANCHES = [
    {
        id: DEFAULT_BRANCH_ID,
        name: "Ottawa",
        country: "Canada",
        countryCode: "CA",
        province: "Ontario",
        city: "Ottawa",
        timezone: "America/Toronto",
        currency: "CAD",
        taxLabel: "HST",
        taxRate: 0.13,
        phone: "",
        email: "info@smartouchclean.com",
        manager: "",
        serviceAreas: ["Ottawa", "Nepean", "Kanata", "Orleans", "Barrhaven", "Gloucester", "Vanier"],
        postalPrefixes: ["K1", "K2", "K4"],
        status: "active"
    }
];

export function getBranchById(branchId = DEFAULT_BRANCH_ID) {
    return BRANCHES.find(branch => branch.id === branchId) || BRANCHES[0];
}

export function normalizePostalPrefix(postalCode = "") {
    return String(postalCode).trim().toUpperCase().replace(/\s+/g, "").slice(0, 2);
}

export function findBranchForAddress(address = {}) {
    const city = String(address.city || "").trim().toLowerCase();
    const country = String(address.country || "").trim().toLowerCase();
    const postalPrefix = normalizePostalPrefix(address.postalCode);

    const branch = BRANCHES.find(candidate => {
        const countryMatches = !country || [candidate.country, candidate.countryCode]
            .filter(Boolean)
            .some(value => String(value).toLowerCase() === country);
        const cityMatches = candidate.serviceAreas
            .some(area => area.toLowerCase() === city || city.includes(area.toLowerCase()));
        const postalMatches = candidate.postalPrefixes
            .some(prefix => postalPrefix.startsWith(prefix.toUpperCase()));

        return countryMatches && (cityMatches || postalMatches);
    });

    return branch || null;
}

export function getUserBranchIds(user = {}) {
    if (Array.isArray(user.branchIds) && user.branchIds.length > 0) return user.branchIds;
    if (user.branchId) return [user.branchId];
    return [DEFAULT_BRANCH_ID];
}

export function userCanAccessBranch(user = {}, branchId = DEFAULT_BRANCH_ID) {
    if (user.role === "super-admin" || user.role === "admin") return true;
    return getUserBranchIds(user).includes(branchId);
}

export function getBranchScopeForUser(user = {}) {
    if (user.role === "super-admin" || user.role === "admin") {
        return {
            canSwitchBranches: true,
            branchIds: BRANCHES.map(branch => branch.id),
            activeBranchId: user.activeBranchId || user.branchId || DEFAULT_BRANCH_ID
        };
    }

    const branchIds = getUserBranchIds(user);
    return {
        canSwitchBranches: false,
        branchIds,
        activeBranchId: branchIds[0] || DEFAULT_BRANCH_ID
    };
}

export function buildBranchRecordFields(branch, user = {}) {
    return {
        branchId: branch.id,
        branchName: branch.name,
        country: branch.country,
        timezone: branch.timezone,
        currency: branch.currency,
        taxLabel: branch.taxLabel,
        taxRate: branch.taxRate,
        createdBy: user.email || "",
        updatedBy: user.email || ""
    };
}

export function createDefaultBranchUserFields(role = "customer") {
    const branch = getBranchById(DEFAULT_BRANCH_ID);
    const isSuperAdmin = role === "super-admin" || role === "admin";
    return {
        branchId: branch.id,
        branchIds: isSuperAdmin ? BRANCHES.map(item => item.id) : [branch.id],
        branchName: branch.name,
        country: branch.country,
        timezone: branch.timezone,
        currency: branch.currency
    };
}
