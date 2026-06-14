import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebase-admin";
import { ROLE_DEFINITIONS } from "../../../../lib/permissions";
import { createDefaultBranchUserFields } from "../../../../lib/branches";

export async function POST(request) {
    try {
        const { uid, name, email, teamId, requestedRole } = await request.json();

        if (!uid || !name || !email) {
            return NextResponse.json({ error: "Missing required fields: uid, name, email" }, { status: 400 });
        }

        // 1. Verify the user exists in Firebase Auth to ensure it's not a spoofed request
        try {
            await adminAuth.getUser(uid);
        } catch (authErr) {
            return NextResponse.json({ error: "User is not authenticated in Firebase Auth." }, { status: 401 });
        }

        // 2. Auto-bootstrapping check: See if this is the very first user in the database
        let isFirstUser = false;
        try {
            const usersSnapshot = await adminDb.collection("users").limit(1).get();
            if (usersSnapshot.empty) {
                isFirstUser = true;
            }
        } catch (dbErr) {
            console.warn("Could not check if users collection is empty. Firestore might not have rules/collections initialized. Proceeding assuming first user.", dbErr);
            isFirstUser = true;
        }

        // Role Resolution
        let roleVal = "customer"; // Default
        if (isFirstUser) {
            roleVal = "super-admin";
        } else if (requestedRole && ROLE_DEFINITIONS[requestedRole] && !["super-admin", "branch-admin"].includes(requestedRole)) {
            roleVal = requestedRole;
        } else if (requestedRole === "team-leader") {
            roleVal = "cleaner";
        }

        const statusVal = isFirstUser ? "approved" : "pending_approval";

        const userPayload = {
            uid,
            name,
            email,
            role: roleVal,
            departmentIds: ROLE_DEFINITIONS[roleVal]?.departments || [],
            ...createDefaultBranchUserFields(roleVal),
            teamId: ["cleaner", "supervisor", "employee", "subcontractor"].includes(roleVal) ? teamId : "",
            status: statusVal,
            createdAt: new Date().toISOString()
        };

        // 3. Write user profile securely inside Firestore using Admin SDK
        await adminDb.collection("users").doc(uid).set(userPayload);

        return NextResponse.json({
            message: "User registered successfully",
            user: userPayload
        }, { status: 200 });

    } catch (error) {
        console.error("API Auth Register Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
