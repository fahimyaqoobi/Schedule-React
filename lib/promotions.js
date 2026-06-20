export const DEFAULT_PROMOTIONS = [
    {
        id: "promo_next30",
        code: "NEXT30",
        name: "Next Service $30 Off",
        type: "fixed",
        value: 30,
        active: true,
        oneTimeOnly: true,
        stackable: false,
        soloOnly: true,
        repeatable: false,
        referralRequired: false,
        showOnDocuments: true,
        description: "Single-use welcome credit for a future booking."
    },
    {
        id: "promo_refer30",
        code: "REFER30",
        name: "Refer and Save",
        type: "referral",
        value: 30,
        active: true,
        oneTimeOnly: false,
        stackable: false,
        soloOnly: true,
        repeatable: true,
        referralRequired: true,
        showOnDocuments: true,
        description: "Referral credit after the referred customer completes a paid booking."
    }
];

export function normalizePhoneNumber(value = "") {
    return String(value).replace(/\D+/g, "");
}

export function generateReferralCode(phone = "", documentNumber = "", customerName = "") {
    const digits = normalizePhoneNumber(phone);
    const phonePart = digits.slice(-4) || "0000";
    const numberPart = String(documentNumber || "").replace(/[^0-9]/g, "").slice(-4) || "0001";
    const namePart = String(customerName || "STC")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3)
        .padEnd(3, "X");
    return `STC-${namePart}${phonePart}-${numberPart}`;
}

export function buildCustomerPortalUrl(origin = "", booking = {}) {
    const params = new URLSearchParams();
    if (booking.phone) params.set("phone", normalizePhoneNumber(booking.phone));
    if (booking.estimateNumber || booking.invoiceNumber || booking.orderNumber) {
        params.set("document", booking.invoiceNumber || booking.estimateNumber || booking.orderNumber);
    }
    if (booking.id) params.set("bookingId", booking.id);
    return `${origin}/customer-access?${params.toString()}`;
}

export function ensurePromotionList(value) {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_PROMOTIONS;
    return value.map((promo, index) => ({
        id: promo.id || `promo_${index + 1}`,
        code: promo.code || `PROMO${index + 1}`,
        name: promo.name || "Promotion",
        type: promo.type || "fixed",
        value: Number(promo.value || 0),
        active: promo.active !== false,
        oneTimeOnly: Boolean(promo.oneTimeOnly),
        stackable: Boolean(promo.stackable),
        soloOnly: Boolean(promo.soloOnly),
        repeatable: Boolean(promo.repeatable),
        referralRequired: Boolean(promo.referralRequired),
        showOnDocuments: promo.showOnDocuments !== false,
        description: promo.description || ""
    }));
}

export function getDocumentPromotions(value) {
    if (Array.isArray(value) && value.length === 0) return [];
    return ensurePromotionList(value)
        .filter((promo) => promo.active !== false && promo.showOnDocuments !== false)
        .map((promo) => ({
            ...promo,
            displayValue: promo.type === "percent"
                ? `${Number(promo.value || 0)}% off`
                : promo.type === "referral"
                    ? `$${Number(promo.value || 0).toFixed(0)} referral credit`
                    : `$${Number(promo.value || 0).toFixed(0)} off`
        }));
}
