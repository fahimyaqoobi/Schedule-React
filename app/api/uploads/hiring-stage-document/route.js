import { NextResponse } from "next/server";
import { adminAuth } from "../../../../lib/firebase-admin";
import { sanitizeFileName, uploadBufferToStorage } from "../../../../lib/storageUpload";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const token = authHeader.split("Bearer ")[1];
    return adminAuth.verifyIdToken(token);
}

// Authenticated counterpart to the public applicant-document upload route —
// used when an admin/HR reviewer attaches a document (e.g. a signed safety
// form) while logging a hiring-pipeline stage transition.
export async function POST(request) {
    try {
        await authenticateRequest(request);
        const formData = await request.formData();
        const file = formData.get("file");
        const applicationId = String(formData.get("applicationId") || "");
        const stage = String(formData.get("stage") || "document");

        if (!applicationId) {
            return NextResponse.json({ error: "Missing application reference." }, { status: 400 });
        }
        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "File upload is required." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const safeFileName = `${file.lastModified || Date.now()}-${sanitizeFileName(file.name || "document")}`;
        const objectPath = `hiring-stage-documents/${applicationId}/${stage}/${safeFileName}`;

        const url = await uploadBufferToStorage(objectPath, buffer, file.type || "application/octet-stream");

        return NextResponse.json({ message: "Document uploaded successfully.", url, name: file.name || "document" }, { status: 200 });
    } catch (error) {
        console.error("Hiring stage document upload error:", error);
        return NextResponse.json({ error: error.message || "Failed to upload document." }, { status: 500 });
    }
}
