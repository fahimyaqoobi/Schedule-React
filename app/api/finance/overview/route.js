import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { DEFAULT_BRANCH_ID } from "../../../../lib/branches";
import { computeFinanceOverview } from "../../../../lib/finance";

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
            return NextResponse.json({ error: "Forbidden: Only branch admins can view finance data." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const from = searchParams.get("from") || "";
        const to = searchParams.get("to") || "";
        const branchId = user.branchId || DEFAULT_BRANCH_ID;

        const [bookingsSnap, expensesSnap, cashDepositsSnap, settingsSnap] = await Promise.all([
            adminDb.collection("bookings").where("branchId", "==", branchId).get(),
            adminDb.collection("expenses").where("branchId", "==", branchId).get(),
            adminDb.collection("cashDeposits").where("branchId", "==", branchId).get(),
            adminDb.collection("settings").doc("finance").get(),
        ]);

        const overview = computeFinanceOverview({
            bookings: bookingsSnap.docs.map(d => d.data()),
            expenses: expensesSnap.docs.map(d => d.data()),
            cashDeposits: cashDepositsSnap.docs.map(d => d.data()),
            settings: settingsSnap.exists ? settingsSnap.data() : {},
            from, to,
        });

        return NextResponse.json(overview, { status: 200 });
    } catch (err) {
        console.error("GET finance overview error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
