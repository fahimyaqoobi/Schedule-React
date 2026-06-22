import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { signCustomerSession } from "../../../../lib/customerSession";
import { upsertCustomerProfile } from "../../../../lib/customerProfile";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits;
}

export async function POST(request) {
    try {
        const { phone, code } = await request.json();
        if (!code || String(code).replace(/\D/g, "").length !== 6) {
            throw new Error("Please enter the 6-digit code.");
        }

        const normalized = normalizePhone(phone);
        if (normalized.length !== 10) throw new Error("Invalid phone number.");

        const doc = await adminDb.collection("customer_otps").doc(normalized).get();
        if (!doc.exists) throw new Error("No code was sent to this number. Please request a new one.");

        const data = doc.data();

        if (Date.now() > data.expiresAt) {
            await doc.ref.delete();
            throw new Error("Code has expired. Please request a new one.");
        }

        if ((data.attempts || 0) >= 5) {
            throw new Error("Too many attempts. Please request a new code.");
        }

        if (String(data.code) !== String(code).replace(/\D/g, "")) {
            await doc.ref.update({ attempts: (data.attempts || 0) + 1 });
            throw new Error("Incorrect code. Please try again.");
        }

        await doc.ref.delete();

        // Create or refresh the customer profile; try to pre-fill from existing bookings if brand new
        let isNewCustomer = false;
        try {
            const { created } = await upsertCustomerProfile(normalized);
            if (created) {
                // Look for existing admin bookings to pre-populate name/email/address
                const bookingSnap = await adminDb.collection("bookings")
                    .where("phone", "==", normalized)
                    .limit(5)
                    .get();

                let prefill = {};
                if (!bookingSnap.empty) {
                    const booking = bookingSnap.docs
                        .map(d => d.data())
                        .sort((a, b) => ((b.date || "") > (a.date || "") ? 1 : -1))[0];
                    const clientName = booking.clientName ||
                        [booking.firstName, booking.lastName].filter(Boolean).join(" ").trim();
                    if (clientName) prefill.name = clientName;
                    if (booking.email) prefill.email = booking.email;
                    if (booking.address1) prefill.address = booking.address1;
                    if (booking.city) prefill.city = booking.city;
                    if (booking.state || booking.province) prefill.province = booking.state || booking.province;
                    if (booking.postalCode) prefill.postalCode = booking.postalCode;
                    if (Object.keys(prefill).length > 0) await upsertCustomerProfile(normalized, prefill);
                }
                // Need onboarding only if we still don't have a name
                isNewCustomer = !prefill.name;
            }
        } catch (err) {
            console.error("Profile setup error:", err);
        }

        const sessionToken = signCustomerSession(normalized);
        const response = NextResponse.json({ ok: true, sessionToken, isNewCustomer });
        response.cookies.set("cst", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 8 * 60 * 60,
        });
        return response;
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
