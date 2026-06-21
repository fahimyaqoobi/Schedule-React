import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function GET(request) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
        const token = authHeader.split("Bearer ")[1];

        const decoded = await adminAuth.verifyIdToken(token);
        const authPhone = normalizePhone(decoded.phone_number || "");
        if (!authPhone) throw new Error("No phone number on this account.");

        const url = new URL(request.url);
        const bookingId = (url.searchParams.get("bookingId") || "").trim();
        if (!bookingId) throw new Error("Missing bookingId");

        const snap = await adminDb.collection("bookings").doc(bookingId).get();
        if (!snap.exists) throw new Error("Booking not found.");

        const data = snap.data();
        const bookingPhone = normalizePhone(data.phone || "");

        if (bookingPhone !== authPhone) {
            throw new Error("This link is not associated with your phone number.");
        }

        return NextResponse.json({
            id: snap.id,
            firstName: data.firstName || (data.clientName || "").split(" ")[0] || "",
            service: data.service || "",
            date: data.date || "",
            time: data.time || "",
            address1: data.address1 || "",
            address2: data.address2 || "",
            city: data.city || "",
            postalCode: data.postalCode || "",
            subtotal: Number(data.subtotal || 0),
            tax: Number(data.tax || 0),
            price: Number(data.price || 0),
            promoCode: data.promoCode || "",
            promoDiscount: Number(data.promoDiscount || 0),
            promoName: data.promoName || "",
            cartItems: Array.isArray(data.cartItems) ? data.cartItems : [],
            documentStage: data.documentStage || "estimate",
            estimateNumber: data.estimateNumber || "",
            invoiceNumber: data.invoiceNumber || "",
            status: data.status || "Lead",
            paymentStatus: data.paymentStatus || "unpaid",
            customerConfirmed: Boolean(data.customerConfirmed),
        });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
