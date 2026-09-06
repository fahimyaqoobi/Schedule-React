import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { canManageSystem } from "../../../../lib/permissions";
import { getGmailSettings } from "../../../../lib/googleGmail";

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

export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const settings = await getGmailSettings();
        return NextResponse.json({
            connected: Boolean(settings?.connected && settings?.refreshToken),
            connectedAt: settings?.connectedAt || null,
            watchExpiration: settings?.watchExpiration || null,
        }, { status: 200 });
    } catch (err) {
        console.error("GET google-gmail/status error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
