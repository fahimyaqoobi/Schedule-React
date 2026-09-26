import { adminStorage } from "./firebase-admin";

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

// Saves a point-in-time snapshot of a generated PDF (an estimate, booking
// confirmation, invoice, or receipt) so the exact document that was
// downloaded or emailed at that moment can be opened again later, even if
// the booking's price or details change afterward. Each call creates a new
// file — the whole point is a full history of "what did this actually say
// when it was sent", not just the current version.
export async function uploadDocumentSnapshot(bookingId, buffer, filename) {
    const objectPath = `booking-documents/${bookingId}/${Date.now()}-${filename}`;
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
                metadata: { contentType: "application/pdf", cacheControl: "public, max-age=31536000" }
            });
            const [signed] = await bucketFile.getSignedUrl({ action: "read", expires: "03-01-2500" });
            url = signed;
            lastErr = null;
            break;
        } catch (err) { lastErr = err; }
    }

    if (!url) throw lastErr || new Error("No Firebase Storage bucket available.");
    return url;
}
