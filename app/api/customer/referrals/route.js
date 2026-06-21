import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import { getCustomerProfile } from "../../../../lib/customerProfile";

export async function GET(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const profile = await getCustomerProfile(phone);
        if (!profile?.referralCode) return NextResponse.json({ ok: true, referrals: [] });

        const snap = await adminDb.collection("customers")
            .where("referredBy", "==", profile.referralCode)
            .get();

        const referrals = snap.docs.map(d => {
            const data = d.data();
            const bookingRefs = data.bookingRefs || [];
            const hasPaidBooking = bookingRefs.some(b => b.status === "paid" || b.paidAt);
            const firstName = data.name ? data.name.split(" ")[0] : "Friend";
            // Mask phone for privacy — show area code + last 2 digits only
            const raw = d.id;
            const maskedPhone = raw.length === 10
                ? `(${raw.slice(0, 3)}) ***-**${raw.slice(-2)}`
                : raw.slice(0, 3) + "***";
            return {
                maskedPhone,
                firstName,
                joinedAt: data.createdAt || "",
                hasPaidBooking,
                bookingCount: bookingRefs.length,
            };
        });

        // Sort: paid bookings first
        referrals.sort((a, b) => (b.hasPaidBooking ? 1 : 0) - (a.hasPaidBooking ? 1 : 0));

        return NextResponse.json({ ok: true, referrals });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
