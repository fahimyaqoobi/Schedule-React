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
    
    const userRef = adminDb.collection("users").doc(uid);
    let userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        // Safe auto-creation in case the user exists in Firebase Auth but has no Firestore document profile yet
        const usersSnap = await adminDb.collection("users").limit(1).get();
        const isFirst = usersSnap.empty;
        
        const newUser = {
            uid,
            name: decodedToken.name || decodedToken.email.split("@")[0],
            email: decodedToken.email,
            role: isFirst ? "admin" : "team-leader",
            teamId: "",
            status: isFirst ? "approved" : "pending_approval",
            createdAt: new Date().toISOString()
        };
        await userRef.set(newUser);
        return newUser;
    }
    
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

// 1. READ: Own user details (type=me) OR Admin-only pending user approvals loader OR registered approved team leaders
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        
        if (type === "me") {
            return NextResponse.json(user, { status: 200 });
        }
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can review users." }, { status: 403 });
        }
        
        // --- AUTO-SYNC FIREBASE AUTH USERS TO FIRESTORE PROFILES ---
        try {
            const listUsersResult = await adminAuth.listUsers(1000);
            for (const authUser of listUsersResult.users) {
                const userRef = adminDb.collection("users").doc(authUser.uid);
                const userDoc = await userRef.get();
                if (!userDoc.exists) {
                    const usersSnap = await adminDb.collection("users").limit(1).get();
                    const isFirst = usersSnap.empty;
                    
                    await userRef.set({
                        uid: authUser.uid,
                        name: authUser.displayName || authUser.email.split("@")[0],
                        email: authUser.email,
                        role: isFirst ? "admin" : "team-leader",
                        teamId: "",
                        status: isFirst ? "approved" : "pending_approval",
                        createdAt: new Date().toISOString()
                    });
                }
            }
        } catch (syncErr) {
            console.error("Auto-sync of Firebase Auth users failed:", syncErr);
        }
        // -----------------------------------------------------------
        
        let query = adminDb.collection("users");
        if (type === "leaders") {
            query = query.where("role", "==", "team-leader").where("status", "==", "approved");
        } else {
            query = query.where("status", "==", "pending_approval");
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            list.push(doc.data());
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Users Error:", err);
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

// 3. UPDATE: Update own profile details or Admin updating another user
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const body = await request.json();
        
        if (body.updateSelf) {
            if (!body.name) {
                return NextResponse.json({ error: "Name is required" }, { status: 400 });
            }
            const userRef = adminDb.collection("users").doc(user.uid);
            await userRef.update({ name: body.name });
            
            const docSnap = await userRef.get();
            return NextResponse.json({ message: "Profile updated successfully", user: docSnap.data() }, { status: 200 });
        }
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can update user details." }, { status: 403 });
        }
        
        const { targetUid, teamId } = body;
        if (!targetUid) {
            return NextResponse.json({ error: "Missing target user UID" }, { status: 400 });
        }
        
        const userRef = adminDb.collection("users").doc(targetUid);
        const docSnap = await userRef.get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }
        
        const targetUserData = docSnap.data();
        const updatedData = {
            ...targetUserData,
            teamId: teamId !== undefined ? teamId : targetUserData.teamId,
            updatedAt: new Date().toISOString()
        };
        
        await userRef.set(updatedData);
        return NextResponse.json({ message: "User updated successfully", user: updatedData }, { status: 200 });
    } catch (err) {
        console.error("PUT User Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

