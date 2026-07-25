import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch } from "../../../lib/permissions";
import { DEFAULT_BRANCH_ID } from "../../../lib/branches";

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

// Log of cash-on-hand physically deposited to the bank — the other pieces of
// "cash remaining in hand" (received via bookings, used for cash-paid
// expenses) are read directly off bookings/expenses, so this is the one new
// ledger needed to track the cash-handling cycle.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch admins can view cash deposits." }, { status: 403 });
        }
        const branchId = user.branchId || DEFAULT_BRANCH_ID;
        const snap = await adminDb.collection("cashDeposits").where("branchId", "==", branchId).get();
        const deposits = snap.docs.map(doc => doc.data()).sort((a, b) => new Date(b.date) - new Date(a.date));
        return NextResponse.json(deposits, { status: 200 });
    } catch (err) {
        console.error("GET cash deposits error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch admins can log cash deposits." }, { status: 403 });
        }
        const { amount, date, notes } = await request.json();
        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
            return NextResponse.json({ error: "A valid deposit amount is required." }, { status: 400 });
        }
        const nowIso = new Date().toISOString();
        const id = `cd-${Date.now()}`;
        const deposit = {
            id,
            branchId: user.branchId || DEFAULT_BRANCH_ID,
            amount: numericAmount,
            date: date || nowIso.split("T")[0],
            notes: notes || "",
            depositedBy: user.email || user.uid,
            createdAt: nowIso,
        };
        await adminDb.collection("cashDeposits").doc(id).set(deposit);
        return NextResponse.json({ message: "Cash deposit logged.", deposit }, { status: 200 });
    } catch (err) {
        console.error("POST cash deposit error:", err);
        return NextResponse.json({ error: err.message || "Failed to log deposit." }, { status: 500 });
    }
}
