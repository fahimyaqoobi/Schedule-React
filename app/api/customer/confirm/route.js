import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function POST(request) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
        const token = authHeader.split("Bearer ")[1];

        const decoded = await adminAuth.verifyIdToken(token);
        const authPhone = normalizePhone(decoded.phone_number || "");
        if (!authPhone) throw new Error("No phone number on this account.");

        const { bookingId } = await request.json();
        if (!bookingId) throw new Error("Missing bookingId");

        const ref = adminDb.collection("bookings").doc(bookingId);
        const snap = await ref.get();
        if (!snap.exists) throw new Error("Booking not found.");

        const data = snap.data();
        const bookingPhone = normalizePhone(data.phone || "");
        if (bookingPhone !== authPhone) throw new Error("This booking is not associated with your phone number.");

        if (data.customerConfirmed) {
            return NextResponse.json({ message: "Already confirmed", alreadyConfirmed: true });
        }

        const nextStatus = ["Lead", "Follow Up"].includes(data.status) ? "Pending" : data.status;

        await ref.update({
            customerConfirmed: true,
            customerConfirmedAt: new Date().toISOString(),
            status: nextStatus,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Job confirmed successfully" });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
