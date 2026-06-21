import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
    if (!stripe) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    let event;
    if (webhookSecret && sig) {
        // Production: verify Stripe signature
        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } catch (err) {
            return NextResponse.json({ error: `Webhook signature invalid: ${err.message}` }, { status: 400 });
        }
    } else {
        // Dev / no secret yet: parse without verification
        try {
            event = JSON.parse(body);
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;

        if (bookingId && session.payment_status === "paid") {
            await adminDb.collection("bookings").doc(bookingId).update({
                paymentStatus: "paid",
                paidAt: new Date().toISOString(),
                stripePaymentIntentId: session.payment_intent || "",
                stripeSessionId: session.id,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    return NextResponse.json({ received: true });
}
