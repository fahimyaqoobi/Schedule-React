import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { buildVoiceAccessToken, isVoiceConfigured } from "../../../../lib/twilioVoice";

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

// Mints a fresh, short-lived Voice access token for the calling admin's
// browser — fetched right before placing a call, not cached client-side
// longer than one session, since it costs nothing to re-mint and there's no
// reason to keep a long-lived credential sitting in the browser.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only admins can place calls." }, { status: 403 });
        }
        if (!isVoiceConfigured()) {
            return NextResponse.json({ error: "Calling isn't set up yet — add the Twilio Voice settings first." }, { status: 503 });
        }
        const token = buildVoiceAccessToken(user.uid);
        return NextResponse.json({ token }, { status: 200 });
    } catch (err) {
        console.error("GET twilio/voice-token error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
    }
}
