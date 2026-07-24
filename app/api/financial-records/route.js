import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch } from "../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser } from "../../../lib/branches";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
        throw new Error("User profile not found");
    }
    return userDoc.data();
}

// READ: Per-job financial records (revenue/labor/material/profit) for Daily Business Performance.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch admins can view financial records." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const branchScope = getBranchScopeForUser(user);
        const requestedBranchId = searchParams.get("branchId");
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

        const snapshot = await adminDb.collection("financialRecords").where("branchId", "==", activeBranchId).get();
        const records = snapshot.docs.map(doc => doc.data());
        records.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        return NextResponse.json(records, { status: 200 });
    } catch (error) {
        console.error("GET financial records error:", error);
        return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
    }
}
