import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { FINANCE_SETTINGS_DEFAULTS as DEFAULTS } from "../../../../lib/financeDefaults";

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
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch admins can view finance settings." }, { status: 403 });
        }
        const docSnap = await adminDb.collection("settings").doc("finance").get();
        return NextResponse.json({ ...DEFAULTS, ...(docSnap.exists ? docSnap.data() : {}) }, { status: 200 });
    } catch (err) {
        console.error("GET finance settings error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch admins can edit finance settings." }, { status: 403 });
        }
        const body = await request.json();
        const payload = {
            openingCapital: Number(body.openingCapital ?? DEFAULTS.openingCapital),
            paymentTermsDays: Number(body.paymentTermsDays ?? DEFAULTS.paymentTermsDays),
            cardProcessingFeeRatePercent: Number(body.cardProcessingFeeRatePercent ?? DEFAULTS.cardProcessingFeeRatePercent),
            cardProcessingFeeFixed: Number(body.cardProcessingFeeFixed ?? DEFAULTS.cardProcessingFeeFixed),
            updatedAt: new Date().toISOString(),
            updatedBy: user.email || user.uid,
        };
        await adminDb.collection("settings").doc("finance").set(payload, { merge: true });
        return NextResponse.json({ message: "Finance settings saved.", ...payload }, { status: 200 });
    } catch (err) {
        console.error("PUT finance settings error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
