import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import { getCustomerProfile } from "../../../../lib/customerProfile";
import { findBranchForAddress, buildBranchRecordFields, DEFAULT_BRANCH_ID, getBranchById } from "../../../../lib/branches";
import { blockedDateDocId } from "../../../../lib/blockedDates";

export async function POST(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const body = await request.json();
        const profile = await getCustomerProfile(phone) || {};

        const {
            service,
            cartItems,
            date,
            time,
            address1, address2, city, province, postalCode,
            notes,
            promoCode, promoDiscount, promoName,
            rewardPointsUsed, rewardPointsDiscount,
            subtotal, tax, total,
        } = body;

        if (!service || !date) throw new Error("Service and date are required.");

        const resolvedAddress = {
            city: city || profile.city || "",
            country: "Canada",
            postalCode: postalCode || profile.postalCode || "",
        };
        const matchedBranch = findBranchForAddress(resolvedAddress) || getBranchById(DEFAULT_BRANCH_ID);

        const blockedSnap = await adminDb.collection("blockedDates").doc(blockedDateDocId(matchedBranch.id, date)).get();
        if (blockedSnap.exists) {
            const { reason } = blockedSnap.data();
            throw Object.assign(new Error(`Sorry, ${date} isn't available for booking${reason ? ` (${reason})` : ""}. Please choose another date.`), { status: 422 });
        }

        const booking = {
            phone,
            clientName: profile.name || "",
            email: profile.email || "",
            service,
            cartItems: Array.isArray(cartItems) ? cartItems : [],
            date,
            time: time || "Morning (8am–12pm)",
            address1: address1 || profile.address || "",
            address2: address2 || "",
            city: city || profile.city || "",
            province: province || profile.province || "ON",
            postalCode: postalCode || profile.postalCode || "",
            notes: notes || "",
            promoCode: promoCode || "",
            promoDiscount: Number(promoDiscount || 0),
            promoName: promoName || "",
            rewardPointsUsed: Number(rewardPointsUsed || 0),
            rewardPointsDiscount: Number(rewardPointsDiscount || 0),
            status: "Pending",
            customerConfirmed: false,
            paymentStatus: "unpaid",
            source: "customer_portal",
            createdAt: new Date().toISOString(),
            ...buildBranchRecordFields(matchedBranch, {}),
            // Estimates — admin sets final price when confirming
            subtotal: Number(subtotal || 0),
            tax: Number(tax || 0),
            price: Number(total || 0),
            assignedStaff: [],
            team: "",
        };

        const ref = await adminDb.collection("bookings").add(booking);

        // Deduct reward points if used
        if (Number(rewardPointsUsed) > 0) {
            const custRef = adminDb.collection("customers").doc(phone);
            const snap = await custRef.get();
            if (snap.exists) {
                const current = Number(snap.data().rewardPoints || 0);
                await custRef.update({ rewardPoints: Math.max(0, current - Number(rewardPointsUsed)) });
            }
        }

        return NextResponse.json({ ok: true, bookingId: ref.id });
    } catch (err) {
        const status = err.status || (err.message === "Unauthorized" ? 401 : 400);
        return NextResponse.json({ error: err.message }, { status });
    }
}
