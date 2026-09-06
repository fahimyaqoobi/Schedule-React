import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import {
    getGmailSettings,
    saveGmailSettings,
    getGmailAccessToken,
    listGmailHistory,
    getGmailMessage,
} from "../../../../lib/googleGmail";
import { isLocalServicesLeadMessage, parseLocalServicesLead } from "../../../../lib/googleLeadParsing";
import { createNotification } from "../../../../lib/notifications";
import { trySendSms, buildGoogleLeadAlertSms } from "../../../../lib/sms";
import { DEFAULT_BRANCH_ID, getBranchById } from "../../../../lib/branches";
import { generateBookingOrderNumber } from "../../../../lib/bookingNumbers";

const GOOGLE_LEAD_ALERT_PHONE = process.env.GOOGLE_LEAD_ALERT_PHONE || "6134165001";

function normalizeForCompare(text = "") {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Google's Local Services "send a test lead" tool has no real second party —
// it simulates the round trip by bouncing activity back into the same
// inbox. In practice that means a reply we just sent can come back as a
// "Potential Customer sent you a message" notification a few seconds later,
// which would otherwise get filed as a brand-new inbound message and fire a
// duplicate notification/SMS. If the "new" text matches (or is contained
// in/contains) the most recent message WE sent on this lead, treat it as
// that echo rather than genuine new customer content.
function isEchoOfOurOwnReply(booking, incomingText) {
    const messages = booking.googleGmailMessages || [];
    const lastAdminMessage = [...messages].reverse().find(m => m.senderKind === "admin");
    if (!lastAdminMessage) return false;
    const a = normalizeForCompare(incomingText);
    const b = normalizeForCompare(lastAdminMessage.text);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

// The stable match key is the per-lead alias id (see getLeadId in
// lib/googleLeadParsing) — Gmail's own threadId isn't reliable here since
// Google's different notification templates for the same lead aren't
// always Gmail-threaded together. threadId is kept only as a fallback for
// the rare case a lead ID couldn't be extracted.
async function findExistingLeadBooking(lead) {
    if (lead.leadId) {
        const byLeadId = await adminDb.collection("bookings")
            .where("googleGmail.leadId", "==", lead.leadId)
            .limit(1)
            .get();
        if (!byLeadId.empty) return byLeadId.docs[0];
    }
    const byThreadId = await adminDb.collection("bookings")
        .where("googleGmail.threadId", "==", lead.threadId)
        .limit(1)
        .get();
    return byThreadId.empty ? null : byThreadId.docs[0];
}

function buildNewLeadBooking(id, orderNumber, lead) {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const branch = getBranchById(DEFAULT_BRANCH_ID);
    const nameParts = String(lead.name || "").trim().split(/\s+/);
    return {
        id,
        // Every other booking-creation path stamps this at creation time —
        // nothing else in the app ever assigns one afterward, so skipping
        // it left this showing as the literal word "Pending" forever, no
        // matter how many times the status was later changed.
        orderNumber,
        estimateNumber: orderNumber,
        invoiceNumber: "",
        clientName: lead.name || "Potential Customer",
        firstName: nameParts[0] || "Potential",
        lastName: nameParts.slice(1).join(" "),
        email: "",
        phone: "",
        address1: lead.location || "",
        city: lead.location || "",
        state: branch.province || "Ontario",
        country: branch.country || "Canada",
        postalCode: "",
        date: todayStr,
        time: "",
        duration: 0,
        service: lead.serviceType || "General Inquiry",
        cartItems: [],
        subtotal: 0,
        tax: 0,
        price: 0,
        status: "Lead",
        paymentStatus: "unpaid",
        documentStage: "estimate",
        leadSource: "Google",
        specialNotes: lead.message || lead.rawText || "",
        branchId: branch.id,
        branchName: branch.name,
        // Everything needed to send a reply back through the same Google
        // Local Services conversation later (see app/api/bookings/google-reply).
        googleGmail: {
            leadId: lead.leadId,
            threadId: lead.threadId,
            replyTo: lead.replyTo,
            lastMessageId: lead.messageId,
            subject: lead.subject,
            unread: true,
        },
        googleGmailMessages: [{
            id: `ggm-${Date.now()}`,
            senderKind: "customer",
            senderId: "customer",
            senderName: lead.name || "Potential Customer",
            text: lead.message || lead.rawText || "(no message text)",
            createdAt: lead.receivedAt,
        }],
        createdAt: new Date().toISOString(),
        createdBy: "google-lead-sync",
        auditLog: [{
            id: `log-${Date.now()}`,
            at: new Date().toISOString(),
            type: "created",
            by: "google-lead-sync",
            summary: "Lead created automatically from Google Local Services Ads",
            status: "Lead",
            paymentStatus: "unpaid",
        }],
    };
}

// Google Cloud Pub/Sub push endpoint — Gmail's `users.watch()` publishes a
// tiny {emailAddress, historyId} notification here within seconds of new
// mail landing in the inbox. This handler then asks Gmail what actually
// changed (history.list), pulls any new Local Services lead emails, and
// creates/updates the corresponding CRM lead + fires the notification/SMS.
//
// Auth: Pub/Sub push subscriptions can't send our own Bearer tokens, so this
// is protected the way Google's own docs recommend for push endpoints — a
// shared-secret token appended to the subscription's endpoint URL, checked
// here (see GMAIL_PUBSUB_WEBHOOK_SECRET / setup instructions in .env.local).
export async function POST(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const expectedToken = process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;
    if (!expectedToken || token !== expectedToken) {
        return NextResponse.json({ error: "Invalid webhook token" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const dataB64 = body?.message?.data;
        if (!dataB64) return NextResponse.json({ ok: true });

        const decoded = JSON.parse(Buffer.from(dataB64, "base64").toString("utf-8"));
        const settings = await getGmailSettings();
        if (!settings?.refreshToken) return NextResponse.json({ ok: true });

        const accessToken = await getGmailAccessToken();
        const startHistoryId = settings.historyId || decoded.historyId;
        const history = await listGmailHistory(accessToken, startHistoryId);

        const addedMessageIds = new Set();
        for (const record of history.history || []) {
            for (const added of record.messagesAdded || []) {
                addedMessageIds.add(added.message.id);
            }
        }

        // Each message is handled independently — one bad message (a
        // malformed email, a transient Gmail hiccup) used to throw the
        // WHOLE batch back to Pub/Sub as a failure, which blocked every
        // other message behind it and the historyId watermark from ever
        // advancing. Since Pub/Sub keeps redelivering an unacked
        // notification, that turned into a runaway pileup — the very
        // failure that caused a real lead to go unnoticed. Now a single
        // message's error is logged and skipped, not fatal to the batch.
        let anyFailures = false;
        for (const messageId of addedMessageIds) {
            const processedRef = adminDb.collection("googleGmailProcessed").doc(messageId);
            try {
                if ((await processedRef.get()).exists) continue;

                const full = await getGmailMessage(accessToken, messageId);
                const headers = full.payload?.headers || [];
                const isLeadSender = isLocalServicesLeadMessage(headers);
                const lead = parseLocalServicesLead(full);

                // A customer's own follow-up in an already-known lead should
                // still be captured even when its own From/Reply-To no
                // longer matches the lead-alias pattern exactly — matched
                // primarily by the stable per-lead id, not Gmail's threadId
                // (see findExistingLeadBooking for why).
                const existingDoc = await findExistingLeadBooking(lead);

                if (!isLeadSender && !existingDoc) {
                    await processedRef.set({ processedAt: new Date().toISOString(), skipped: true });
                    continue;
                }

                if (existingDoc) {
                    const booking = existingDoc.data();
                    const incomingText = lead.message || lead.rawText || "";

                    if (isEchoOfOurOwnReply(booking, incomingText)) {
                        // Google's test-lead tool bounced our own reply back
                        // — not a real new message, so skip notification/SMS/dup.
                        await processedRef.set({ processedAt: new Date().toISOString(), skippedAsEcho: true });
                        continue;
                    }

                    const newMessage = {
                        id: `ggm-${Date.now()}`,
                        senderKind: "customer",
                        senderId: "customer",
                        senderName: booking.clientName || lead.name,
                        text: incomingText || "(no message text)",
                        createdAt: lead.receivedAt,
                    };
                    await existingDoc.ref.set({
                        googleGmailMessages: [...(booking.googleGmailMessages || []), newMessage],
                        googleGmail: {
                            ...(booking.googleGmail || {}),
                            leadId: booking.googleGmail?.leadId || lead.leadId,
                            lastMessageId: lead.messageId || booking.googleGmail?.lastMessageId,
                            // Drives the highlighted row in Bookings — cleared
                            // when an admin opens this lead (see
                            // app/api/bookings/mark-lead-viewed).
                            unread: true,
                        },
                        updatedAt: new Date().toISOString(),
                    }, { merge: true });

                    await createNotification(adminDb, {
                        type: "google_lead_reply",
                        title: "Google Lead replied",
                        body: newMessage.text,
                        branchId: booking.branchId || DEFAULT_BRANCH_ID,
                        link: `?tab=bookings&job=${booking.id}`,
                        refId: booking.id,
                    });
                    await trySendSms(GOOGLE_LEAD_ALERT_PHONE, buildGoogleLeadAlertSms({ ...lead, name: booking.clientName || lead.name }));
                } else {
                    const id = `lead-${Date.now()}`;
                    const orderNumber = await generateBookingOrderNumber(adminDb);
                    const newLeadBooking = buildNewLeadBooking(id, orderNumber, lead);
                    await adminDb.collection("bookings").doc(id).set(newLeadBooking);

                    await createNotification(adminDb, {
                        type: "google_lead",
                        title: "New Google Lead",
                        body: lead.message || `${lead.name} — ${lead.serviceType || "inquiry"}`,
                        branchId: newLeadBooking.branchId,
                        link: `?tab=bookings&job=${id}`,
                        refId: id,
                    });
                    await trySendSms(GOOGLE_LEAD_ALERT_PHONE, buildGoogleLeadAlertSms(lead));
                }

                await processedRef.set({ processedAt: new Date().toISOString() });
            } catch (messageErr) {
                console.error(`gmail-pubsub: failed to process message ${messageId}:`, messageErr);
                // A 404 here means Gmail itself no longer has this message
                // (e.g. it was deleted moments after arriving) — retrying it
                // forever can never succeed, and confirmed in production:
                // leaving it unmarked wedged the historyId watermark behind
                // one permanently-gone message and silently blocked every
                // real lead queued after it for nearly an hour. Mark it done
                // (with the error recorded) so it stops blocking progress.
                // Anything else might be transient (a Gmail API hiccup, a
                // network blip) and is worth actually retrying, so it's left
                // unmarked and the watermark held back for it specifically.
                if (String(messageErr.message || "").includes("(404)")) {
                    await processedRef.set({ processedAt: new Date().toISOString(), permanentError: messageErr.message });
                } else {
                    anyFailures = true;
                }
            }
        }

        // Retry logic lives entirely in our own historyId watermark, not in
        // Pub/Sub's redelivery of this push notification — so this always
        // acks (200) to Pub/Sub either way, which is what stops a stuck
        // message from causing runaway redelivery. If nothing failed, the
        // watermark advances normally. If something did fail, the watermark
        // is deliberately left where it was: the next push (triggered by
        // literally any future new email) re-lists history from that same
        // old point, quietly retrying the stuck message alongside whatever
        // is new — already-succeeded messages are skipped via processedRef,
        // so nothing is reprocessed or duplicated.
        if (!anyFailures) {
            await saveGmailSettings({ historyId: decoded.historyId });
        }
        return NextResponse.json({ ok: true, hadFailures: anyFailures });
    } catch (err) {
        console.error("POST gmail-pubsub webhook error:", err);
        // Non-2xx tells Pub/Sub to retry with backoff — appropriate here
        // since most failures (a Gmail API hiccup, a transient Firestore
        // error) are transient, and losing a lead silently is the one
        // outcome worth avoiding.
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
