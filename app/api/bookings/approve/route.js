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
        if (!booking.customerConfirmed) {
            return NextResponse.json({ error: "Customer has not confirmed this booking yet." }, { status: 400 });
        }

        await ref.update({
            status: "Confirmed",
            adminApprovedAt: new Date().toISOString(),
            adminApprovedBy: adminUser.email || decoded.uid,
            updatedAt: new Date().toISOString(),
            auditLog: appendAuditLog(booking.auditLog, {
                type: "admin_approved",
                by: adminUser.email || decoded.uid,
                summary: "Job approved by admin after customer confirmation",
                status: "Confirmed",
            }),
        });

        // Send confirmation email to client if email exists
        if (booking.email) {
            const mail = getMailConfig();
            if (mail.host && mail.user && mail.pass) {
                try {
                    const transporter = nodemailer.createTransport({
                        host: mail.host,
                        port: mail.port,
                        secure: mail.secure,
                        auth: { user: mail.user, pass: mail.pass },
                    });
                    const dateStr = booking.date
                        ? new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                        : booking.date || "";
                    await transporter.sendMail({
                        from: mail.from,
                        to: booking.email,
                        subject: `Your cleaning job is confirmed — SmarTouch Clean`,
                        html: `
                            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#071b3a">
                                <div style="background:linear-gradient(135deg,#005691,#0A6CB8);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
                                    <h1 style="color:#fff;font-size:22px;margin:0">Job Confirmed!</h1>
                                </div>
                                <div style="background:#fff;border:1px solid #dce8f2;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
                                    <p>Hi ${booking.clientName || "there"},</p>
                                    <p>Great news — your cleaning job has been reviewed and <strong>confirmed</strong> by our team.</p>
                                    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
                                        <tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Service</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${booking.service || "Cleaning Service"}</td></tr>
                                        ${dateStr ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Date</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${dateStr}</td></tr>` : ""}
                                        ${booking.time ? `<tr><td style="padding:8px 0;color:#526276;border-bottom:1px solid #eef3f8">Time</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eef3f8;text-align:right">${booking.time}</td></tr>` : ""}
                                        <tr><td style="padding:8px 0;color:#526276">Total</td><td style="padding:8px 0;font-weight:800;font-size:18px;text-align:right;color:#005691">$${Number(booking.price || 0).toFixed(2)}</td></tr>
                                    </table>
                                    <p style="font-size:13px;color:#526276">Questions? Reply to this email or call <a href="tel:6134165001" style="color:#0A6CB8">613-416-5001</a>.</p>
                                    <p style="font-size:13px;color:#526276">— The SmarTouch Clean Team</p>
                                </div>
                            </div>
                        `,
                    });
                } catch (emailErr) {
                    console.error("Approval email failed:", emailErr.message);
                }
            }
        }

        return NextResponse.json({ message: `Job confirmed for ${booking.clientName || "client"}. ${booking.email ? "Confirmation email sent." : "No email on file."}` });
    } catch (err) {
        console.error("Approve booking error:", err);
        return NextResponse.json({ error: err.message || "Failed to approve booking." }, { status: 500 });
    }
}
