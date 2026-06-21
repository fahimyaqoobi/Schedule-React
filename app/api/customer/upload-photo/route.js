import { NextResponse } from "next/server";
import { adminStorage } from "../../../../lib/firebase-admin";
import { upsertCustomerProfile } from "../../../../lib/customerProfile";
import { getSessionPhoneAny } from "../../../../lib/customerSession";

function buildBucketCandidates() {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schedule-system-stc";
    const raw = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
    const candidates = new Set();
    if (raw) {
        candidates.add(raw);
        if (raw.endsWith(".firebasestorage.app")) candidates.add(`${projectId}.appspot.com`);
    }
    candidates.add(`${projectId}.appspot.com`);
    candidates.add(`${projectId}.firebasestorage.app`);
    return Array.from(candidates).filter(Boolean);
}

export async function POST(request) {
    try {
        const phone = getSessionPhoneAny(request);
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") throw new Error("File required.");

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const objectPath = `customer-profile-photos/${phone}/${Date.now()}-photo.jpg`;
        const bucketCandidates = buildBucketCandidates();
        let signedUrl = "";
        let lastError = null;

        for (const bucketName of bucketCandidates) {
            try {
                const bucket = adminStorage.bucket(bucketName);
                const [exists] = await bucket.exists();
                if (!exists) throw new Error(`Bucket '${bucketName}' not found.`);
                const bucketFile = bucket.file(objectPath);
                await bucketFile.save(buffer, {
                    metadata: { contentType: file.type || "image/jpeg", cacheControl: "public,max-age=31536000" },
                });
                const [url] = await bucketFile.getSignedUrl({ action: "read", expires: "03-01-2500" });
                signedUrl = url;
                lastError = null;
                break;
            } catch (e) { lastError = e; }
        }

        if (!signedUrl) throw lastError || new Error("Firebase Storage is not configured for this project.");

        await upsertCustomerProfile(phone, { photoURL: signedUrl });
        return NextResponse.json({ ok: true, photoURL: signedUrl });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
