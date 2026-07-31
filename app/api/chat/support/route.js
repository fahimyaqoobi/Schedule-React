import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { identifyChatActor } from "../../../../lib/chatAuth";
import { normalizePhone } from "../../../../lib/phone";
import { appendSupportMessage, supportThreadId } from "../../../../lib/supportChat";
import { getStaffPhone } from "../../../../lib/staffNotify";
import { trySendSms, buildSupportMessageSms } from "../../../../lib/sms";

function canAccessThread(actor, type, refId) {
    if (actor.kind === "staff") return actor.isSupportStaff;
    if (actor.kind === "customer") return type === "customer" && normalizePhone(refId) === actor.phone;
    if (actor.kind === "cleaner") return type === "cleaner" && refId === actor.uid;
    return false;
}

// Persistent, always-open support thread — one per customer (spans every job
// they've ever had) and one per cleaner, both visible as a shared inbox to
// admin/ops/sales. This is where conversation goes once a job-chat locks.
export async function GET(request) {
    try {
        const actor = await identifyChatActor(request);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const refId = searchParams.get("refId");

        // No type/refId — the shared staff inbox listing every thread.
        if (!type || !refId) {
            if (!actor.isSupportStaff) {
                return NextResponse.json({ error: "Forbidden: Only support staff can view the inbox." }, { status: 403 });
            }
            const snap = await adminDb.collection("supportThreads").get();
            const threads = snap.docs.map(doc => doc.data()).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
            return NextResponse.json(threads, { status: 200 });
        }

        if (!canAccessThread(actor, type, refId)) {
            return NextResponse.json({ error: "Forbidden: You cannot view this support thread." }, { status: 403 });
        }

        const id = supportThreadId(type, refId);
        const threadSnap = await adminDb.collection("supportThreads").doc(id).get();
        const messagesSnap = await adminDb.collection("supportMessages").where("threadId", "==", id).get();
        const messages = messagesSnap.docs.map(doc => doc.data()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return NextResponse.json({ thread: threadSnap.exists ? threadSnap.data() : { id, type, refId }, messages }, { status: 200 });
    } catch (err) {
        console.error("GET support chat error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const actor = await identifyChatActor(request);
        const { type, refId, refName, text } = await request.json();
        if (!type || !refId || !String(text || "").trim()) {
            return NextResponse.json({ error: "Missing type, refId, or message text." }, { status: 400 });
        }
        if (!canAccessThread(actor, type, refId)) {
            return NextResponse.json({ error: "Forbidden: You cannot post to this support thread." }, { status: 403 });
        }

        const senderKind = actor.kind;
        const senderName = actor.kind === "staff" ? actor.name : (refName || (actor.kind === "customer" ? "Customer" : "Cleaner"));

        const { message } = await appendSupportMessage(adminDb, {
            type, refId, refName,
            senderKind,
            senderId: actor.uid || actor.phone,
            senderName,
            text,
        });

        // Staff starting or replying in a thread also goes out as a real
        // text — and because of the Twilio inbound webhook, whatever they
        // text back lands right back in this same thread.
        if (senderKind === "staff") {
            const phone = type === "customer" ? normalizePhone(refId) : await getStaffPhone(adminDb, refId);
            if (phone) {
                await trySendSms(phone, buildSupportMessageSms(message.text, actor.name));
            }
        }

        return NextResponse.json({ message: "Sent.", chatMessage: message }, { status: 200 });
    } catch (err) {
        console.error("POST support chat error:", err);
        return NextResponse.json({ error: err.message || "Failed to send message." }, { status: 500 });
    }
}
