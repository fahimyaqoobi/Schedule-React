import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch } from "../../../lib/permissions";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!snap.exists || snap.data().status !== "approved") throw new Error("Unauthorized");
    return snap.data();
}

export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
        const { searchParams } = new URL(request.url);
        const periodKey = searchParams.get("periodKey");
        let query = adminDb.collection("payrollPeriods");
        if (periodKey) query = query.where("periodKey", "==", periodKey);
        const snap = await query.get();
        const records = [];
        snap.forEach(doc => records.push(doc.data()));
        return NextResponse.json(records);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
        const body = await request.json();
        const { cleanerUid, cleanerName, periodKey, periodLabel, status, notes } = body;
        if (!cleanerUid || !periodKey) {
            return NextResponse.json({ error: "cleanerUid and periodKey are required." }, { status: 400 });
        }
        const docId = `${periodKey}_${cleanerUid}`;
        const record = {
            cleanerUid,
            cleanerName: cleanerName || "",
            periodKey,
            periodLabel: periodLabel || "",
            status: status || "pending",
            notes: notes || "",
            updatedAt: new Date().toISOString(),
            updatedBy: user.email || user.uid,
            ...(status === "paid" ? { paidAt: new Date().toISOString(), paidBy: user.email || user.uid } : {}),
        };
        await adminDb.collection("payrollPeriods").doc(docId).set(record, { merge: true });
        return NextResponse.json({ ok: true, record });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 401 });
    }
}
