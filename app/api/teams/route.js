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
        throw new Error("User profile not found in database");
    }
    const userData = userDoc.data();
    if (userData.status !== "approved") {
        throw new Error("User account is pending approval or disabled");
    }
    return userData;
}

// 1. READ: Load all cleaning crews
export async function GET(request) {
    try {
        await authenticateRequest(request);
        
        const snapshot = await adminDb.collection("teams").get();
        const teamsList = [];
        snapshot.forEach(doc => {
            teamsList.push(doc.data());
        });
        
        return NextResponse.json(teamsList, { status: 200 });
    } catch (err) {
        console.error("GET Teams Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. CREATE: Admin-only cleaning crew creation
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can create cleaning crews." }, { status: 403 });
        }
        
        const teamData = await request.json();
        if (!teamData.name || !teamData.id) {
            return NextResponse.json({ error: "Missing crew ID or name." }, { status: 400 });
        }
        
        const newTeam = {
            ...teamData,
            createdAt: new Date().toISOString(),
            createdBy: user.email
        };
        
        await adminDb.collection("teams").doc(newTeam.id).set(newTeam);
        return NextResponse.json({ message: "Crew created successfully", team: newTeam }, { status: 200 });
    } catch (err) {
        console.error("POST Team Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 3. UPDATE: Admin-only cleaning crew modification
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can modify cleaning crews." }, { status: 403 });
        }
        
        const teamData = await request.json();
        if (!teamData.id) {
            return NextResponse.json({ error: "Missing crew ID." }, { status: 400 });
        }
        
        await adminDb.collection("teams").doc(teamData.id).update(teamData);
        return NextResponse.json({ message: "Crew updated successfully" }, { status: 200 });
    } catch (err) {
        console.error("PUT Team Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 4. DELETE: Admin-only cleaning crew removal
export async function DELETE(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can delete cleaning crews." }, { status: 403 });
        }
        
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get("id");
        if (!teamId) {
            return NextResponse.json({ error: "Missing crew ID parameter." }, { status: 400 });
        }
        
        await adminDb.collection("teams").doc(teamId).delete();
        return NextResponse.json({ message: "Crew deleted successfully" }, { status: 200 });
    } catch (err) {
        console.error("DELETE Team Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
