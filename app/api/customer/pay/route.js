import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";
import Stripe from "stripe";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

export async function POST(request) {
    if (!stripe) {
        return NextResponse.json(
            { error: "Online payment is not configured yet. Please contact us directly." },
            { status: 503 }
        );
    }

    try {
        const sessionPhone = getSessionPhoneAny(request);

        const { bookingId, successPath, cancelPath } = await request.json();
        if (!bookingId) throw new Error("Missing bookingId.");

        const ref = adminDb.collection("bookings").doc(bookingId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Booking not found.");

        const data = snap.data();
        if (normalizePhone(data.phone) !== sessionPhone) {
            throw new Error("This invoice is not linked to your phone number.");
        }

        if (data.paymentStatus === "paid") {
            return NextResponse.json({ error: "This invoice has already been paid." }, { status: 400 });
        }

        const origin = request.headers.get("origin") || "https://smartouchclean.com";
        const totalCents = Math.round(Number(data.price || 0) * 100);
        if (totalCents <= 0) throw new Error("Invalid invoice amount.");

        const invoiceLabel = data.invoiceNumber || bookingId;
        const dateLabel = data.date ? ` · ${data.date}` : "";

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [{
                price_data: {
                    currency: "cad",
                    product_data: {
                        name: `SmarTouch Clean — ${data.service || "Cleaning Service"}`,
                        description: `Invoice ${invoiceLabel}${dateLabel}${data.address1 ? ` · ${data.address1}` : ""}`,
                    },
                    unit_amount: totalCents,
                },
                quantity: 1,
            }],
            mode: "payment",
            customer_email: data.email || undefined,
            success_url: successPath
                ? `${origin}${successPath}`
                : `${origin}/customer-access?bookingId=${bookingId}&paid=true`,
            cancel_url: cancelPath
                ? `${origin}${cancelPath}`
                : `${origin}/customer-access?bookingId=${bookingId}&phone=${normalizePhone(data.phone || "")}`,
            metadata: { bookingId, phone: sessionPhone },
        });

        await ref.update({
            stripeSessionId: session.id,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ url: session.url });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
