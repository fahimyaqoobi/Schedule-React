import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import { getCustomerProfile } from "../../../../lib/customerProfile";

export async function POST(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const body = await request.json();
        const profile = await getCustomerProfile(phone) || {};

        const { service, date, time, address1, address2, city, province, postalCode, notes, promoCode, extras } = body;
        if (!service || !date) throw new Error("Service and date are required.");

        const booking = {
            phone,
            clientName: profile.name || "",
            email: profile.email || "",
            service,
            date,
            time: time || "Morning (8am–12pm)",
            address1: address1 || profile.address || "",
            address2: address2 || "",
            city: city || profile.city || "",
            province: province || profile.province || "ON",
            postalCode: postalCode || profile.postalCode || "",
            notes: notes || "",
            promoCode: promoCode || "",
            extras: extras || [],
            status: "Pending",
            customerConfirmed: false,
            paymentStatus: "unpaid",
            source: "customer_portal",
            createdAt: Date.now(),
            price: 0,
            subtotal: 0,
            tax: 0,
            assignedStaff: [],
            team: "",
        };

        const ref = await adminDb.collection("bookings").add(booking);
        return NextResponse.json({ ok: true, bookingId: ref.id });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
