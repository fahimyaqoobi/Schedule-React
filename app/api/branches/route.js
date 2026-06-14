import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { BRANCHES, getBranchScopeForUser } from "../../../lib/branches";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) throw new Error("User profile not found");
    const user = userDoc.data();
    if (user.status !== "approved") throw new Error("User account is pending approval or disabled");
    return user;
}

export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const scope = getBranchScopeForUser(user);
        const branches = BRANCHES.filter(branch => scope.branchIds.includes(branch.id));

        return NextResponse.json({
            activeBranchId: scope.activeBranchId,
            canSwitchBranches: scope.canSwitchBranches,
            branches
        }, { status: 200 });
    } catch (err) {
        console.error("GET Branches Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
