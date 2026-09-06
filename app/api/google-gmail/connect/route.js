import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { canManageSystem } from "../../../../lib/permissions";
import { buildGmailAuthUrl } from "../../../../lib/googleGmail";

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

// Step 1 of the one-time Gmail connection flow: an admin's browser fetches
// this (with their normal Bearer token) to get the Google consent URL, then
// does a top-level navigation to it — the OAuth screen and Google's redirect
// back to our callback can't carry that Authorization header, so a short
// CSRF `state` value is stashed in an httpOnly cookie instead and checked in
// the callback.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can connect Gmail." }, { status: 403 });
        }

        const origin = request.headers.get("origin") || request.nextUrl.origin;
        const redirectUri = `${origin}/api/google-gmail/callback`;
        const state = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const url = buildGmailAuthUrl({ redirectUri, state });

        const response = NextResponse.json({ url }, { status: 200 });
        response.cookies.set("gmail_oauth_state", state, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 600,
            path: "/",
        });
        return response;
    } catch (err) {
        console.error("GET google-gmail/connect error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
