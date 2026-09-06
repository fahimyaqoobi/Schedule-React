import { NextResponse } from "next/server";
import { adminAuth, adminStorage } from "../../../../lib/firebase-admin";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const token = authHeader.split("Bearer ")[1];
    return adminAuth.verifyIdToken(token);
}

function sanitize(name = "file") {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

// Same multi-bucket-candidate pattern as app/api/uploads/job-photo — Firebase
// projects can end up with either bucket suffix depending on when they were
// created, so try both rather than hardcoding one.
function buildBucketCandidates() {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schedule-system-stc";
    const raw = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
    const candidates = new Set();
    if (raw) { candidates.add(raw); if (raw.endsWith(".firebasestorage.app")) candidates.add(`${projectId}.appspot.com`); }
    candidates.add(`${projectId}.appspot.com`);
    candidates.add(`${projectId}.firebasestorage.app`);
    return Array.from(candidates).filter(Boolean);
}

// 10MB cap — comfortably covers phone photos while staying well under
// Gmail's send-request size ceiling once base64-encoded into the outgoing
// email (see app/api/bookings/google-reply).
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
    try {
        await authenticateRequest(request);
        const formData = await request.formData();
        const file = formData.get("file");
        const bookingId = String(formData.get("bookingId") || "unknown");

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "File is required." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File is too large (10MB max)." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = `${Date.now()}-${sanitize(file.name || "attachment")}`;
        const objectPath = `google-lead-attachments/${bookingId}/${safeFileName}`;
        const buckets = buildBucketCandidates();
        let url = "";
        let lastErr = null;

        for (const bucketName of buckets) {
            try {
                const bucket = adminStorage.bucket(bucketName);
                const [exists] = await bucket.exists();
                if (!exists) throw new Error(`Bucket '${bucketName}' does not exist.`);
                const bucketFile = bucket.file(objectPath);
                await bucketFile.save(buffer, {
                    metadata: { contentType: file.type || "application/octet-stream", cacheControl: "public, max-age=31536000" }
                });
                const [signed] = await bucketFile.getSignedUrl({ action: "read", expires: "03-01-2500" });
                url = signed;
                lastErr = null;
                break;
            } catch (err) { lastErr = err; }
        }

        if (!url) throw lastErr || new Error("No Firebase Storage bucket available.");

        return NextResponse.json({ ok: true, url, name: file.name || safeFileName, mimeType: file.type || "application/octet-stream" });
    } catch (err) {
        console.error("Google lead attachment upload error:", err);
        return NextResponse.json({ error: err.message || "Upload failed." }, { status: 500 });
    }
}
