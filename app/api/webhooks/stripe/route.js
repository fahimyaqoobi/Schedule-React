import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb } from "../../../../lib/firebase-admin";
import Stripe from "stripe";
import { upsertCustomerProfile, recordCustomerPayment } from "../../../../lib/customerProfile";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getMailConfig() {
    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "false") === "true" || port === 465;
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || user || "sales@smartouchclean.com";
    return { host, port, secure, user, pass, from };
}

async function sendReceiptEmail(booking) {
    if (!booking.email) return;
    const mail = getMailConfig();
    if (!mail.host || !mail.user || !mail.pass) return;

    const dateStr = booking.date
        ? new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : "";
    const docNumber = booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "";

    const transporter = nodemailer.createTransport({
        host: mail.host, port: mail.port, secure: mail.secure,
        auth: { user: mail.user, pass: mail.pass },
    });

    await transporter.sendMail({
        from: mail.from,
        to: booking.email,
        subject: `Receipt${docNumber ? ` #${docNumber}` : ""} — SmarTouch Clean`,
        html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#071b3a">
                <div style="background:linear-gradient(135deg,#005691,#0A6CB8);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
                    <h1 style="color:#fff;font-size:22px;margin:0 0 4px">Payment Received</h1>
                    <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0">SmarTouch Clean · Ottawa, ON</p>
                </div>
                <div style="background:#fff;border:1px solid #dce8f2;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
                    <p>Hi ${booking.clientName || "there"},</p>
                    <p>We've received your payment. Here's your receipt:</p>
                    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0">
                        <tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Service</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${booking.service || "Cleaning Service"}</td></tr>
                        ${dateStr ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Date</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${dateStr}</td></tr>` : ""}
                        ${booking.address1 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Address</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${[booking.address1, booking.city, booking.postalCode].filter(Boolean).join(", ")}</td></tr>` : ""}
                        ${Number(booking.subtotal) > 0 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Subtotal</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">$${Number(booking.subtotal).toFixed(2)}</td></tr>` : ""}
                        ${Number(booking.tax) > 0 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">HST (13%)</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">$${Number(booking.tax).toFixed(2)}</td></tr>` : ""}
                        ${booking.promoCode && Number(booking.promoDiscount) > 0 ? `<tr><td style="padding:8px 0;color:#78A53E;border-bottom:1px solid #eef3f8">Promo (${booking.promoCode})</td><td style="padding:8px 0;font-weight:600;color:#78A53E;border-bottom:1px solid #eef3f8;text-align:right">-$${Number(booking.promoDiscount).toFixed(2)}</td></tr>` : ""}
                        <tr><td style="padding:12px 0;font-size:16px;font-weight:700;color:#005691">Total Paid</td><td style="padding:12px 0;font-size:20px;font-weight:800;color:#005691;text-align:right">$${Number(booking.price || 0).toFixed(2)} CAD</td></tr>
                    </table>
                    <div style="background:#f0f8e8;border-radius:10px;padding:14px 16px">
                        <p style="font-size:13px;color:#3d6b1a;margin:0">
                            Questions? Call <a href="tel:6134165001" style="color:#78A53E;font-weight:700">613-416-5001</a> or reply to this email.
                        </p>
                    </div>
                    <p style="font-size:12px;color:#8fa3b8;margin-top:20px">— The SmarTouch Clean Team</p>
                </div>
            </div>
        `,
    });
}

export async function POST(request) {
    if (!stripe) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    let event;
    if (webhookSecret && sig) {
        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } catch (err) {
            return NextResponse.json({ error: `Webhook signature invalid: ${err.message}` }, { status: 400 });
        }
    } else {
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
            const ref = adminDb.collection("bookings").doc(bookingId);
            const snap = await ref.get();

            await ref.update({
                paymentStatus: "paid",
                paidAt: new Date().toISOString(),
                stripePaymentIntentId: session.payment_intent || "",
                stripeSessionId: session.id,
                updatedAt: new Date().toISOString(),
            });

            if (snap.exists) {
                const bookingData = snap.data();
                // Auto-send receipt email
                try {
                    await sendReceiptEmail(bookingData);
                } catch (emailErr) {
                    console.error("Auto-receipt email failed:", emailErr.message);
                }
                // Update customer profile with payment + reward points
                const customerPhone = session.metadata?.phone;
                if (customerPhone) {
                    upsertCustomerProfile(customerPhone).catch(() => {});
                    recordCustomerPayment(customerPhone, { ...bookingData, bookingId }).catch(err =>
                        console.error("recordCustomerPayment failed:", err)
                    );
                }
            }
        }
    }

    return NextResponse.json({ received: true });
}
