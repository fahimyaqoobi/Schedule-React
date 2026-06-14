import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../../lib/firebase-admin";

function normalizePhoneNumber(value = "") {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) {
        return `+${trimmed.slice(1).replace(/\D/g, "")}`;
    }
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
}

function createVerificationCode() {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function sendSmsCode(phoneNumber, code) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
        throw new Error("Twilio environment variables are missing.");
    }

    const params = new URLSearchParams();
    params.set("To", phoneNumber);
    params.set("Body", `Your SmarTouch Clean verification code is ${code}. It expires in 10 minutes.`);
    if (messagingServiceSid) {
        params.set("MessagingServiceSid", messagingServiceSid);
    } else {
        params.set("From", fromNumber);
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Twilio SMS failed: ${errorData}`);
    }
}

export async function POST(request) {
    try {
        const { phone, mode = "login", name = "" } = await request.json();
        const phoneNumber = normalizePhoneNumber(phone);

        if (!phoneNumber) {
            return NextResponse.json({ error: "Valid phone number is required." }, { status: 400 });
        }

        const phoneExistsInAuth = await adminAuth.getUserByPhoneNumber(phoneNumber).then(() => true).catch(() => false);

        if (mode === "signup" && phoneExistsInAuth) {
            return NextResponse.json({ error: "This phone number is already registered. Please sign in instead." }, { status: 400 });
        }

        if (mode === "login" && !phoneExistsInAuth) {
            return NextResponse.json({ error: "No account found for this phone number. Please sign up first." }, { status: 404 });
        }

        const code = createVerificationCode();
        const expiresAt = Date.now() + 10 * 60 * 1000;

        await adminDb.collection("phone_verifications").doc(phoneNumber).set({
            phone: phoneNumber,
            code,
            mode,
            name: String(name || "").trim(),
            attempts: 0,
            expiresAt,
            createdAt: new Date().toISOString()
        });

        await sendSmsCode(phoneNumber, code);

        return NextResponse.json({ message: "Verification code sent successfully." }, { status: 200 });
    } catch (error) {
        console.error("Phone send-code error:", error);
        return NextResponse.json({ error: error.message || "Failed to send verification code." }, { status: 500 });
    }
}
