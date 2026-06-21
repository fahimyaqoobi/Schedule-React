import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { getSessionPhoneAny } from "../../../../lib/customerSession";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export async function GET(request) {
    try {
        const phone = getSessionPhoneAny(request);

        const snap = await adminDb.collection("bookings")
            .where("phone", "==", phone)
            .get();

        const bookings = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => normalizePhone(b.phone) === phone)
            .sort((a, b) => (b.date || "") > (a.date || "") ? 1 : -1);

        return NextResponse.json({ ok: true, bookings });
    } catch (err) {
        const status = err.message === "Unauthorized" ? 401 : 400;
        return NextResponse.json({ error: err.message }, { status });
    }
}
