import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { normalizePhone } from "../../../../lib/phone";
import { validateTwilioSignature, getPublicWebhookUrl } from "../../../../lib/twilioWebhook";
import { appendJobActivityMessage, JOB_CHAT_LOCKED_STATUSES } from "../../../../lib/jobChat";
import { appendSupportMessage } from "../../../../lib/supportChat";

function todayStr() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function formatDuration(seconds) {
    const s = Number(seconds || 0);
    if (s < 60) return `${s}s`;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}m${rem ? ` ${rem}s` : ""}`;
}

// Same "today's job first, persistent thread otherwise" routing the inbound-
// SMS webhook uses — a call about an open job today almost always IS about
// that job; anything ambiguous falls back to the general customer thread
// rather than guessing wrong.
async function findTodaysJobForPhone(phone) {
    const snap = await adminDb.collection("bookings").where("date", "==", todayStr()).get();
    const candidates = snap.docs
        .map(d => d.data())
        .filter(b => !JOB_CHAT_LOCKED_STATUSES.has(b.status) && normalizePhone(b.phone || b.customerPortalPhone || "") === phone);
    return candidates.length === 1 ? candidates[0] : null;
}

// Twilio's status callback for every call leg — fired multiple times per
// call (initiated/ringing/answered/completed); only "completed" carries the
// final duration, so that's the only event actually logged, to avoid four
// partial entries per call.
export async function POST(request) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const formData = await request.formData();
    const params = Object.fromEntries(formData.entries());

    const signature = request.headers.get("x-twilio-signature") || "";
    const url = getPublicWebhookUrl(request);
    const valid = validateTwilioSignature({ url, params, signature, authToken });
    if (!valid) {
        console.error("Twilio voice-status signature mismatch", { url, hasSignature: Boolean(signature) });
        return new NextResponse(null, { status: 403 });
    }

    try {
        if (params.CallStatus === "completed") {
            const { searchParams } = new URL(request.url);
            const bookingId = searchParams.get("bookingId");
            const isInbound = searchParams.get("direction") === "inbound";
            const duration = formatDuration(params.CallDuration);

            if (bookingId) {
                // Outbound, placed from a specific booking's Call button.
                await appendJobActivityMessage(adminDb, {
                    bookingId,
                    summary: `📞 Outbound call to customer — ${duration}`,
                    by: "system",
                });
            } else if (isInbound) {
                const from = normalizePhone(searchParams.get("from") || params.From || "");
                const todaysJob = from ? await findTodaysJobForPhone(from) : null;
                if (todaysJob) {
                    await appendJobActivityMessage(adminDb, {
                        bookingId: todaysJob.id,
                        summary: `📞 Incoming call from customer, forwarded — ${duration}`,
                        by: "system",
                    });
                } else if (from) {
                    await appendSupportMessage(adminDb, {
                        type: "customer",
                        refId: from,
                        senderKind: "system",
                        senderId: "system",
                        senderName: "System",
                        text: `📞 Incoming call, forwarded — ${duration}`,
                    });
                }
            }
        }
    } catch (err) {
        // Never fail the webhook over a logging problem — Twilio doesn't
        // retry status callbacks in a way that would help, and the call
        // itself already happened regardless of whether this note got saved.
        console.error("twilio-voice-status logging error:", err);
    }

    return new NextResponse(null, { status: 200 });
}
