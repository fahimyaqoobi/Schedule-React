import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch, normalizeRole } from "../../../../lib/permissions";
import { DEFAULT_BRANCH_ID, userCanAccessBranch } from "../../../../lib/branches";
import { buildBookingDocumentPdf } from "../../../../lib/bookingDocumentPdf";
import {
    buildBookingEmailHtml,
    getBookingDocumentLabel,
    getBookingDocumentNumber
} from "../../../../lib/bookingDocuments";

function appendAuditLog(existingLog = [], event = {}) {
    return [
        ...(Array.isArray(existingLog) ? existingLog : []),
        {
            id: `log-${Date.now()}`,
            at: new Date().toISOString(),
            ...event
        }
    ];
}

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) throw new Error("User account not found");
    const user = userDoc.data();
    if (user.status !== "approved") throw new Error("User account is pending approval or disabled");
    return user;
}

function getMailConfig() {
    const host = process.env.SMTP_HOST || process.env.MAIL_HOST || process.env.EMAIL_HOST || "";
    const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || process.env.EMAIL_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || process.env.MAIL_SECURE || process.env.EMAIL_SECURE || "false") === "true" || port === 465;
    const user = process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER || "";
    const pass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.EMAIL_PASS || "";
    const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.EMAIL_FROM || user || "sales@smartouchclean.com";
    return { host, port, secure, user, pass, from };
}

function normalizeTransportError(error) {
    const code = String(error?.responseCode || error?.code || "");
    const message = String(error?.message || "Failed to send document.");
    if (code === "535" || message.includes("535") || /invalid login|authentication credentials invalid/i.test(message)) {
            return "SMTP login failed. Check the deployed SMTP settings for `sales@smartouchclean.com` in Vercel Environment Variables, confirm the IONOS mailbox password is correct, and redeploy after any env change.";
    }
    return message;
}

async function loadLogoBuffer(origin) {
    try {
        const response = await fetch(`${origin}/logo.png`);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (_error) {
        return null;
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const role = normalizeRole(user.role);
        if (!canManageBranch(user) && role !== "customer") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { bookingId } = await request.json();
        if (!bookingId) {
            return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
        }

        const bookingDoc = await adminDb.collection("bookings").doc(bookingId).get();
        if (!bookingDoc.exists) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        const booking = bookingDoc.data();
        if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID) && role !== "customer") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!booking.email) {
            return NextResponse.json({ error: "Client email is missing on this booking." }, { status: 400 });
        }

        const mail = getMailConfig();
        if (!mail.host || !mail.user || !mail.pass) {
            return NextResponse.json({ error: "SMTP email settings are missing from the server environment." }, { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host: mail.host,
            port: mail.port,
            secure: mail.secure,
            auth: {
                user: mail.user,
                pass: mail.pass
            }
        });

        const documentLabel = getBookingDocumentLabel(booking);
        const documentNumber = getBookingDocumentNumber(booking);
        const origin = request.headers.get("origin") || request.nextUrl.origin;
        const companySnapshot = {
            ...(booking.companySnapshot || {}),
            logoUrl: `${origin}/logo.png`
        };
        const logoBuffer = await loadLogoBuffer(origin);
        const pdfBuffer = await buildBookingDocumentPdf({ ...booking, companySnapshot }, { logoBuffer });
        const fileName = `${documentNumber}.pdf`;

        await transporter.sendMail({
            from: mail.from,
            to: booking.email,
            subject: `${documentLabel} ${documentNumber} from SmarTouch Clean`,
            html: buildBookingEmailHtml({ ...booking, companySnapshot }),
            attachments: [
                {
                    filename: fileName,
                    content: pdfBuffer,
                    contentType: "application/pdf"
                }
            ]
        });

        await adminDb.collection("bookings").doc(bookingId).set({
            ...booking,
            documentLastSentAt: new Date().toISOString(),
            documentLastSentBy: user.email,
            auditLog: appendAuditLog(booking.auditLog, {
                type: "document_sent",
                by: user.email || user.uid,
                summary: `${documentLabel} sent to client`,
                status: booking.status,
                paymentStatus: booking.paymentStatus || "unpaid"
            })
        });

        return NextResponse.json({ message: `${documentLabel} sent to ${booking.email}.` });
    } catch (error) {
        console.error("POST Booking Document Error:", error);
        return NextResponse.json({ error: normalizeTransportError(error) }, { status: 500 });
    }
}
