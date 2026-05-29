import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../lib/firebase-admin";

// Shared Secure JWT and Role verification helper
async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    
    // 1. Verify standard Firebase ID JWT token
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // 2. Fetch official role/status from users collection (server-authoritative check)
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

// 1. Scoped READ: Return all bookings for Admin, or only assigned bookings for Team Leaders
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        
        let query = adminDb.collection("bookings");
        if (user.role === "team-leader") {
            query = query.where("team", "==", user.teamId);
        }
        
        const snapshot = await query.get();
        const list = [];
        snapshot.forEach(doc => {
            list.push(doc.data());
        });
        
        return NextResponse.json(list, { status: 200 });
    } catch (err) {
        console.error("GET Bookings Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 2. Scoped CREATE: Add booking (verifies Team Leader doesn't hijack other crew dispatches)
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        const bookingData = await request.json();
        
        if (!bookingData.clientName || !bookingData.date || !bookingData.time || !bookingData.team) {
            return NextResponse.json({ error: "Missing required booking details." }, { status: 400 });
        }
        
        if (user.role === "team-leader" && bookingData.team !== user.teamId) {
            return NextResponse.json({ error: `Forbidden: As Team Leader of ${user.teamId}, you cannot schedule jobs for other crews.` }, { status: 403 });
        }
        
        const id = bookingData.id || `bk-${Date.now()}`;
        const newBooking = {
            ...bookingData,
            id,
            price: parseFloat(bookingData.price || 0),
            duration: parseFloat(bookingData.duration || 2),
            createdAt: new Date().toISOString(),
            createdBy: user.email
        };
        
        await adminDb.collection("bookings").doc(id).set(newBooking);
        return NextResponse.json({ message: "Booking created successfully", booking: newBooking }, { status: 200 });
    } catch (err) {
        console.error("POST Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 3. Scoped UPDATE: Immediate merge for Admins; creates approval Edit Request for Team Leaders
export async function PUT(request) {
    try {
        const user = await authenticateRequest(request);
        const bookingData = await request.json();
        
        if (!bookingData.id) {
            return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
        }
        
        const bookingRef = adminDb.collection("bookings").doc(bookingData.id);
        const existingDoc = await bookingRef.get();
        if (!existingDoc.exists) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
        
        const originalData = existingDoc.data();
        
        if (user.role === "team-leader" && originalData.team !== user.teamId) {
            return NextResponse.json({ error: "Forbidden: You are not authorized to modify other crews' bookings." }, { status: 403 });
        }
        
        if (user.role === "admin") {
            const updatedBooking = {
                ...originalData,
                ...bookingData,
                price: parseFloat(bookingData.price ?? originalData.price),
                duration: parseFloat(bookingData.duration ?? originalData.duration),
                updatedAt: new Date().toISOString(),
                updatedBy: user.email
            };
            await bookingRef.set(updatedBooking);
            return NextResponse.json({ message: "Booking updated directly by Admin", booking: updatedBooking }, { status: 200 });
        } else {
            // Team Leader updates: Write to review table 'editRequests' for Admin approval
            const reqId = `req-${Date.now()}`;
            const editRequest = {
                id: reqId,
                bookingId: bookingData.id,
                clientName: originalData.clientName,
                requestedBy: user.email,
                createdAt: new Date().toISOString(),
                status: "Pending",
                originalData: originalData,
                requestedData: {
                    ...originalData,
                    ...bookingData,
                    price: parseFloat(bookingData.price ?? originalData.price),
                    duration: parseFloat(bookingData.duration ?? originalData.duration)
                }
            };
            
            await adminDb.collection("editRequests").doc(reqId).set(editRequest);
            return NextResponse.json({ message: "Booking edit request sent to Admin inbox for approval", requestId: reqId }, { status: 202 });
        }
    } catch (err) {
        console.error("PUT Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// 4. Scoped DELETE: Admin-only booking soft cancellation
export async function DELETE(request) {
    try {
        const user = await authenticateRequest(request);
        const { searchParams } = new URL(request.url);
        const bookingId = searchParams.get("id");
        
        if (!bookingId) {
            return NextResponse.json({ error: "Missing booking ID in URL params" }, { status: 400 });
        }
        
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Team Leaders are not authorized to cancel bookings." }, { status: 403 });
        }
        
        const bookingRef = adminDb.collection("bookings").doc(bookingId);
        const existingDoc = await bookingRef.get();
        if (!existingDoc.exists) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
        
        const originalData = existingDoc.data();
        const cancelledBooking = {
            ...originalData,
            status: "Cancelled",
            updatedAt: new Date().toISOString(),
            updatedBy: user.email
        };
        await bookingRef.set(cancelledBooking);
        
        return NextResponse.json({ message: "Booking soft-cancelled successfully", booking: cancelledBooking }, { status: 200 });
    } catch (err) {
        console.error("DELETE Booking Error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}
