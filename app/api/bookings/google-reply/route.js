import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { userCanAccessBranch, DEFAULT_BRANCH_ID } from "../../../../lib/branches";
import { getGmailAccessToken, buildReplyRawMessage, sendGmailReply } from "../../../../lib/googleGmail";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) throw new Error("User profile not found");
    const userData = userDoc.data();
    if (userData.status !== "approved") throw new Error("User account is pending approval or disabled");
    return userData;
}

// Sends an admin-typed reply into the exact same Gmail thread a Google
// Local Services lead notification arrived on — reaching the customer
// through Google's own anonymized alias, the only channel that counts
// toward the "typically responds within" badge (see lib/googleGmail.js for
// why this is the Gmail account and not the Local Services Ads API).
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only admins can reply to leads." }, { status: 403 });
        }

        const { bookingId, text, attachmentUrl, attachmentName, attachmentMimeType } = await request.json();
        const trimmedText = String(text || "").trim();
        if (!bookingId || (!trimmedText && !attachmentUrl)) {
            return NextResponse.json({ error: "Missing bookingId, and neither reply text nor an attachment was provided." }, { status: 400 });
        }

        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const snap = await bookingRef.get();
        if (!snap.exists) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

        const booking = snap.data();
        if (!userCanAccessBranch(user, booking.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "Forbidden: You cannot reply to this branch's lead." }, { status: 403 });
        }
        if (!booking.googleGmail?.threadId || !booking.googleGmail?.replyTo) {
            return NextResponse.json({ error: "This lead has no Google Gmail thread to reply to." }, { status: 422 });
        }

        // The browser already uploaded the file to Storage (see
        // app/api/uploads/google-lead-attachment) — fetch the bytes
        // server-side and embed them in the outgoing email. Whether
        // Google's relay actually forwards the file to the real customer
        // (vs. just the text) isn't documented, so this is worth confirming
        // with a real send.
        let attachment = null;
        if (attachmentUrl) {
            const fileRes = await fetch(attachmentUrl);
            if (!fileRes.ok) throw new Error("Could not fetch the attachment to send it.");
            const data = Buffer.from(await fileRes.arrayBuffer());
            attachment = { filename: attachmentName || "attachment", mimeType: attachmentMimeType || "application/octet-stream", data };
        }

        const accessToken = await getGmailAccessToken();
        const raw = buildReplyRawMessage({
            to: booking.googleGmail.replyTo,
            subject: booking.googleGmail.subject || "Potential Customer's new request",
            bodyText: trimmedText,
            inReplyTo: booking.googleGmail.lastMessageId,
            references: booking.googleGmail.lastMessageId,
            attachment,
        });
        await sendGmailReply(accessToken, { threadId: booking.googleGmail.threadId, raw });

        const sentMessage = {
            id: `ggm-${Date.now()}`,
            senderKind: "admin",
            senderId: "admin",
            senderName: user.name || user.email || "SmarTouch Clean",
            text: trimmedText,
            ...(attachmentUrl ? { attachment: { url: attachmentUrl, name: attachmentName || "attachment", mimeType: attachmentMimeType || "" } } : {}),
            createdAt: new Date().toISOString(),
        };
        await bookingRef.set({
            googleGmailMessages: [...(booking.googleGmailMessages || []), sentMessage],
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        return NextResponse.json({ message: "Reply sent.", sentMessage }, { status: 200 });
    } catch (err) {
        console.error("POST bookings/google-reply error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
    }
}
