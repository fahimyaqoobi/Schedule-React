import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebase-admin";
import { cloneJobApplicationTemplate, WORKER_TYPE_OPTIONS } from "../../../../lib/hiringPipeline";
import { sendEmail, isMailConfigured } from "../../../../lib/email";
import { createNotification } from "../../../../lib/notifications";

const VALID_WORKER_TYPES = new Set(WORKER_TYPE_OPTIONS.map(o => o.value));

function isValidEmail(value = "") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
    try {
        const body = await request.json();
        const legalName = String(body.legalName || "").trim();
        const email = String(body.email || "").trim();
        const phone = String(body.phone || "").trim();
        const city = String(body.city || "").trim();
        const province = String(body.province || "ON").trim();
        const workerTypeInterest = String(body.workerTypeInterest || "").trim();
        const coverNote = String(body.coverNote || "").trim();
        const branchId = String(body.branchId || "").trim();

        if (!legalName || !email || !phone || !workerTypeInterest) {
            return NextResponse.json({ error: "Name, email, phone, and role are required." }, { status: 400 });
        }
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
        }
        if (!VALID_WORKER_TYPES.has(workerTypeInterest)) {
            return NextResponse.json({ error: "Please select a valid role." }, { status: 400 });
        }

        const applicationToken = `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const doc = cloneJobApplicationTemplate();
        doc.applicationToken = applicationToken;
        doc.branchId = branchId;
        doc.workerTypeInterest = workerTypeInterest;
        doc.personal = { ...doc.personal, legalName, email, phone, city, province, coverNote };

        await adminDb.collection("job_applications").doc(applicationToken).set(doc);

        try {
            await createNotification(adminDb, {
                type: "application_submitted",
                title: "New job application",
                body: `${legalName} applied for ${workerTypeInterest}.`,
                branchId,
                link: "/#hr-pipeline",
                refId: applicationToken,
            });
        } catch (notifyError) {
            console.error("Failed to create application_submitted notification:", notifyError);
        }

        if (isMailConfigured()) {
            try {
                await sendEmail({
                    to: email,
                    subject: "We received your application — SmarTouch Clean",
                    html: `<p>Hi ${legalName},</p><p>Thanks for applying to SmarTouch Clean. Our HR team will review your application and reach out with next steps.</p>`,
                });
            } catch (mailError) {
                console.error("Failed to send application confirmation email:", mailError);
            }
        }

        return NextResponse.json({ applicationToken }, { status: 201 });
    } catch (error) {
        console.error("Careers apply error:", error);
        return NextResponse.json({ error: "Failed to submit application. Please try again." }, { status: 500 });
    }
}
