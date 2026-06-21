import { NextResponse } from "next/server";
import twilio from "twilio";
import { signCustomerSession } from "../../../../lib/customerSession";

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
        const { phone, code } = await request.json();
        if (!code || String(code).replace(/\D/g, "").length !== 6) throw new Error("Please enter the 6-digit code.");

        const normalized = normalizePhone(phone);
        const { client, service } = getTwilio();

        const check = await client.verify.v2.services(service)
            .verificationChecks
            .create({ to: `+1${normalized}`, code: String(code) });

        if (check.status !== "approved") throw new Error("Incorrect code. Please try again.");

        const sessionToken = signCustomerSession(normalized);
        return NextResponse.json({ ok: true, sessionToken });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
