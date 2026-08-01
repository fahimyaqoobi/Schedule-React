import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebase-admin";
import { identifyChatActor } from "../../../../../lib/chatAuth";

// Support-staff-only listing of job chats — one row per booking that has at
// least one jobChatMessages entry, most-recently-active first. This is what
// lets MessagesTab show job threads alongside the persistent support
// threads, so nothing requires digging into a specific booking to find it.
export async function GET(request) {
    try {
        const actor = await identifyChatActor(request);
        if (actor.kind !== "staff" || !actor.isSupportStaff) {
            return NextResponse.json({ error: "Forbidden: Only support staff can view job chat threads." }, { status: 403 });
        }

        const messagesSnap = await adminDb.collection("jobChatMessages").orderBy("createdAt", "desc").limit(300).get();
        const latestByBooking = new Map();
        for (const doc of messagesSnap.docs) {
            const m = doc.data();
            if (!latestByBooking.has(m.bookingId)) latestByBooking.set(m.bookingId, m);
        }

        const bookingIds = [...latestByBooking.keys()].slice(0, 50);
        const bookingSnaps = await Promise.all(bookingIds.map(id => adminDb.collection("bookings").doc(id).get()));

        const threads = bookingSnaps
            .filter(snap => snap.exists)
            .map(snap => {
                const booking = snap.data();
                const lastMessage = latestByBooking.get(snap.id);
                return {
                    id: `job_${snap.id}`,
                    kind: "job",
                    bookingId: snap.id,
                    refName: booking.clientName || "Customer",
                    service: booking.service || "",
                    date: booking.date || "",
                    status: booking.status || "",
                    lastMessagePreview: lastMessage.text.slice(0, 140),
                    lastMessageAt: lastMessage.createdAt,
                };
            })
            .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

        return NextResponse.json(threads, { status: 200 });
    } catch (err) {
        console.error("GET job chat threads error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
