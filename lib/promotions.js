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

/* ============================================================
   PROMO + REWARDS ENGINE (pure, shared by client preview and
   server-authoritative validation). No side effects — callers
   supply the customer's prior usage so this stays deterministic
   and unit-testable.
   ============================================================ */

export function normalizePromoCode(value = "") {
    return String(value || "").trim().toUpperCase();
}

function round2(n) {
    return Number((Math.round((Number(n) || 0) * 100) / 100).toFixed(2));
}

const PROMO_REASONS = {
    empty: "Enter a promo code.",
    not_found: "That code isn't valid.",
    inactive: "This promotion is no longer active.",
    already_used: "You've already redeemed this one-time code.",
    referral_required: "This reward unlocks once a friend you referred completes a paid booking.",
    minimum_not_met: "Your cart doesn't meet this code's minimum yet.",
    no_subtotal: "Add a service before applying a code."
};

/**
 * Validate a promo code and compute its discount against a subtotal.
 * Pure: pass in `customerUsage` (the codes this customer already redeemed)
 * and `referralCredits` so the result is deterministic on client and server.
 *
 * @returns {{ ok:boolean, reason:string, message:string, discount:number,
 *             finalSubtotal:number, promo?:object }}
 */
export function applyPromotion({
    code,
    subtotal = 0,
    promotions = DEFAULT_PROMOTIONS,
    customerUsage = [],
    referralCredits = 0,
    minimumSubtotal = 0
} = {}) {
    const normalized = normalizePromoCode(code);
    const sub = Math.max(0, Number(subtotal) || 0);

    if (!normalized) return { ok: false, reason: "empty", message: PROMO_REASONS.empty, discount: 0, finalSubtotal: sub };
    if (sub <= 0) return { ok: false, reason: "no_subtotal", message: PROMO_REASONS.no_subtotal, discount: 0, finalSubtotal: sub };

    const list = ensurePromotionList(promotions);
    const promo = list.find((p) => normalizePromoCode(p.code) === normalized);

    if (!promo) return { ok: false, reason: "not_found", message: PROMO_REASONS.not_found, discount: 0, finalSubtotal: sub };
    if (promo.active === false) return { ok: false, reason: "inactive", message: PROMO_REASONS.inactive, discount: 0, finalSubtotal: sub, promo };

    if (promo.oneTimeOnly && customerUsage.some((u) => normalizePromoCode(u?.code || u) === normalized)) {
        return { ok: false, reason: "already_used", message: PROMO_REASONS.already_used, discount: 0, finalSubtotal: sub, promo };
    }

    // Referral-type rewards draw from the customer's earned referral credit balance.
    if (promo.referralRequired && Number(referralCredits) <= 0) {
        return { ok: false, reason: "referral_required", message: PROMO_REASONS.referral_required, discount: 0, finalSubtotal: sub, promo };
    }

    if (minimumSubtotal && sub < Number(minimumSubtotal)) {
        return { ok: false, reason: "minimum_not_met", message: PROMO_REASONS.minimum_not_met, discount: 0, finalSubtotal: sub, promo };
    }

    let discount;
    if (promo.type === "percent") {
        discount = sub * (Number(promo.value || 0) / 100);
    } else if (promo.type === "referral") {
        // Capped by how much referral credit the customer has actually earned.
        discount = Math.min(Number(promo.value || 0), Number(referralCredits) || 0);
    } else {
        discount = Number(promo.value || 0);
    }
    discount = round2(Math.min(sub, Math.max(0, discount)));

    return {
        ok: true,
        reason: "applied",
        message: `${promo.name} applied — you saved $${discount.toFixed(2)}.`,
        discount,
        finalSubtotal: round2(sub - discount),
        promo: { id: promo.id, code: promo.code, name: promo.name, type: promo.type, value: Number(promo.value || 0) }
    };
}

/**
 * Referral reward accrual: a referrer earns `value` credit each time someone
 * who used their referral code completes a *paid* booking. Pure reducer over
 * a list of qualifying referred bookings.
 */
export function calculateReferralRewards(referredBookings = [], promotions = DEFAULT_PROMOTIONS) {
    const referralPromo = ensurePromotionList(promotions).find((p) => p.type === "referral" && p.active !== false);
    const perReferral = Number(referralPromo?.value || 30);
    const qualifying = (Array.isArray(referredBookings) ? referredBookings : []).filter(
        (b) => b && (b.paymentStatus === "paid" || b.status === "Completed")
    );
    const earned = round2(qualifying.length * perReferral);
    return {
        perReferral,
        qualifyingCount: qualifying.length,
        totalReferred: Array.isArray(referredBookings) ? referredBookings.length : 0,
        earnedCredit: earned
    };
}

/**
 * Promos a given customer can actually use right now, each tagged with
 * eligibility so the UI can show "available" vs "locked / used".
 */
export function getCustomerEligiblePromotions({ promotions = DEFAULT_PROMOTIONS, customerUsage = [], referralCredits = 0 } = {}) {
    return ensurePromotionList(promotions)
        .filter((promo) => promo.active !== false)
        .map((promo) => {
            const probe = applyPromotion({ code: promo.code, subtotal: 100, promotions, customerUsage, referralCredits });
            return {
                id: promo.id,
                code: promo.code,
                name: promo.name,
                type: promo.type,
                value: Number(promo.value || 0),
                description: promo.description || "",
                eligible: probe.ok,
                lockedReason: probe.ok ? "" : probe.message
            };
        });
}
