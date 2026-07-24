import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch, roleHasDepartment } from "../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser, userCanAccessBranch } from "../../../lib/branches";
import { buildCustomerRecords } from "../../../lib/customers";

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

// Anyone in sales, operations, or branch management can view the CRM — this
// is the "admin, salesperson, ops can see" access rule from the requirements.
function canViewCustomers(user) {
    return canManageBranch(user) || roleHasDepartment(user.role, "sales") || roleHasDepartment(user.role, "operations");
}

// READ: Either the full customer directory (computed from bookings — no
// synced "customers" collection to keep consistent) or one customer's detail
// + CRM notes when ?key= is provided.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canViewCustomers(user)) {
            return NextResponse.json({ error: "Forbidden: You cannot view the customer directory." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const requestedBranchId = searchParams.get("branchId");
        const branchScope = getBranchScopeForUser(user);
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

        let query = adminDb.collection("bookings");
        if (!branchScope.canSwitchBranches || requestedBranchId) {
            if (!userCanAccessBranch(user, activeBranchId)) {
                return NextResponse.json({ error: "Forbidden: You cannot access this branch." }, { status: 403 });
            }
            query = query.where("branchId", "==", activeBranchId);
        }

        const snapshot = await query.get();
        const bookings = [];
        snapshot.forEach(doc => bookings.push(doc.data()));

        const records = buildCustomerRecords(bookings);

        const key = searchParams.get("key");
        if (key) {
            const record = records.find(r => r.key === key);
            if (!record) {
                return NextResponse.json({ error: "Customer not found." }, { status: 404 });
            }
            const noteDoc = await adminDb.collection("customerNotes").doc(encodeURIComponent(key)).get();
            record.notes = noteDoc.exists ? (noteDoc.data().notes || "") : "";
            record.tags = noteDoc.exists ? (noteDoc.data().tags || []) : [];
            return NextResponse.json(record, { status: 200 });
        }

        // Directory view — drop the heavy per-booking payload, keep summary fields only.
        const summaries = records.map(({ bookings: _bookings, ...summary }) => summary);
        return NextResponse.json(summaries, { status: 200 });
    } catch (err) {
        console.error("GET customers error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// UPDATE: CRM notes/tags for a customer (separate from computed booking aggregates).
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canViewCustomers(user)) {
            return NextResponse.json({ error: "Forbidden: You cannot edit customer notes." }, { status: 403 });
        }

        const { key, notes, tags } = await request.json();
        if (!key) {
            return NextResponse.json({ error: "Missing customer key." }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const payload = {
            key,
            notes: notes || "",
            tags: Array.isArray(tags) ? tags : [],
            updatedAt: nowIso,
            updatedBy: user.email || user.uid,
        };
        await adminDb.collection("customerNotes").doc(encodeURIComponent(key)).set(payload, { merge: true });
        return NextResponse.json({ message: "Customer notes saved.", ...payload }, { status: 200 });
    } catch (err) {
        console.error("PUT customer notes error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
