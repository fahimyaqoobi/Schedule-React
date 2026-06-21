import { adminDb } from "./firebase-admin";

function generateReferralCode(phone) {
    const suffix = phone.slice(-4);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return `STC-${rand}${suffix}`;
}

/**
 * Create or update a customer profile keyed by 10-digit phone.
 * Safe to call on every OTP verification — only writes what changed.
 */
export async function upsertCustomerProfile(phone, fields = {}) {
    const ref = adminDb.collection("customers").doc(phone);
    const snap = await ref.get();
    const now = new Date().toISOString();

    if (!snap.exists) {
        const referralCode = generateReferralCode(phone);
        await ref.set({
            phone,
            referralCode,
            referredBy: fields.referredBy || null,
            rewardPoints: 0,
            promoHistory: [],
            bookingRefs: [],
            createdAt: now,
            lastSeenAt: now,
            ...fields,
        });
        return { created: true, referralCode };
    }

    await ref.update({ lastSeenAt: now, ...fields });
    return { created: false, referralCode: snap.data().referralCode };
}

/**
 * Record a confirmed booking under the customer's profile.
 * Idempotent — won't duplicate if called twice for the same bookingId.
 */
export async function recordCustomerBooking(phone, booking) {
    const ref = adminDb.collection("customers").doc(phone);
    const snap = await ref.get();
    if (!snap.exists) return;

    const existing = snap.data().bookingRefs || [];
    if (existing.some(b => b.bookingId === booking.bookingId)) return;

    await ref.update({
        bookingRefs: [
            ...existing,
            {
                bookingId: booking.bookingId,
                service: booking.service || "",
                date: booking.date || "",
                price: booking.price || 0,
                status: booking.status || "Pending",
                confirmedAt: new Date().toISOString(),
            },
        ],
    });
}

/**
 * Mark a booking as paid in the customer's profile and award reward points.
 * 1 point per CAD dollar spent (rounded).
 */
export async function recordCustomerPayment(phone, booking) {
    const ref = adminDb.collection("customers").doc(phone);
    const snap = await ref.get();
    if (!snap.exists) return;

    const data = snap.data();
    const pointsEarned = Math.round(Number(booking.price || 0));
    const currentPoints = Number(data.rewardPoints || 0);

    const bookingRefs = (data.bookingRefs || []).map(b =>
        b.bookingId === booking.bookingId
            ? { ...b, paidAt: new Date().toISOString(), status: "paid" }
            : b
    );

    await ref.update({
        rewardPoints: currentPoints + pointsEarned,
        bookingRefs,
        lastPaymentAt: new Date().toISOString(),
    });

    return { pointsEarned, totalPoints: currentPoints + pointsEarned };
}

/**
 * Record promo code usage against the customer's profile.
 */
export async function recordCustomerPromo(phone, { code, discount, bookingId }) {
    const ref = adminDb.collection("customers").doc(phone);
    const snap = await ref.get();
    if (!snap.exists) return;

    const existing = snap.data().promoHistory || [];
    if (existing.some(p => p.bookingId === bookingId && p.code === code)) return;

    await ref.update({
        promoHistory: [...existing, { code, discount, bookingId, usedAt: new Date().toISOString() }],
    });
}

/**
 * Look up a customer's profile by phone. Returns null if not found.
 */
export async function getCustomerProfile(phone) {
    const snap = await adminDb.collection("customers").doc(phone).get();
    return snap.exists ? snap.data() : null;
}
