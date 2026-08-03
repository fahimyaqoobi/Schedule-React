import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { sanitizeFileName, uploadBufferToStorage } from "../../../../lib/storageUpload";

// Public counterpart to app/api/uploads/staff-document/route.js — the
// applicant has no Firebase UID yet, so this is keyed by the application's
// own token (validated against a real job_applications doc) instead of a
// Bearer ID token.
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const applicationToken = String(formData.get("applicationToken") || "");

        if (!applicationToken) {
            return NextResponse.json({ error: "Missing application reference." }, { status: 400 });
        }
        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "File upload is required." }, { status: 400 });
        }

        const ref = adminDb.collection("job_applications").doc(applicationToken);
        const snap = await ref.get();
        if (!snap.exists) {
            return NextResponse.json({ error: "Application not found." }, { status: 404 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = `${file.lastModified || Date.now()}-${sanitizeFileName(file.name || "resume")}`;
        const objectPath = `applicant-resumes/${applicationToken}/${safeFileName}`;

        const url = await uploadBufferToStorage(objectPath, buffer, file.type || "application/octet-stream");

        await ref.update({
            "personal.resumeUrl": url,
            "personal.resumeFileName": file.name || "resume",
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ message: "Resume uploaded successfully.", url, name: file.name || "resume" }, { status: 200 });
    } catch (error) {
        console.error("Applicant document upload error:", error);
        return NextResponse.json({ error: error.message || "Failed to upload resume." }, { status: 500 });
    }
}
