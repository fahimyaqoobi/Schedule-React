import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { identifyChatActor } from "../../../../lib/chatAuth";
import { normalizePhone } from "../../../../lib/phone";
import { appendJobChatMessage, JOB_CHAT_LOCKED_STATUSES } from "../../../../lib/jobChat";
import { getStaffPhone } from "../../../../lib/staffNotify";
import { trySendSms, buildJobChatMessageSms } from "../../../../lib/sms";

async function authorizeForBooking(actor, booking) {
    if (actor.kind === "staff") return actor.isSupportStaff;
    if (actor.kind === "cleaner") return (booking.assignedStaffIds || []).includes(actor.uid);
    if (actor.kind === "customer") {
        const bookingPhone = normalizePhone(booking.phone || booking.customerPortalPhone || "");
        return bookingPhone && bookingPhone === actor.phone;
    }
    return false;
}

// Per-job chat between the customer and their assigned cleaner — visible to
// support staff too. Locks (read-only) once the job is Completed or
// Cancelled; further questions route to the persistent support thread.
export async function GET(request) {
    try {
        const actor = await identifyChatActor(request);
        const { searchParams } = new URL(request.url);
        const bookingId = searchParams.get("bookingId");
        if (!bookingId) return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });

        const bookingSnap = await adminDb.collection("bookings").doc(bookingId).get();
        if (!bookingSnap.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
        const booking = bookingSnap.data();

        if (!(await authorizeForBooking(actor, booking))) {
            return NextResponse.json({ error: "Forbidden: You cannot view this job's chat." }, { status: 403 });
        }

        const messagesSnap = await adminDb.collection("jobChatMessages").where("bookingId", "==", bookingId).get();
        const messages = messagesSnap.docs.map(doc => doc.data()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return NextResponse.json({
            messages,
            locked: JOB_CHAT_LOCKED_STATUSES.has(booking.status),
            booking: { id: booking.id, status: booking.status, clientName: booking.clientName, service: booking.service, date: booking.date },
        }, { status: 200 });
    } catch (err) {
        console.error("GET job chat error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const actor = await identifyChatActor(request);
        const { bookingId, text } = await request.json();
        if (!bookingId || !String(text || "").trim()) {
            return NextResponse.json({ error: "Missing bookingId or message text." }, { status: 400 });
        }

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const bookingSnap = await bookingRef.get();
        if (!bookingSnap.exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
        const booking = bookingSnap.data();

        if (!(await authorizeForBooking(actor, booking))) {
            return NextResponse.json({ error: "Forbidden: You cannot post to this job's chat." }, { status: 403 });
        }
        if (JOB_CHAT_LOCKED_STATUSES.has(booking.status)) {
            return NextResponse.json({ error: "This job is closed — start a new conversation in Support instead." }, { status: 400 });
        }

        const senderName = actor.kind === "customer" ? (booking.clientName || "Customer") : actor.name;
        const message = await appendJobChatMessage(adminDb, {
            bookingId,
            senderKind: actor.kind,
            senderId: actor.uid || actor.phone,
            senderName,
            text,
            branchId: booking.branchId || "",
        });

        // Whoever didn't send it gets a real text — the customer if a
        // cleaner/staff wrote in, every assigned cleaner if the customer did.
        // A reply lands right back in this same job's chat via the Twilio
        // inbound webhook (while the job's still open).
        const smsBody = buildJobChatMessageSms(message.text, senderName, booking);
        if (actor.kind === "customer") {
            const staffIds = booking.assignedStaffIds || [];
            const phones = await Promise.all(staffIds.map((uid) => getStaffPhone(adminDb, uid)));
            await Promise.allSettled(phones.filter(Boolean).map((phone) => trySendSms(phone, smsBody)));
        } else {
            const customerPhone = normalizePhone(booking.customerPortalPhone || booking.phone || "");
            if (customerPhone) await trySendSms(customerPhone, smsBody);
        }

        return NextResponse.json({ message: "Sent.", chatMessage: message }, { status: 200 });
    } catch (err) {
        console.error("POST job chat error:", err);
        return NextResponse.json({ error: err.message || "Failed to send message." }, { status: 500 });
    }
}
