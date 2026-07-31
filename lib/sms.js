// Shared Twilio sender — was previously copy-pasted into the two OTP routes.
// Raw REST call (no `twilio` package dependency), same as before.
function normalizeToE164(value = "") {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
}

export async function sendSms(to, body) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
        throw new Error("SMS service is not configured.");
    }

    const phoneNumber = normalizeToE164(to);
    if (!phoneNumber) throw new Error("Missing or invalid destination phone number.");

    const params = new URLSearchParams();
    params.set("To", phoneNumber);
    params.set("Body", body);
    if (messagingServiceSid) {
        params.set("MessagingServiceSid", messagingServiceSid);
    } else {
        params.set("From", fromNumber);
    }

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`SMS failed: ${err}`);
    }
}

// Best-effort send used by job-assignment notifications — a Twilio outage or
// missing config should never block saving a booking, so callers await this
// and only log on failure rather than letting it throw into the request.
export async function trySendSms(to, body) {
    try {
        await sendSms(to, body);
        return { ok: true };
    } catch (err) {
        console.error("SMS send failed:", err.message);
        return { ok: false, error: err.message };
    }
}

function formatJobDate(dateStr) {
    if (!dateStr) return "TBD";
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function jobAddress(booking = {}) {
    return [booking.address1, booking.city].filter(Boolean).join(", ") || "Address on file";
}

function jobLink(origin, bookingId) {
    return `${origin}/?job=${encodeURIComponent(bookingId)}`;
}

export function buildAssignmentSms(booking, origin) {
    return `SmarTouch Clean: You've been assigned a job on ${formatJobDate(booking.date)} at ${booking.time || "TBD"} (${booking.duration || "?"}h) — ${jobAddress(booking)}. Confirm here: ${jobLink(origin, booking.id)}`;
}

export function buildEveningReminderSms(booking, origin) {
    return `SmarTouch Clean reminder: your job TOMORROW ${formatJobDate(booking.date)} at ${booking.time || "TBD"} (${booking.duration || "?"}h) — ${jobAddress(booking)}. Tap to confirm: ${jobLink(origin, booking.id)}`;
}

export function buildJobChangedSms(booking, origin, changeSummary) {
    return `SmarTouch Clean: your job on ${formatJobDate(booking.date)} changed — ${changeSummary}. Details: ${jobLink(origin, booking.id)}`;
}

// Admin-triggered nudge — same job facts as the auto texts, worded as a
// reminder rather than a fresh assignment so it's clear why they're
// hearing about a job they may have already seen.
export function buildManualReminderSms(booking, origin) {
    return `SmarTouch Clean reminder: you're assigned to a job on ${formatJobDate(booking.date)} at ${booking.time || "TBD"} (${booking.duration || "?"}h) — ${jobAddress(booking)}. Please confirm: ${jobLink(origin, booking.id)}`;
}
