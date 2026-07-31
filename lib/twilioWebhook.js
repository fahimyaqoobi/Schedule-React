import crypto from "node:crypto";

// Twilio's request-validation algorithm: HMAC-SHA1 over the exact webhook
// URL with every POST param (sorted by key, key+value concatenated
// directly) appended, keyed with the account auth token. Anyone hitting
// this endpoint without a valid signature is not actually Twilio.
export function validateTwilioSignature({ url, params, signature, authToken }) {
    if (!authToken || !signature) return false;
    let data = url;
    for (const key of Object.keys(params).sort()) {
        data += key + params[key];
    }
    const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
        return false;
    }
}

// Reconstructs the public URL the way Twilio saw it (Vercel's proxy means
// request.url alone can't be trusted for this).
export function getPublicWebhookUrl(request) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host");
    return `${proto}://${host}${request.nextUrl.pathname}`;
}
