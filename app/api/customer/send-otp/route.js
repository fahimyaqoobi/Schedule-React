import { NextResponse } from "next/server";
import twilio from "twilio";

function getTwilio() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const service = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!sid || !token || !service) throw new Error("SMS service not configured.");
    return { client: twilio(sid, token), service };
}

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (ten.length !== 10) throw new Error("Invalid phone number.");
    return ten;
}

export async function POST(request) {
    try {
        const { phone } = await request.json();
        const normalized = normalizePhone(phone);
        const { client, service } = getTwilio();

        await client.verify.v2.services(service)
            .verifications
            .create({ to: `+1${normalized}`, channel: "sms" });

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
