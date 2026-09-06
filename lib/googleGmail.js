import { adminDb } from "./firebase-admin";

// Gmail REST API helper for the Google Local Services lead pipeline. Plain
// fetch calls (no `googleapis` SDK dependency) — same "raw REST" convention
// this codebase already uses for Twilio (see lib/sms.js).
//
// Why Gmail at all, and not the Local Services Ads API: the LSA API only
// exposes lead/conversation data as a *read-only* reporting resource — there
// is no endpoint to send a reply. Google's own lead-notification email
// explicitly offers "Reply to this email" as an equal alternative to
// replying in the app, and routes it back through the same anonymized
// customer alias — so replying via the Gmail account that receives these
// notifications is the only channel that both reads AND writes, and it's
// indistinguishable from a human typing a reply in Gmail.
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

const SETTINGS_DOC_ID = "googleGmail";

function clientCredentials() {
    const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Gmail integration is not configured (missing GOOGLE_GMAIL_CLIENT_ID/GOOGLE_GMAIL_CLIENT_SECRET).");
    }
    return { clientId, clientSecret };
}

export function buildGmailAuthUrl({ redirectUri, state }) {
    const { clientId } = clientCredentials();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: GMAIL_SCOPE,
        access_type: "offline",
        // Forces Google to hand back a refresh_token even if this account
        // has authorized this app before (Google otherwise only issues one
        // on the very first consent).
        prompt: "consent",
        state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGmailCode(code, redirectUri) {
    const { clientId, clientSecret } = clientCredentials();
    const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });
    const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });
    if (!res.ok) throw new Error(`Gmail token exchange failed: ${await res.text()}`);
    return res.json(); // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshGmailAccessToken(refreshToken) {
    const { clientId, clientSecret } = clientCredentials();
    const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${await res.text()}`);
    return res.json(); // { access_token, expires_in, scope, token_type }
}

export async function getGmailSettings() {
    const snap = await adminDb.collection("settings").doc(SETTINGS_DOC_ID).get();
    return snap.exists ? snap.data() : null;
}

export async function saveGmailSettings(patch) {
    await adminDb.collection("settings").doc(SETTINGS_DOC_ID).set(patch, { merge: true });
}

// Access tokens last ~1hr; there's no shared in-memory cache across
// serverless invocations here, so the simplest correct approach is to mint a
// fresh one from the stored refresh token on every call rather than track
// expiry ourselves. Google has no issue with this — refresh calls are cheap
// and not rate-limited for normal use.
export async function getGmailAccessToken() {
    const settings = await getGmailSettings();
    if (!settings?.refreshToken) {
        throw new Error("Gmail is not connected yet — connect it from Settings first.");
    }
    const tokens = await refreshGmailAccessToken(settings.refreshToken);
    return tokens.access_token;
}

async function gmailFetch(accessToken, path, options = {}) {
    const res = await fetch(`${GMAIL_API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    if (!res.ok) throw new Error(`Gmail API ${path} failed (${res.status}): ${await res.text()}`);
    return res.json();
}

// Registers (or renews) real-time push notifications for this mailbox —
// Gmail calls back to our Pub/Sub topic within seconds of new mail arriving,
// rather than us having to poll. Subscriptions expire after 7 days; call
// this again before then (see app/api/cron/gmail-watch-renew).
export async function startGmailWatch(accessToken, topicName) {
    return gmailFetch(accessToken, "/watch", {
        method: "POST",
        body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterAction: "include" }),
    }); // -> { historyId, expiration }
}

export async function listGmailHistory(accessToken, startHistoryId) {
    const params = new URLSearchParams({
        startHistoryId: String(startHistoryId),
        historyTypes: "messageAdded",
        labelId: "INBOX",
    });
    return gmailFetch(accessToken, `/history?${params.toString()}`);
}

export async function getGmailMessage(accessToken, messageId) {
    return gmailFetch(accessToken, `/messages/${messageId}?format=full`);
}

function base64UrlEncode(str) {
    return Buffer.from(str, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// Builds a reply that threads correctly in Gmail — and, because it's sent
// to the exact per-lead alias Google gave us and carries proper
// In-Reply-To/References headers, threads correctly on Google's side too,
// the same as a human clicking Reply in the Gmail UI. No "From" header is
// set — Gmail always stamps the authenticated account's own address, and
// setting one manually risks a spoofing rejection.
export function buildReplyRawMessage({ to, subject, bodyText, inReplyTo, references }) {
    const headers = [
        `To: ${to}`,
        `Subject: ${subject && subject.startsWith("Re:") ? subject : `Re: ${subject || "your request"}`}`,
        inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
        references ? `References: ${references}` : null,
        "Content-Type: text/plain; charset=UTF-8",
        "MIME-Version: 1.0",
    ].filter(Boolean).join("\r\n");
    const raw = `${headers}\r\n\r\n${bodyText}`;
    return base64UrlEncode(raw);
}

export async function sendGmailReply(accessToken, { threadId, raw }) {
    return gmailFetch(accessToken, "/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw, threadId }),
    });
}
