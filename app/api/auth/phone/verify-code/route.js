import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../lib/firebase-admin";
import { ROLE_DEFINITIONS } from "../../../../../lib/permissions";
import { createDefaultBranchUserFields } from "../../../../../lib/branches";

function normalizePhoneNumber(value = "") {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) {
        return `+${trimmed.slice(1).replace(/\D/g, "")}`;
    }
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return `+${digits}`;
}

function buildFallbackName(phoneNumber) {
    return `Cleaner ${phoneNumber.slice(-4)}`;
}

export async function POST(request) {
    try {
        const { phone, code, mode = "login", name = "" } = await request.json();
        const phoneNumber = normalizePhoneNumber(phone);
        const cleanCode = String(code || "").trim();

        if (!phoneNumber || !cleanCode) {
            return NextResponse.json({ error: "Phone number and verification code are required." }, { status: 400 });
        }

        const verificationRef = adminDb.collection("phone_verifications").doc(phoneNumber);
        const verificationSnap = await verificationRef.get();
        if (!verificationSnap.exists) {
            return NextResponse.json({ error: "Verification session not found. Please request a new code." }, { status: 404 });
        }

        const verification = verificationSnap.data();
        if (verification.expiresAt < Date.now()) {
            await verificationRef.delete();
            return NextResponse.json({ error: "Verification code expired. Please request a new code." }, { status: 400 });
        }

        if (verification.code !== cleanCode) {
            await verificationRef.update({ attempts: (verification.attempts || 0) + 1 });
            return NextResponse.json({ error: "Incorrect verification code." }, { status: 400 });
        }

        let authUser;
        const normalizedName = String(name || verification.name || "").trim();

        if (mode === "signup") {
            authUser = await adminAuth.createUser({
                phoneNumber,
                displayName: normalizedName || buildFallbackName(phoneNumber)
            });

            await adminDb.collection("users").doc(authUser.uid).set({
                uid: authUser.uid,
                name: normalizedName || authUser.displayName || buildFallbackName(phoneNumber),
                email: "",
                phone: phoneNumber,
                photoURL: authUser.photoURL || "",
                role: "cleaner",
                departmentIds: ROLE_DEFINITIONS.cleaner.departments,
                ...createDefaultBranchUserFields("cleaner"),
                teamId: "",
                status: "pending_approval",
                createdAt: new Date().toISOString()
            });
        } else {
            authUser = await adminAuth.getUserByPhoneNumber(phoneNumber);
            const userRef = adminDb.collection("users").doc(authUser.uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) {
                await userRef.set({
                    uid: authUser.uid,
                    name: authUser.displayName || buildFallbackName(phoneNumber),
                    email: "",
                    phone: phoneNumber,
                    photoURL: authUser.photoURL || "",
                    role: "cleaner",
                    departmentIds: ROLE_DEFINITIONS.cleaner.departments,
                    ...createDefaultBranchUserFields("cleaner"),
                    teamId: "",
                    status: "pending_approval",
                    createdAt: new Date().toISOString()
                });
            }
        }

        const customToken = await adminAuth.createCustomToken(authUser.uid);
        await verificationRef.delete();

        return NextResponse.json({
            message: mode === "signup" ? "Phone signup completed." : "Phone sign in completed.",
            customToken
        }, { status: 200 });
    } catch (error) {
        console.error("Phone verify-code error:", error);
        return NextResponse.json({ error: error.message || "Failed to verify phone code." }, { status: 500 });
    }
}
