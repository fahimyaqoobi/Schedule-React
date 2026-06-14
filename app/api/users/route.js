import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { ROLE_DEFINITIONS, canManageBranch, canManageSystem, normalizeRole } from "../../../lib/permissions";
import { createDefaultBranchUserFields } from "../../../lib/branches";

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
            role: isFirst ? "super-admin" : "cleaner",
            departmentIds: isFirst ? ROLE_DEFINITIONS["super-admin"].departments : ROLE_DEFINITIONS.cleaner.departments,
            ...createDefaultBranchUserFields(isFirst ? "super-admin" : "cleaner"),
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
        
        if (type === "field-staff") {
            if (!canManageBranch(user)) {
                return NextResponse.json({ error: "Forbidden: Only branch managers can view field staff." }, { status: 403 });
            }
            const snapshot = await adminDb.collection("users").where("status", "==", "approved").get();
            const list = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const role = normalizeRole(data.role);
                if (["cleaner", "supervisor", "employee", "subcontractor"].includes(role)) {
                    list.push(data);
                }
            });
            return NextResponse.json(list, { status: 200 });
        }

        if (!canManageSystem(user)) {
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
                        role: isFirst ? "super-admin" : "cleaner",
                        departmentIds: isFirst ? ROLE_DEFINITIONS["super-admin"].departments : ROLE_DEFINITIONS.cleaner.departments,
                        ...createDefaultBranchUserFields(isFirst ? "super-admin" : "cleaner"),
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
        let roleFilter = null;
        if (type === "leaders") {
            query = query.where("status", "==", "approved");
            roleFilter = ["team-leader", "cleaner", "supervisor"];
        } else if (type === "customers") {
            query = query.where("role", "==", "customer").where("status", "==", "approved");
        } else {
            query = query.where("status", "==", "pending_approval");
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const role = normalizeRole(data.role);
            if (!roleFilter || roleFilter.includes(data.role) || roleFilter.includes(role)) {
                list.push(data);
            }
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
        
        if (!canManageSystem(user)) {
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
        } else if (action === "make_admin" || action === "make_super_admin") {
            await userRef.update({
                role: "super-admin",
                departmentIds: ROLE_DEFINITIONS["super-admin"].departments,
                updatedAt: new Date().toISOString()
            });
            return NextResponse.json({ message: "User promoted to Super Admin role." }, { status: 200 });
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
        
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can update user details." }, { status: 403 });
        }
        
        const { targetUid, teamId, role, branchId, branchName, branchIds, departmentIds } = body;
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
            role: role || targetUserData.role,
            branchId: branchId !== undefined ? branchId : (targetUserData.branchId || "ottawa-ca"),
            branchIds: branchIds !== undefined ? branchIds : (targetUserData.branchIds || [targetUserData.branchId || "ottawa-ca"]),
            branchName: branchName !== undefined ? branchName : (targetUserData.branchName || "Ottawa"),
            departmentIds: departmentIds || ROLE_DEFINITIONS[role || targetUserData.role]?.departments || targetUserData.departmentIds || [],
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
