import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../../lib/firebase-admin";
import { ROLE_DEFINITIONS } from "../../../../../../lib/permissions";
import { createDefaultBranchUserFields } from "../../../../../../lib/branches";
import { cloneStaffProfileTemplate, cloneStaffProfileMetaTemplate } from "../../../../../../lib/staffProfiles";
import { buildStageEntry, canActOnHiringStage, getNextStage } from "../../../../../../lib/hiringPipeline";
import { createNotification } from "../../../../../../lib/notifications";

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

// Converts a candidate who just cleared "approval_for_scheduling" into a
// real staff account: Firebase Auth user + users doc, seeded staffProfile
// carrying over what the pipeline already collected. Mirrors the
// auto-creation shape in app/api/users/route.js's authenticateRequest.
async function convertApplicationToStaff(application, actorEmail) {
    const { personal, workerTypeInterest } = application;
    const authUser = await adminAuth.createUser({
        email: personal.email,
        displayName: personal.legalName,
        disabled: false,
    });

    const staffProfile = cloneStaffProfileTemplate();
    staffProfile.personal = {
        ...staffProfile.personal,
        legalName: personal.legalName,
        email: personal.email,
        phone: personal.phone,
        city: personal.city,
        province: personal.province || "ON",
    };
    staffProfile.employment.workerType = workerTypeInterest;

    const finalSafetyStage = application.stages?.final_safety_onboarding;
    if (finalSafetyStage?.documentUrl) {
        staffProfile.eligibility.documentUpload = {
            name: finalSafetyStage.documentName || "Safety & Onboarding Document",
            url: finalSafetyStage.documentUrl,
            uploadedAt: finalSafetyStage.date || new Date().toISOString(),
        };
    }

    const roleDepartments = ROLE_DEFINITIONS[workerTypeInterest]?.departments || ROLE_DEFINITIONS.cleaner.departments;
    const branchFields = createDefaultBranchUserFields(workerTypeInterest);
    const newUser = {
        uid: authUser.uid,
        name: personal.legalName,
        email: personal.email,
        phone: personal.phone,
        photoURL: "",
        role: workerTypeInterest,
        departmentIds: roleDepartments,
        ...branchFields,
        branchId: application.branchId || branchFields.branchId,
        teamId: "",
        status: "approved",
        employmentStatus: "Active",
        staffProfile,
        staffProfileMeta: { ...cloneStaffProfileMetaTemplate(), status: "incomplete" },
        createdAt: new Date().toISOString(),
        hiredFromApplicationId: application.id,
    };
    await adminDb.collection("users").doc(authUser.uid).set(newUser);

    try {
        const resetLink = await adminAuth.generatePasswordResetLink(personal.email);
        console.log(`Set-password link for ${personal.email}: ${resetLink}`);
    } catch (linkErr) {
        console.error("Failed to generate set-password link:", linkErr);
    }

    try {
        await createNotification(adminDb, {
            type: "candidate_approved_for_scheduling",
            title: "New hire ready for scheduling",
            body: `${personal.legalName} was approved and can now be scheduled.`,
            branchId: application.branchId || "",
            link: "/#staff-roster",
            refId: authUser.uid,
        });
    } catch (notifyError) {
        console.error("Failed to create candidate_approved_for_scheduling notification:", notifyError);
    }

    return authUser.uid;
}

export async function POST(request, { params }) {
    try {
        const user = await authenticateRequest(request);
        const { id } = await params;
        const body = await request.json();
        const action = String(body.action || "advance"); // "advance" | "reject" | "withdraw"

        const ref = adminDb.collection("job_applications").doc(id);
        const snap = await ref.get();
        if (!snap.exists) {
            return NextResponse.json({ error: "Application not found." }, { status: 404 });
        }
        const application = { id, ...snap.data() };
        const currentStage = application.status;

        if (!["application_review", "interview", "initial_orientation", "job_site_interview", "job_quality_check", "final_safety_onboarding", "approval_for_scheduling"].includes(currentStage)) {
            return NextResponse.json({ error: "This application is already in a terminal state." }, { status: 400 });
        }

        if (!canActOnHiringStage(user, currentStage)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const actorLabel = user.name || user.email || user.uid;
        const now = new Date().toISOString();

        if (action === "reject") {
            await ref.update({
                status: "rejected",
                rejection: { atStage: currentStage, reason: String(body.notes || "").trim(), rejectedBy: actorLabel, rejectedAt: now },
                updatedAt: now,
            });
            return NextResponse.json({ status: "rejected" }, { status: 200 });
        }

        if (action === "withdraw") {
            await ref.update({
                status: "withdrawn",
                withdrawal: { atStage: currentStage, note: String(body.notes || "").trim(), loggedBy: actorLabel, loggedAt: now },
                updatedAt: now,
            });
            return NextResponse.json({ status: "withdrawn" }, { status: 200 });
        }

        // action === "advance"
        const stageEntry = buildStageEntry({
            actor: actorLabel,
            decision: body.decision || "pass",
            notes: body.notes || "",
            documentUrl: body.documentUrl || "",
            documentName: body.documentName || "",
        });
        const nextStage = getNextStage(currentStage);

        await ref.update({
            [`stages.${currentStage}`]: stageEntry,
            status: nextStage,
            currentStageEnteredAt: now,
            updatedAt: now,
        });

        if (nextStage === "hired") {
            const updatedApplication = { ...application, stages: { ...application.stages, [currentStage]: stageEntry } };
            const convertedToUid = await convertApplicationToStaff(updatedApplication, user.email);
            await ref.update({ convertedToUid });
            return NextResponse.json({ status: "hired", convertedToUid }, { status: 200 });
        }

        return NextResponse.json({ status: nextStage }, { status: 200 });
    } catch (err) {
        console.error("POST hr/applications transition error:", err);
        return NextResponse.json({ error: err.message || "Failed to update application." }, { status: 400 });
    }
}
