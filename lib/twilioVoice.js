import twilio from "twilio";

// Uses the `twilio` package's own JWT builder rather than hand-rolling one
// (unlike lib/sms.js's plain-REST convention for messaging) — Access Tokens
// have a specific grants/claims shape Twilio is strict about, and this is
// the one place getting that wrong silently breaks every call rather than
// just failing loudly, so it's worth the one real dependency this touches.
const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

// A short-lived token identifying one admin's browser as a "caller" — the
// Voice SDK's Device uses this to register with Twilio and place/receive
// calls. Re-minted on demand (see app/api/twilio/voice-token), not cached,
// since it's cheap to generate and expires in an hour regardless.
export function buildVoiceAccessToken(identity) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
        throw new Error("Twilio Voice is not configured (missing account SID / API key / TwiML App SID).");
    }

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
        identity,
        ttl: 3600,
    });
    token.addGrant(new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: false, // browser only places calls, doesn't receive them — inbound goes to the forwarded cell number instead
    }));
    return token.toJwt();
}

export function isVoiceConfigured() {
    return Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_API_KEY_SID &&
        process.env.TWILIO_API_KEY_SECRET &&
        process.env.TWILIO_TWIML_APP_SID &&
        process.env.TWILIO_VOICE_NUMBER
    );
}
