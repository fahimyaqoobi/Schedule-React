import nodemailer from "nodemailer";

// Shared SMTP helper — the same env-var config (SMTP_HOST/PORT/SECURE/USER/
// PASS/FROM) already duplicated across app/api/bookings/{document,approve,
// receipt}/route.js and app/api/webhooks/stripe/route.js. New callers (the
// careers/apply flow) should use this instead of adding a 5th copy.
function getMailConfig() {
    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "false") === "true" || port === 465;
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || user || "sales@smartouchclean.com";
    return { host, port, secure, user, pass, from };
}

export function isMailConfigured() {
    const mail = getMailConfig();
    return Boolean(mail.host && mail.user && mail.pass);
}

export async function sendEmail({ to, subject, html }) {
    const mail = getMailConfig();
    if (!mail.host || !mail.user || !mail.pass) {
        throw new Error("SMTP email settings are missing.");
    }
    const transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: { user: mail.user, pass: mail.pass },
    });
    await transporter.sendMail({ from: mail.from, to, subject, html });
}
