import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebase-admin";
import { canManageBranch, roleHasDepartment } from "../../../lib/permissions";
import { getBranchScopeForUser } from "../../../lib/branches";

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

function canViewNotifications(user) {
    return canManageBranch(user) || roleHasDepartment(user.role, "sales") || roleHasDepartment(user.role, "operations") || roleHasDepartment(user.role, "people");
}

// GET: the most recent notifications for this user's branch scope, newest first.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canViewNotifications(user)) {
            return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 200 });
        }

        const branchScope = getBranchScopeForUser(user);
        const snapshot = await adminDb.collection("notifications")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const notifications = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (branchScope.canSwitchBranches || !data.branchId || branchScope.branchIds.includes(data.branchId)) {
                notifications.push(data);
            }
        });

        const unreadCount = notifications.filter((n) => !n.read).length;
        return NextResponse.json({ notifications, unreadCount }, { status: 200 });
    } catch (err) {
        console.error("GET notifications error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// PUT: mark one notification (or all) as read.
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canViewNotifications(user)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id, markAllRead } = await request.json();

        if (markAllRead) {
            const branchScope = getBranchScopeForUser(user);
            const snapshot = await adminDb.collection("notifications").where("read", "==", false).get();
            const batch = adminDb.batch();
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (branchScope.canSwitchBranches || !data.branchId || branchScope.branchIds.includes(data.branchId)) {
                    batch.update(doc.ref, { read: true });
                }
            });
            await batch.commit();
            return NextResponse.json({ message: "All notifications marked read." }, { status: 200 });
        }

        if (!id) return NextResponse.json({ error: "Missing notification id." }, { status: 400 });
        await adminDb.collection("notifications").doc(id).set({ read: true }, { merge: true });
        return NextResponse.json({ message: "Notification marked read." }, { status: 200 });
    } catch (err) {
        console.error("PUT notifications error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
