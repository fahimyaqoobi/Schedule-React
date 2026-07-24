import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch } from "../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser, userCanAccessBranch } from "../../../lib/branches";
import { EXPENSE_CATEGORIES } from "../../../lib/expenses";

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
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

// 1. READ: Own expenses, or (branch managers) every expense in their branch scope
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get("status");
        const branchScope = getBranchScopeForUser(user);
        const requestedBranchId = searchParams.get("branchId");
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

        let query = adminDb.collection("expenses");
        if (canManageBranch(user)) {
            query = query.where("branchId", "==", activeBranchId);
        } else {
            query = query.where("submittedByUid", "==", user.uid);
        }

        const snapshot = await query.get();
        const expenses = [];
        snapshot.forEach((doc) => {
            const expense = doc.data();
            if (!statusFilter || expense.status === statusFilter) {
                expenses.push(expense);
            }
        });
        expenses.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return NextResponse.json(expenses, { status: 200 });
    } catch (error) {
        console.error("GET expenses error:", error);
        return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. CREATE: Any approved staff member submits a receipt for approval
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const body = await request.json();
        const { amount, category, description, date, receiptUrl, receiptName } = body;

        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
            return NextResponse.json({ error: "A valid expense amount is required." }, { status: 400 });
        }
        if (!receiptUrl) {
            return NextResponse.json({ error: "A receipt photo is required." }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const id = `exp-${Date.now()}`;
        const expense = {
            id,
            submittedByUid: user.uid,
            submittedByName: user.name || user.email || "Staff member",
            branchId: user.branchId || DEFAULT_BRANCH_ID,
            branchName: user.branchName || "Ottawa",
            amount: numericAmount,
            category: EXPENSE_CATEGORIES.includes(category) ? category : "Other",
            description: description || "",
            date: date || nowIso.split("T")[0],
            receiptUrl,
            receiptName: receiptName || "receipt",
            status: "pending_approval",
            reviewedBy: "",
            reviewedAt: "",
            rejectionReason: "",
            syncStatus: "not_synced",
            createdAt: nowIso,
            updatedAt: nowIso
        };

        await adminDb.collection("expenses").doc(id).set(expense);
        return NextResponse.json({ message: "Expense submitted for approval.", expense }, { status: 200 });
    } catch (error) {
        console.error("POST expense error:", error);
        return NextResponse.json({ error: error.message || "Failed to submit expense." }, { status: 500 });
    }
}

// 3. UPDATE: Branch managers approve or reject a submitted expense
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const body = await request.json();
        const { action, expenseId, rejectionReason } = body;

        if (!["approve", "reject"].includes(action)) {
            return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
        }
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Only branch admins can review expenses." }, { status: 403 });
        }
        if (!expenseId) {
            return NextResponse.json({ error: "Expense ID is required." }, { status: 400 });
        }

        const expenseRef = adminDb.collection("expenses").doc(expenseId);
        const expenseSnap = await expenseRef.get();
        if (!expenseSnap.exists) {
            return NextResponse.json({ error: "Expense not found." }, { status: 404 });
        }
        const expense = expenseSnap.data();
        if (!userCanAccessBranch(user, expense.branchId || DEFAULT_BRANCH_ID)) {
            return NextResponse.json({ error: "You cannot review this branch's expenses." }, { status: 403 });
        }

        const nowIso = new Date().toISOString();
        const updatedExpense = {
            ...expense,
            status: action === "approve" ? "approved" : "rejected",
            reviewedBy: user.email || user.uid,
            reviewedAt: nowIso,
            rejectionReason: action === "reject" ? (rejectionReason || "Rejected by branch admin.") : "",
            updatedAt: nowIso
        };

        await expenseRef.set(updatedExpense);
        return NextResponse.json({ message: `Expense ${action}d successfully.`, expense: updatedExpense }, { status: 200 });
    } catch (error) {
        console.error("PUT expense error:", error);
        return NextResponse.json({ error: error.message || "Failed to update expense." }, { status: 500 });
    }
}
