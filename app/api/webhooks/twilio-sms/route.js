import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { normalizePhone } from "../../../../lib/phone";
import { appendSupportMessage } from "../../../../lib/supportChat";
import { validateTwilioSignature, getPublicWebhookUrl } from "../../../../lib/twilioWebhook";

const FIELD_STAFF_ROLES = new Set(["cleaner", "subcontractor", "supervisor", "employee"]);

function emptyTwiml() {
    return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
    });
}

// A cleaner or customer replies to a text they got from us — this is the
// other half of two-way SMS: the reply comes back in here and lands in the
// exact same support thread as if they'd typed it in the app.
export async function POST(request) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const formData = await request.formData();
    const params = Object.fromEntries(formData.entries());

    const signature = request.headers.get("x-twilio-signature") || "";
    const url = getPublicWebhookUrl(request);
    const valid = validateTwilioSignature({ url, params, signature, authToken });
    if (!valid) {
        console.error("Twilio webhook signature mismatch", { url, hasSignature: Boolean(signature) });
        return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
    }

    try {
        const fromRaw = params.From || "";
        const body = String(params.Body || "").trim();
        const fromPhone = normalizePhone(fromRaw);
        if (!fromPhone || !body) return emptyTwiml();

        // Only field staff are matched as "cleaner" — everyone else (including
        // an unrecognized number) is treated as a customer support thread.
        const usersSnap = await adminDb.collection("users")
            .where("staffProfile.personal.phone", "!=", "")
            .get();
        const matchedStaff = usersSnap.docs
            .map(doc => doc.data())
            .find(u => FIELD_STAFF_ROLES.has(u.role) && normalizePhone(u.staffProfile?.personal?.phone) === fromPhone);

        if (matchedStaff) {
            await appendSupportMessage(adminDb, {
                type: "cleaner",
                refId: matchedStaff.uid,
                refName: matchedStaff.name,
                senderKind: "cleaner",
                senderId: matchedStaff.uid,
                senderName: matchedStaff.name || "Cleaner",
                text: body,
            });
        } else {
            await appendSupportMessage(adminDb, {
                type: "customer",
                refId: fromPhone,
                senderKind: "customer",
                senderId: fromPhone,
                senderName: "Customer",
                text: body,
            });
        }

        return emptyTwiml();
    } catch (err) {
        console.error("POST twilio-sms webhook error:", err);
        return emptyTwiml();
    }
}
