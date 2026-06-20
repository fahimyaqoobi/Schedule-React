import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { ROLE_DEFINITIONS } from "../../../lib/permissions";
import {
    ensurePromotionList,
    getCustomerEligiblePromotions,
    applyPromotion
} from "../../../lib/promotions";
import { getCustomerPromoContext } from "../../../lib/customerRewards";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new Error("User profile not found");
    }
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

async function loadPromotions() {
    const docSnap = await adminDb.collection("settings").doc("pricing").get();
    return ensurePromotionList(docSnap.exists ? docSnap.data()?.promotions : []);
}

// GET — the authenticated customer's promo + referral rewards wallet.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const promotions = await loadPromotions();
        const context = await getCustomerPromoContext({ user, adminDb, promotions });
        const eligiblePromotions = getCustomerEligiblePromotions({
            promotions,
            customerUsage: context.customerUsage,
            referralCredits: context.referralCredits
        });

        return NextResponse.json({
            referralCode: context.referralCode,
            rewards: {
                availableCredit: context.availableCredit,
                earnedCredit: context.earnedCredit,
                redeemedCredit: context.redeemedCredit,
                qualifyingReferrals: context.qualifyingCount,
                totalReferred: context.totalReferred,
                perReferral: context.perReferral
            },
            eligiblePromotions
        }, { status: 200 });
    } catch (err) {
        console.error("GET Promotions Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// POST — server-authoritative validation of a code against a cart subtotal.
// Used by the checkout to lock in a trustworthy discount before booking.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const { code, subtotal } = await request.json();
        const promotions = await loadPromotions();
        const context = await getCustomerPromoContext({ user, adminDb, promotions });

        const result = applyPromotion({
            code,
            subtotal: Number(subtotal) || 0,
            promotions,
            customerUsage: context.customerUsage,
            referralCredits: context.referralCredits
        });

        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        console.error("POST Promotions Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
