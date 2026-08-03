import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { roleHasDepartment } from "../../../../lib/permissions";
import { cloneJobApplicationTemplate, WORKER_TYPE_OPTIONS } from "../../../../lib/hiringPipeline";

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
    return { uid: decodedToken.uid, ...userData };
}

const VALID_WORKER_TYPES = new Set(WORKER_TYPE_OPTIONS.map(o => o.value));

// GET: all hiring-pipeline candidates (small collection, no pagination yet).
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!roleHasDepartment(user.role, "people")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const snapshot = await adminDb.collection("job_applications").orderBy("createdAt", "desc").get();
        const applications = [];
        snapshot.forEach(doc => applications.push({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ applications }, { status: 200 });
    } catch (err) {
        console.error("GET hr/applications error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// POST: HR manually adds a walk-in/referred candidate (source: "admin_manual"),
// same shape as a public apply submission, just not self-service.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!roleHasDepartment(user.role, "people")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const legalName = String(body.legalName || "").trim();
        const email = String(body.email || "").trim();
        const phone = String(body.phone || "").trim();
        const workerTypeInterest = String(body.workerTypeInterest || "").trim();

        if (!legalName || !email || !phone || !VALID_WORKER_TYPES.has(workerTypeInterest)) {
            return NextResponse.json({ error: "Name, email, phone, and a valid role are required." }, { status: 400 });
        }

        const applicationToken = `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const doc = cloneJobApplicationTemplate();
        doc.applicationToken = applicationToken;
        doc.branchId = user.branchId || "";
        doc.workerTypeInterest = workerTypeInterest;
        doc.source = "admin_manual";
        doc.personal = {
            ...doc.personal,
            legalName, email, phone,
            city: String(body.city || "").trim(),
            province: String(body.province || "ON").trim(),
            coverNote: String(body.coverNote || "").trim(),
        };

        await adminDb.collection("job_applications").doc(applicationToken).set(doc);
        return NextResponse.json({ application: { id: applicationToken, ...doc } }, { status: 201 });
    } catch (err) {
        console.error("POST hr/applications error:", err);
        return NextResponse.json({ error: err.message || "Failed to add candidate." }, { status: 401 });
    }
}
