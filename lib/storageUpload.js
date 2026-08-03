import { adminStorage } from "./firebase-admin";

// Shared Firebase Storage upload logic — extracted from
// app/api/uploads/staff-document/route.js so the applicant-document upload
// route (no Firebase UID to authenticate with) can reuse the same
// bucket-resolution/signed-URL behavior instead of a second copy.
export function sanitizeFileName(name = "document") {
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

// Uploads `buffer` to `objectPath` across the same bucket-name fallback
// chain as the staff-document route, returning a long-lived signed URL.
export async function uploadBufferToStorage(objectPath, buffer, contentType = "application/octet-stream") {
    const bucketCandidates = buildBucketCandidates();
    let uploadedUrl = "";
    let lastError = null;

    for (const bucketName of bucketCandidates) {
        try {
            const bucket = adminStorage.bucket(bucketName);
            const [exists] = await bucket.exists();
            if (!exists) {
                throw new Error(`Firebase Storage bucket '${bucketName}' does not exist.`);
            }
            const bucketFile = bucket.file(objectPath);
            await bucketFile.save(buffer, {
                metadata: {
                    contentType,
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
        throw lastError || new Error("No Firebase Storage bucket is available. Create Firebase Storage for this project first.");
    }

    return uploadedUrl;
}
