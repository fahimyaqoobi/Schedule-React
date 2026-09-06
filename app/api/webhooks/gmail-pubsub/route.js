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

const GOOGLE_LEAD_ALERT_PHONE = process.env.GOOGLE_LEAD_ALERT_PHONE || "6134165001";

function buildNewLeadBooking(id, lead) {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const branch = getBranchById(DEFAULT_BRANCH_ID);
    const nameParts = String(lead.name || "").trim().split(/\s+/);
    return {
        id,
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
            threadId: lead.threadId,
            replyTo: lead.replyTo,
            lastMessageId: lead.messageId,
            subject: lead.subject,
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

        for (const messageId of addedMessageIds) {
            const processedRef = adminDb.collection("googleGmailProcessed").doc(messageId);
            if ((await processedRef.get()).exists) continue;

            const full = await getGmailMessage(accessToken, messageId);
            const headers = full.payload?.headers || [];
            const isLeadSender = isLocalServicesLeadMessage(headers);

            // A customer's own follow-up in an already-known thread should
            // still be captured even if its own From/Reply-To no longer
            // matches the lead-alias pattern exactly.
            const existingSnap = await adminDb.collection("bookings")
                .where("googleGmail.threadId", "==", full.threadId)
                .limit(1)
                .get();

            if (!isLeadSender && existingSnap.empty) {
                await processedRef.set({ processedAt: new Date().toISOString(), skipped: true });
                continue;
            }

            const lead = parseLocalServicesLead(full);

            if (!existingSnap.empty) {
                const doc = existingSnap.docs[0];
                const booking = doc.data();
                const newMessage = {
                    id: `ggm-${Date.now()}`,
                    senderKind: "customer",
                    senderId: "customer",
                    senderName: booking.clientName || lead.name,
                    text: lead.message || lead.rawText || "(no message text)",
                    createdAt: lead.receivedAt,
                };
                await doc.ref.set({
                    googleGmailMessages: [...(booking.googleGmailMessages || []), newMessage],
                    googleGmail: { ...(booking.googleGmail || {}), lastMessageId: lead.messageId || booking.googleGmail?.lastMessageId },
                    updatedAt: new Date().toISOString(),
                }, { merge: true });

                await createNotification(adminDb, {
                    type: "google_lead_reply",
                    title: "Google Lead replied",
                    body: newMessage.text,
                    branchId: booking.branchId || DEFAULT_BRANCH_ID,
                    link: `/?job=${booking.id}`,
                    refId: booking.id,
                });
                await trySendSms(GOOGLE_LEAD_ALERT_PHONE, buildGoogleLeadAlertSms({ ...lead, name: booking.clientName || lead.name }));
            } else {
                const id = `lead-${Date.now()}`;
                const newLeadBooking = buildNewLeadBooking(id, lead);
                await adminDb.collection("bookings").doc(id).set(newLeadBooking);

                await createNotification(adminDb, {
                    type: "google_lead",
                    title: "New Google Lead",
                    body: lead.message || `${lead.name} — ${lead.serviceType || "inquiry"}`,
                    branchId: newLeadBooking.branchId,
                    link: `/?job=${id}`,
                    refId: id,
                });
                await trySendSms(GOOGLE_LEAD_ALERT_PHONE, buildGoogleLeadAlertSms(lead));
            }

            await processedRef.set({ processedAt: new Date().toISOString() });
        }

        // Only advance the watermark once every message in this batch is
        // fully handled — if something throws above, next push (or the next
        // watch renewal) re-lists from the same startHistoryId and retries
        // the ones that never got marked processed. No lead gets skipped.
        await saveGmailSettings({ historyId: decoded.historyId });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("POST gmail-pubsub webhook error:", err);
        // Non-2xx tells Pub/Sub to retry with backoff — appropriate here
        // since most failures (a Gmail API hiccup, a transient Firestore
        // error) are transient, and losing a lead silently is the one
        // outcome worth avoiding.
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
