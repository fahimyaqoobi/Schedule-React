import { NextResponse } from "next/server";
import { validateTwilioSignature, getPublicWebhookUrl } from "../../../../lib/twilioWebhook";

function escapeXml(value = "") {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function twiml(xml) {
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
    });
}

// This is the TwiML App's "Voice URL" — Twilio hits it the moment the
// browser (via the Voice SDK's Device.connect) places an outbound call. The
// `To` and `bookingId` params are whatever the browser passed in
// connect({params}) (see CallButton.js). Caller ID is always the one real
// Twilio number the business has, so the customer sees the same number
// texts already come from, regardless of which admin is calling.
export async function POST(request) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const formData = await request.formData();
    const params = Object.fromEntries(formData.entries());

    const signature = request.headers.get("x-twilio-signature") || "";
    const url = getPublicWebhookUrl(request);
    const valid = validateTwilioSignature({ url, params, signature, authToken });
    if (!valid) {
        console.error("Twilio voice-outbound signature mismatch", { url, hasSignature: Boolean(signature) });
        return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
    }

    const to = String(params.To || "").trim();
    const bookingId = String(params.bookingId || "");
    const callerId = process.env.TWILIO_VOICE_NUMBER;

    if (!to || !callerId) {
        return twiml(`<Response><Say>This call could not be placed. Missing destination or caller ID.</Say></Response>`);
    }

    const origin = new URL(url).origin;
    const statusCallback = `${origin}/api/webhooks/twilio-voice-status${bookingId ? `?bookingId=${encodeURIComponent(bookingId)}` : ""}`;

    return twiml(
        `<Response><Dial callerId="${escapeXml(callerId)}"><Number statusCallback="${escapeXml(statusCallback)}" statusCallbackEvent="initiated ringing answered completed">${escapeXml(to)}</Number></Dial></Response>`
    );
}
