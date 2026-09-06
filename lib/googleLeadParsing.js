// Parses "Local Services by Google" lead-notification emails into a plain
// lead object, and identifies which mailbox address to reply to for a given
// lead/conversation thread.

// Real sender pattern confirmed from a live notification email (e.g.
// customer-request-7274974223@awexpress.google.com) — this per-lead alias
// is what "Reply to this email" actually sends to, and it's unique per
// lead/conversation, not a fixed inbox.
const LEAD_SENDER_PATTERN = /customer-request-[^@\s]+@awexpress\.google\.com/i;

export function getHeader(headers = [], name) {
    const found = (headers || []).find(h => String(h.name || "").toLowerCase() === name.toLowerCase());
    return found?.value || "";
}

export function isLocalServicesLeadMessage(headers = []) {
    return LEAD_SENDER_PATTERN.test(getHeader(headers, "From"));
}

// The address to send a reply to for this lead — prefers Reply-To (what a
// real Gmail "Reply" click uses) but falls back to extracting the alias out
// of From if Reply-To is ever missing.
export function getLeadReplyAddress(headers = []) {
    const replyTo = getHeader(headers, "Reply-To");
    const from = getHeader(headers, "From");
    const source = replyTo || from;
    const match = source.match(LEAD_SENDER_PATTERN) || from.match(LEAD_SENDER_PATTERN);
    return match ? match[0] : source;
}

function decodeBase64Url(data = "") {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

// Gmail messages nest multipart/alternative (and sometimes multipart/related
// for embedded images) — walk the tree to find the part we want.
function findBodyPart(payload, mimeType) {
    if (!payload) return "";
    if (payload.mimeType === mimeType && payload.body?.data) return decodeBase64Url(payload.body.data);
    for (const part of payload.parts || []) {
        const found = findBodyPart(part, mimeType);
        if (found) return found;
    }
    return "";
}

function stripHtml(html = "") {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|td)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n");
}

// Google's own template labels each field ("Name", "Location", "Service
// type", "Message") on its own line, value on the line right after — this
// matches the exact layout from the reported notification email. Falls back
// gracefully (empty string) if a label isn't found, rather than throwing, so
// a template tweak on Google's side degrades instead of breaking ingestion.
function extractField(lines, label) {
    const idx = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
    if (idx === -1 || idx + 1 >= lines.length) return "";
    return lines[idx + 1];
}

// message = a Gmail API `users.messages.get(format=full)` response.
export function parseLocalServicesLead(message) {
    const headers = message.payload?.headers || [];
    const html = findBodyPart(message.payload, "text/html");
    const plain = findBodyPart(message.payload, "text/plain");
    const text = stripHtml(html) || plain.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
    const lines = text.split("\n");

    return {
        subject: getHeader(headers, "Subject"),
        messageId: getHeader(headers, "Message-ID"),
        threadId: message.threadId,
        replyTo: getLeadReplyAddress(headers),
        name: extractField(lines, "Name") || "Potential Customer",
        location: extractField(lines, "Location"),
        serviceType: extractField(lines, "Service type"),
        message: extractField(lines, "Message"),
        rawText: text,
        receivedAt: new Date(Number(message.internalDate || Date.now())).toISOString(),
    };
}
