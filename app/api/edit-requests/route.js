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

// 1. Scoped READ: Return all requests for Admin, or only submitted requests for Team Leaders
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        
        let query = adminDb.collection("editRequests");
        if (user.role === "team-leader") {
            query = query.where("requestedBy", "==", user.email);
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            list.push(doc.data());
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Edit Requests Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. Admin-only RESOLVE: Approve (merge to bookings) or Reject edit request
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Only Administrators can resolve cleaner modification requests." }, { status: 403 });
        }
        
        const { requestId, action } = await request.json();
        
        if (!requestId || !action) {
            return NextResponse.json({ error: "Missing required fields: requestId, action" }, { status: 400 });
        }
        
        const reqRef = adminDb.collection("editRequests").doc(requestId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) {
            return NextResponse.json({ error: "Modification request not found" }, { status: 404 });
        }
        
        const reqData = reqDoc.data();
        if (reqData.status !== "Pending") {
            return NextResponse.json({ error: `This request has already been resolved as ${reqData.status.toLowerCase()}.` }, { status: 400 });
        }
        
        if (action === "approve") {
            const bookingId = reqData.bookingId;
            const updatedBooking = {
                ...reqData.requestedData,
                updatedAt: new Date().toISOString(),
                approvedBy: user.email
            };
            
            // 1. Perform atomic write to bookings collection
            await adminDb.collection("bookings").doc(bookingId).set(updatedBooking);
            
            // 2. Mark edit request status as Approved
            await reqRef.update({
                status: "Approved",
                resolvedAt: new Date().toISOString(),
                resolvedBy: user.email
            });
            
            return NextResponse.json({ message: "Edit request approved and booking details updated.", booking: updatedBooking }, { status: 200 });
        } else if (action === "reject") {
            // Mark edit request status as Rejected
            await reqRef.update({
                status: "Rejected",
                resolvedAt: new Date().toISOString(),
                resolvedBy: user.email
            });
            
            return NextResponse.json({ message: "Edit request rejected successfully" }, { status: 200 });
        } else {
            return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
        }
        
    } catch (err) {
        console.error("POST Process Edit Request Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
