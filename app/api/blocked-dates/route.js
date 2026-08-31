import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { canManageBranch } from "../../../lib/permissions";
import { userCanAccessBranch } from "../../../lib/branches";
import { blockedDateDocId } from "../../../lib/blockedDates";

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

// READ is intentionally public (no auth) — a blocked date isn't sensitive
// information, and every surface that needs to grey one out has to read
// this: the admin checkout wizard, the edit-booking modal, AND the
// customer's own self-serve booking flow (which authenticates by phone
// session, not a Firebase ID token, and shouldn't need a session just to
// know which days are unavailable).
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        let query = adminDb.collection("blockedDates");
        if (branchId) query = query.where("branchId", "==", branchId);
        const snapshot = await query.get();
        const dates = snapshot.docs.map((doc) => doc.data()).sort((a, b) => a.date.localeCompare(b.date));
        return NextResponse.json(dates, { status: 200 });
    } catch (err) {
        console.error("GET blocked-dates error:", err);
        return NextResponse.json({ error: err.message || "Failed to load blocked dates." }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const { branchId, date, reason } = await request.json();
        if (!branchId || !date) {
            return NextResponse.json({ error: "branchId and date are required." }, { status: 400 });
        }
        if (!canManageBranch(user) || !userCanAccessBranch(user, branchId)) {
            return NextResponse.json({ error: "Forbidden: You cannot manage this branch's schedule." }, { status: 403 });
        }

        const id = blockedDateDocId(branchId, date);
        const record = {
            id,
            branchId,
            date,
            reason: String(reason || "").trim() || "Blocked",
            createdAt: new Date().toISOString(),
            createdBy: user.email || user.uid,
        };
        await adminDb.collection("blockedDates").doc(id).set(record);
        return NextResponse.json({ message: "Date blocked.", blockedDate: record }, { status: 200 });
    } catch (err) {
        console.error("POST blocked-dates error:", err);
        return NextResponse.json({ error: err.message || "Failed to block date." }, { status: 401 });
    }
}

export async function DELETE(request) {
    try {
        const user = await authenticateRequest(request);
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const date = searchParams.get("date");
        if (!branchId || !date) {
            return NextResponse.json({ error: "branchId and date are required." }, { status: 400 });
        }
        if (!canManageBranch(user) || !userCanAccessBranch(user, branchId)) {
            return NextResponse.json({ error: "Forbidden: You cannot manage this branch's schedule." }, { status: 403 });
        }

        await adminDb.collection("blockedDates").doc(blockedDateDocId(branchId, date)).delete();
        return NextResponse.json({ message: "Date unblocked." }, { status: 200 });
    } catch (err) {
        console.error("DELETE blocked-dates error:", err);
        return NextResponse.json({ error: err.message || "Failed to unblock date." }, { status: 401 });
    }
}
