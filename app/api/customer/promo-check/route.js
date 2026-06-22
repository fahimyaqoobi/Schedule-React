import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import { getCustomerProfile } from "../../../../lib/customerProfile";
import { applyPromotion, ensurePromotionList } from "../../../../lib/promotions";

export async function POST(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const { code, subtotal } = await request.json();
        if (!code) return NextResponse.json({ ok: false, message: "Enter a promo code." });

        const [snap, profile] = await Promise.all([
            adminDb.collection("settings").doc("pricing").get(),
            getCustomerProfile(phone),
        ]);
        const settings = snap.exists ? snap.data() : {};
        const promotions = ensurePromotionList(settings.promotions || []);
        const customerUsage = (profile?.promoHistory || []).map(h => h.code);
        const referralCredits = Number(profile?.referralCredits || 0);

        const result = applyPromotion({ code, subtotal: Number(subtotal) || 0, promotions, customerUsage, referralCredits });
        return NextResponse.json(result);
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ ok: false, message: err.message }, { status });
    }
}
