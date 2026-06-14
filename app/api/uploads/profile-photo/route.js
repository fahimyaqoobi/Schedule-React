import { NextResponse } from "next/server";
import { adminAuth, adminStorage } from "../../../../lib/firebase-admin";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
}

function sanitizeFileName(name = "photo.jpg") {
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

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "File upload is required." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = `${file.lastModified || Date.now()}-${sanitizeFileName(file.name || "photo.jpg")}`;
        const objectPath = `staff-profile-photos/${decodedToken.uid}/${safeFileName}`;
        const bucketCandidates = buildBucketCandidates();
        let signedUrl = "";
        let lastError = null;

        for (const bucketName of bucketCandidates) {
            try {
                const bucket = adminStorage.bucket(bucketName);
                const bucketFile = bucket.file(objectPath);

                await bucketFile.save(buffer, {
                    metadata: {
                        contentType: file.type || "image/jpeg",
                        cacheControl: "public,max-age=31536000"
                    }
                });

                const [url] = await bucketFile.getSignedUrl({
                    action: "read",
                    expires: "03-01-2500"
                });
                signedUrl = url;
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!signedUrl) {
            throw lastError || new Error("No Firebase Storage bucket could accept the upload.");
        }

        return NextResponse.json({
            message: "Profile photo uploaded successfully.",
            photoURL: signedUrl
        }, { status: 200 });
    } catch (error) {
        console.error("Profile photo upload error:", error);
        return NextResponse.json({ error: error.message || "Failed to upload profile photo." }, { status: 500 });
    }
}
