// Parses "Local Services by Google" lead-notification emails into a plain
// lead object, and identifies which mailbox address to reply to for a given
// lead/conversation thread.

// Real sender pattern confirmed from a live notification email (e.g.
// customer-request-7274974223@awexpress.google.com). The captured digits are
// the stable per-lead identifier — see getLeadId below for why this matters
// more than Gmail's own threadId.
const LEAD_SENDER_PATTERN = /customer-request-([^@\s]+)@awexpress\.google\.com/i;

// Google sends at least two different templates into the same inbox: the
// initial "Potential Customer's new request" (labeled Name/Location/Service
// type/Message) and a later "Potential Customer sent you a message" (no
// labels — the reply text just sits in a plain box). Real-world testing
// showed Gmail does NOT reliably thread these two together (different
// subjects, no shared References/In-Reply-To), so Gmail's `threadId` is not
// a safe way to recognize "this is the same lead" — but the per-lead alias
// number in the sender address is present on every email Google sends about
// that lead, regardless of template or Gmail threading. That's the key the
// webhook matches new mail against (see getLeadId below).

// Boilerplate that shows up at the bottom of every Google notification
// template — cut everything from the first match onward before extracting
// fields, so neither the labeled fields nor the "whole text" fallback ever
// pick up the address/legal footer, the "Reply to this email / Respond in
// the app" instructions, or (critically) a quoted echo of our own outgoing
// reply that Google's test-lead tool bounces back into the same box.
const FOOTER_MARKERS = [
    /^to connect with this customer$/i,
    /^need help\? we are here for you\.?$/i,
    /^google ireland ltd\.?,?$/i,
    /^you'?ve received this messages? from lead email/i,
    /^unsubscribe/i,
];

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

// The stable identifier for this lead/conversation — the digits Google puts
// in the per-lead alias. Every email Google sends about one Local Services
// request reuses this same alias (new request, later messages, everything),
// even when those emails land as separate, un-threaded Gmail conversations.
// This is what new incoming mail gets matched against to find "is this the
// same lead I already created", not Gmail's threadId.
export function getLeadId(headers = []) {
    const replyTo = getHeader(headers, "Reply-To");
    const from = getHeader(headers, "From");
    const match = replyTo.match(LEAD_SENDER_PATTERN) || from.match(LEAD_SENDER_PATTERN);
    return match ? match[1] : "";
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

// Cuts the text at the first footer marker so nothing below it (address,
// legal disclaimer, reply instructions, or an echoed quote of a prior
// message) ever ends up in an extracted field.
function cutFooter(lines) {
    const idx = lines.findIndex(line => FOOTER_MARKERS.some(pattern => pattern.test(line)));
    return idx === -1 ? lines : lines.slice(0, idx);
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

// The "sent you a message" follow-up template has no "Message" label at
// all — the reply text just sits below a "<Name> sent you a message" line
// (after any activity-feed noise like "New event"). Take everything after
// that line, minus known noise lines, as the message.
const NOISE_LINE = /^(new event|new message:?)$/i;
function extractFollowUpMessage(lines) {
    const idx = lines.findIndex(line => /sent you a message$/i.test(line));
    if (idx === -1) return "";
    return lines.slice(idx + 1).filter(line => !NOISE_LINE.test(line)).join("\n").trim();
}

// message = a Gmail API `users.messages.get(format=full)` response.
export function parseLocalServicesLead(message) {
    const headers = message.payload?.headers || [];
    const html = findBodyPart(message.payload, "text/html");
    const plain = findBodyPart(message.payload, "text/plain");
    const fullText = stripHtml(html) || plain.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
    const lines = cutFooter(fullText.split("\n"));

    const labeledMessage = extractField(lines, "Message");
    const message_ = labeledMessage || extractFollowUpMessage(lines);

    return {
        subject: getHeader(headers, "Subject"),
        messageId: getHeader(headers, "Message-ID"),
        threadId: message.threadId,
        replyTo: getLeadReplyAddress(headers),
        leadId: getLeadId(headers),
        name: extractField(lines, "Name") || "Potential Customer",
        location: extractField(lines, "Location"),
        serviceType: extractField(lines, "Service type"),
        message: message_,
        rawText: lines.join("\n"),
        receivedAt: new Date(Number(message.internalDate || Date.now())).toISOString(),
    };
}
