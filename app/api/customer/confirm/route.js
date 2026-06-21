import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhone } from "../../../../lib/customerSession";
import { recordCustomerBooking, recordCustomerPromo } from "../../../../lib/customerProfile";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function POST(request) {
    try {
        const sessionPhone = getSessionPhone(request);

        const { bookingId } = await request.json();
        if (!bookingId) throw new Error("Missing bookingId.");

        const ref = adminDb.collection("bookings").doc(bookingId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Booking not found.");

        const data = snap.data();
        if (normalizePhone(data.phone) !== sessionPhone) {
            throw new Error("This booking is not linked to your phone number.");
        }

        if (data.customerConfirmed) {
            return NextResponse.json({ message: "Already confirmed", alreadyConfirmed: true });
        }

        const nextStatus = ["Lead", "Follow Up"].includes(data.status) ? "Pending" : data.status;

        await ref.update({
            customerConfirmed: true,
            customerConfirmedAt: new Date().toISOString(),
            status: nextStatus,
            updatedAt: new Date().toISOString(),
        });

        // Record booking + promo in customer profile
        recordCustomerBooking(sessionPhone, {
            bookingId,
            service: data.service,
            date: data.date,
            price: data.price,
            status: nextStatus,
        }).catch(err => console.error("recordCustomerBooking failed:", err));

        if (data.promoCode && Number(data.promoDiscount) > 0) {
            recordCustomerPromo(sessionPhone, {
                code: data.promoCode,
                discount: data.promoDiscount,
                bookingId,
            }).catch(err => console.error("recordCustomerPromo failed:", err));
        }

        return NextResponse.json({ message: "Job confirmed successfully" });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
