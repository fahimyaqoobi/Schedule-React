import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { identifyChatActor } from "../../../../lib/chatAuth";
import { normalizePhone } from "../../../../lib/phone";

const LOCKED_STATUSES = new Set(["Completed", "Cancelled"]);

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
            locked: LOCKED_STATUSES.has(booking.status),
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
        if (LOCKED_STATUSES.has(booking.status)) {
            return NextResponse.json({ error: "This job is closed — start a new conversation in Support instead." }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const id = `jcm-${Date.now()}`;
        const senderName = actor.kind === "customer" ? (booking.clientName || "Customer") : actor.name;
        const message = {
            id, bookingId,
            senderKind: actor.kind,
            senderId: actor.uid || actor.phone,
            senderName,
            text: String(text).trim(),
            createdAt: nowIso,
        };
        await adminDb.collection("jobChatMessages").doc(id).set(message);
        return NextResponse.json({ message: "Sent.", chatMessage: message }, { status: 200 });
    } catch (err) {
        console.error("POST job chat error:", err);
        return NextResponse.json({ error: err.message || "Failed to send message." }, { status: 500 });
    }
}
