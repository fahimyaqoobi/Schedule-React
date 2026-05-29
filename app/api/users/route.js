import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new Error("User profile not found");
    }
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

// 1. READ: Admin-only pending user approvals loader
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can review pending users." }, { status: 403 });
        }
        
        const snapshot = await adminDb.collection("users").where("status", "==", "pending_approval").get();
        const list = [];
        snapshot.forEach(doc => {
            list.push(doc.data());
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Pending Users Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. WRITE: Admin-only activation resolving (Approve / Reject / Promote-to-Admin)
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can modify user roles and statuses." }, { status: 403 });
        }
        
        const { targetUid, action } = await request.json();
        
        if (!targetUid || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        
        const userRef = adminDb.collection("users").doc(targetUid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }
        
        if (action === "approve") {
            await userRef.update({ status: "approved" });
            return NextResponse.json({ message: "User account activated successfully." }, { status: 200 });
        } else if (action === "reject") {
            // Delete user document profile
            await userRef.delete();
            // Delete user from Firebase Auth
            try {
                await adminAuth.deleteUser(targetUid);
            } catch (delErr) {
                console.error("Failed to delete auth user during rejection cleanup:", delErr);
            }
            return NextResponse.json({ message: "User registration rejected and credentials deleted." }, { status: 200 });
        } else if (action === "make_admin") {
            await userRef.update({ role: "admin" });
            return NextResponse.json({ message: "User promoted to Administrator role." }, { status: 200 });
        } else {
            return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
        }
        
    } catch (err) {
        console.error("POST Process User Approval Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
