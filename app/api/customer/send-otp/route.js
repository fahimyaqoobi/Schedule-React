import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { sendSms } from "../../../../lib/sms";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits;
}

export async function POST(request) {
    try {
        const { phone } = await request.json();
        const normalized = normalizePhone(phone);

        if (normalized.length !== 10) {
            return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
        }

        const code = `${Math.floor(100000 + Math.random() * 900000)}`;
        const expiresAt = Date.now() + 10 * 60 * 1000;

        await adminDb.collection("customer_otps").doc(normalized).set({
            phone: normalized,
            code,
            attempts: 0,
            expiresAt,
            createdAt: new Date().toISOString(),
        });

        await sendSms(normalized, `Your SmarTouch Clean verification code is ${code}. It expires in 10 minutes.`);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("customer send-otp error:", err);
        return NextResponse.json({ error: err.message || "Failed to send code." }, { status: 500 });
    }
}
