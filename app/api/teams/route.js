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

// 1. READ: Load all cleaning crews (auto-populates defaults if Firestore is empty)
export async function GET(request) {
    try {
        await authenticateRequest(request);
        
        const snapshot = await adminDb.collection("teams").get();
        const teamsList = [];
        snapshot.forEach(doc => {
            teamsList.push(doc.data());
        });
        
        // Auto-initialize standard default crews if database collection is empty
        if (teamsList.length === 0) {
            const defaults = [
                { id: 'team-sparkle', name: 'Team Sparkle', color: 'sparkle', lead: 'Emma Vance', size: 3, members: 'Emma Vance, Alice Smith, John Doe', description: 'Deep Cleaning & Sanitization experts' },
                { id: 'team-deluxe', name: 'Team Deluxe', color: 'deluxe', lead: 'Robert Miller', size: 3, members: 'Robert Miller, Clara Oswald, Arthur Dent', description: 'Standard Residential & Sparkle cleans' },
                { id: 'team-ecoclean', name: 'Team EcoClean', color: 'ecoclean', lead: 'Sarah Green', size: 2, members: 'Sarah Green, Lily Evans', description: 'Green, pet-friendly biodegradable cleaning' }
            ];
            for (const t of defaults) {
                await adminDb.collection("teams").doc(t.id).set(t);
            }
            return NextResponse.json(defaults, { status: 200 });
        }
        
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
