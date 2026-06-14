import { NextResponse } from "next/server";
import { adminAuth, adminStorage } from "../../../../lib/firebase-admin";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    return adminAuth.verifyIdToken(token);
}

function sanitizeFileName(name = "document") {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, "-");
}

function buildBucketCandidates() {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schedule-system-stc";
    const rawConfigured = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
    const candidates = new Set();

    if (rawConfigured) {
        candidates.add(rawConfigured);
        if (rawConfigured.endsWith(".firebasestorage.app")) {
            candidates.add(`${projectId}.appspot.com`);
        }
    }

    candidates.add(`${projectId}.appspot.com`);
    candidates.add(`${projectId}.firebasestorage.app`);
    return Array.from(candidates).filter(Boolean);
}

export async function POST(request) {
    try {
        const decodedToken = await authenticateRequest(request);
        const formData = await request.formData();
        const file = formData.get("file");
        const kind = String(formData.get("kind") || "documentUpload");

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "File upload is required." }, { status: 400 });
        }

        const folderName = kind === "photoIdUpload" ? "staff-photo-ids" : "staff-work-permits";
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = `${file.lastModified || Date.now()}-${sanitizeFileName(file.name || "document")}`;
        const objectPath = `${folderName}/${decodedToken.uid}/${safeFileName}`;
        const bucketCandidates = buildBucketCandidates();

        let uploadedUrl = "";
        let lastError = null;

        for (const bucketName of bucketCandidates) {
            try {
                const bucket = adminStorage.bucket(bucketName);
                const bucketFile = bucket.file(objectPath);
                await bucketFile.save(buffer, {
                    metadata: {
                        contentType: file.type || "application/octet-stream",
                        cacheControl: "private,max-age=0,no-transform"
                    }
                });
                const [url] = await bucketFile.getSignedUrl({
                    action: "read",
                    expires: "03-01-2500"
                });
                uploadedUrl = url;
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!uploadedUrl) {
            throw lastError || new Error("No Firebase Storage bucket could accept the upload.");
        }

        return NextResponse.json({
            message: "Document uploaded successfully.",
            url: uploadedUrl,
            name: file.name || "document"
        }, { status: 200 });
    } catch (error) {
        console.error("Staff document upload error:", error);
        return NextResponse.json({ error: error.message || "Failed to upload staff document." }, { status: 500 });
    }
}
