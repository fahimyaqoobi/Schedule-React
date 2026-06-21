import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";

function normalizePhone(raw = "") {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
    return digits;
}

async function sendSms(to, code) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
        throw new Error("SMS service is not configured.");
    }

    const params = new URLSearchParams();
    params.set("To", `+1${to}`);
    params.set("Body", `Your SmarTouch Clean verification code is ${code}. It expires in 10 minutes.`);
    if (messagingServiceSid) {
        params.set("MessagingServiceSid", messagingServiceSid);
    } else {
        params.set("From", fromNumber);
    }

    const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`SMS failed: ${err}`);
    }
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

        await sendSms(normalized, code);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("customer send-otp error:", err);
        return NextResponse.json({ error: err.message || "Failed to send code." }, { status: 500 });
    }
}
