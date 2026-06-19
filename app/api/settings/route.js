import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";
import { ROLE_DEFINITIONS, canManageSystem } from "../../../lib/permissions";
import { ensurePromotionList } from "../../../lib/promotions";

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
            branchId: "ottawa-ca",
            branchName: "Ottawa",
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

export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        const docSnap = await adminDb.collection("settings").doc("pricing").get();
        if (docSnap.exists) {
            const data = docSnap.data();
            return NextResponse.json({
                ...data,
                promotions: ensurePromotionList(data.promotions)
            }, { status: 200 });
        } else {
            return NextResponse.json({ promotions: ensurePromotionList([]) }, { status: 200 });
        }
    } catch (err) {
        console.error("GET Settings Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageSystem(user)) {
            return NextResponse.json({ error: "Forbidden: Only Administrators can modify settings." }, { status: 403 });
        }
        
        const settingsData = await request.json();
        await adminDb.collection("settings").doc("pricing").set({
            ...settingsData,
            promotions: settingsData.promotions ? ensurePromotionList(settingsData.promotions) : undefined
        }, { merge: true });
        return NextResponse.json({ message: "Settings saved successfully", settings: settingsData }, { status: 200 });
    } catch (err) {
        console.error("POST Settings Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
