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

// This is the phone NUMBER's own "A call comes in" webhook (set once in the
// Twilio console, on the number itself — separate from the TwiML App used
// for outbound browser calls). Anyone calling the business line rings
// straight through to the real cell — no in-app answering, just a landline-
// style forward, exactly as asked for.
export async function POST(request) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const formData = await request.formData();
    const params = Object.fromEntries(formData.entries());

    const signature = request.headers.get("x-twilio-signature") || "";
    const url = getPublicWebhookUrl(request);
    const valid = validateTwilioSignature({ url, params, signature, authToken });
    if (!valid) {
        console.error("Twilio voice-inbound signature mismatch", { url, hasSignature: Boolean(signature) });
        return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
    }

    const forwardTo = process.env.TWILIO_CALL_FORWARD_NUMBER || "6134165001";
    const from = String(params.From || "");
    const origin = new URL(url).origin;
    const statusCallback = `${origin}/api/webhooks/twilio-voice-status?direction=inbound&from=${encodeURIComponent(from)}`;

    return twiml(
        `<Response><Dial><Number statusCallback="${escapeXml(statusCallback)}" statusCallbackEvent="initiated ringing answered completed">${escapeXml(forwardTo)}</Number></Dial></Response>`
    );
}
