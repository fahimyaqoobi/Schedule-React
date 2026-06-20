import {
    ensurePromotionList,
    generateReferralCode,
    calculateReferralRewards
} from "./promotions";

function round2(n) {
    return Number((Math.round((Number(n) || 0) * 100) / 100).toFixed(2));
}

/**
 * A customer's stable, shareable referral code — derived from their phone +
 * name so it's the same every time (independent of any single booking).
 */
export function getPersonalReferralCode(user = {}) {
    const phone = user.phone || user.customerPortalPhone || "";
    return generateReferralCode(phone, "MEMBER", user.name || user.email || "STC");
}

/**
 * Server-authoritative promo/rewards context for a customer, derived entirely
 * from the bookings collection (no separate ledger to keep in sync):
 *   - customerUsage:    codes this customer already redeemed (one-time guard)
 *   - referralCredits:  earned referral credit still available to spend
 *
 * @param {{ user: object, adminDb: any, promotions?: array }} args
 */
export async function getCustomerPromoContext({ user, adminDb, promotions }) {
    const promoList = ensurePromotionList(promotions);
    const referralCode = getPersonalReferralCode(user);

    // 1. This customer's own bookings → prior promo usage + referral redemptions.
    const ownSnap = await adminDb.collection("bookings").where("email", "==", user.email || "").get();
    const ownBookings = ownSnap.docs.map((d) => d.data());

    const customerUsage = ownBookings
        .filter((b) => b.promoCode)
        .map((b) => ({ code: b.promoCode, bookingId: b.id, at: b.createdAt }));

    const redeemedReferralCredit = round2(
        ownBookings
            .filter((b) => b.promoType === "referral")
            .reduce((sum, b) => sum + Number(b.promoDiscount || 0), 0)
    );

    // 2. Bookings that named this customer's code as their referrer → earned credit.
    const referredSnap = await adminDb.collection("bookings").where("referredByCode", "==", referralCode).get();
    const referredBookings = referredSnap.docs.map((d) => d.data());
    const rewards = calculateReferralRewards(referredBookings, promoList);

    const availableCredit = Math.max(0, round2(rewards.earnedCredit - redeemedReferralCredit));

    return {
        referralCode,
        customerUsage,
        referralCredits: availableCredit,
        earnedCredit: rewards.earnedCredit,
        redeemedCredit: redeemedReferralCredit,
        availableCredit,
        qualifyingCount: rewards.qualifyingCount,
        totalReferred: rewards.totalReferred,
        perReferral: rewards.perReferral
    };
}
