import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";

function getMailConfig() {
    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "false") === "true" || port === 465;
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || user || "sales@smartouchclean.com";
    return { host, port, secure, user, pass, from };
}

function appendAuditLog(existingLog = [], event = {}) {
    return [
        ...(Array.isArray(existingLog) ? existingLog : []),
        { id: `log-${Date.now()}`, at: new Date().toISOString(), ...event }
    ];
}

function buildReceiptHtml(booking) {
    const dateStr = booking.date
        ? new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        : booking.date || "";
    const docNumber = booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || booking.id;
    const paidAt = booking.paidAt
        ? new Date(booking.paidAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
        : "";

    return `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#071b3a">
            <div style="background:linear-gradient(135deg,#005691,#0A6CB8);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
                <h1 style="color:#fff;font-size:22px;margin:0 0 4px">Payment Receipt</h1>
                <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0">SmarTouch Clean · Ottawa, ON</p>
            </div>
            <div style="background:#fff;border:1px solid #dce8f2;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
                <p>Hi ${booking.clientName || "there"},</p>
                <p>Thank you for your payment! Here is your receipt for the cleaning service below.</p>

                <div style="background:#f0f6fc;border-radius:10px;padding:16px 20px;margin:20px 0">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#0A6CB8;text-transform:uppercase;margin-bottom:4px">Receipt #${docNumber}</div>
                    ${paidAt ? `<div style="font-size:12px;color:#526276">Paid on ${paidAt}</div>` : ""}
                </div>

                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
                    <tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Service</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${booking.service || "Cleaning Service"}</td></tr>
                    ${dateStr ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Service Date</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${dateStr}</td></tr>` : ""}
                    ${booking.address1 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Address</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${[booking.address1, booking.city, booking.postalCode].filter(Boolean).join(", ")}</td></tr>` : ""}
                    ${Number(booking.subtotal) > 0 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Subtotal</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">$${Number(booking.subtotal).toFixed(2)}</td></tr>` : ""}
                    ${Number(booking.tax) > 0 ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">HST (13%)</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">$${Number(booking.tax).toFixed(2)}</td></tr>` : ""}
                    ${booking.promoCode ? `<tr><td style="padding:8px 0;color:#78A53E;border-bottom:1px solid #eef3f8">Promo (${booking.promoCode})</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right;color:#78A53E">-$${Number(booking.promoDiscount || 0).toFixed(2)}</td></tr>` : ""}
                    <tr><td style="padding:12px 0;font-size:16px;font-weight:700;color:#005691">Total Paid</td><td style="padding:12px 0;font-size:20px;font-weight:800;color:#005691;text-align:right">$${Number(booking.price || 0).toFixed(2)} CAD</td></tr>
                </table>

                <div style="background:#f0f8e8;border-radius:10px;padding:14px 16px;margin-top:16px">
                    <p style="font-size:13px;color:#3d6b1a;margin:0">
                        Payment processed securely via Stripe. Questions? Reply to this email or call
                        <a href="tel:6134165001" style="color:#78A53E;font-weight:700"> 613-416-5001</a>.
                    </p>
                </div>
                <p style="font-size:12px;color:#8fa3b8;margin-top:20px">— The SmarTouch Clean Team · smartouchclean.com</p>
            </div>
        </div>
    `;
}

export async function POST(request) {
    try {
        const authHeader = request.headers.get("Authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.slice(7);
        const decoded = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 401 });
        const adminUser = userDoc.data();
        if (!canManageBranch(adminUser)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { bookingId } = await request.json();
        if (!bookingId) return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });

        const ref = adminDb.collection("bookings").doc(bookingId);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

        const booking = snap.data();
        if (booking.paymentStatus !== "paid") {
            return NextResponse.json({ error: "This booking has not been paid yet." }, { status: 400 });
        }
        if (!booking.email) {
            return NextResponse.json({ error: "No email address on file for this client." }, { status: 400 });
        }

        const mail = getMailConfig();
        if (!mail.host || !mail.user || !mail.pass) {
            return NextResponse.json({ error: "SMTP email settings are missing." }, { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host: mail.host,
            port: mail.port,
            secure: mail.secure,
            auth: { user: mail.user, pass: mail.pass },
        });

        const docNumber = booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || bookingId;

        await transporter.sendMail({
            from: mail.from,
            to: booking.email,
            subject: `Receipt #${docNumber} — SmarTouch Clean`,
            html: buildReceiptHtml(booking),
        });

        await ref.update({
            receiptSentAt: new Date().toISOString(),
            receiptSentBy: adminUser.email || decoded.uid,
            auditLog: appendAuditLog(booking.auditLog, {
                type: "receipt_sent",
                by: adminUser.email || decoded.uid,
                summary: `Receipt emailed to ${booking.email}`,
                status: booking.status,
            }),
        });

        return NextResponse.json({ message: `Receipt sent to ${booking.email}.` });
    } catch (err) {
        console.error("Send receipt error:", err);
        return NextResponse.json({ error: err.message || "Failed to send receipt." }, { status: 500 });
    }
}
