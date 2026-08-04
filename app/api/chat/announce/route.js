import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch, normalizeRole } from "../../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser } from "../../../../lib/branches";
import { buildCustomerRecords } from "../../../../lib/customers";
import { appendSupportMessage } from "../../../../lib/supportChat";
import { normalizePhone } from "../../../../lib/phone";
import { trySendSms, buildSupportMessageSms } from "../../../../lib/sms";

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
    return userData;
}

const FIELD_STAFF_ROLES = ["cleaner", "supervisor", "employee", "subcontractor"];
const INACTIVE_EMPLOYMENT_STATUSES = ["Inactive", "Suspended", "On Leave"];

// Bulk-announce is a bigger blast radius than one-to-one support chat (a
// mistake here messages everyone at once, and can trigger real billed SMS
// for every recipient), so it's gated a tier higher than plain support-chat
// access (canManageBranch, not just isSupportStaff/sales/operations).
async function resolveCustomerRecipients(user, requestedBranchId) {
    const branchScope = getBranchScopeForUser(user);
    const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

    let query = adminDb.collection("bookings");
    if (!branchScope.canSwitchBranches || requestedBranchId) {
        query = query.where("branchId", "==", activeBranchId);
    }

    const snapshot = await query.get();
    const bookings = [];
    snapshot.forEach(doc => bookings.push(doc.data()));
    const records = buildCustomerRecords(bookings);

    // Support threads are phone-keyed only (supportThreadId always calls
    // normalizePhone) — an email-only customer has no valid thread id, so
    // they're skipped rather than silently colliding into "customer_"
    // (normalizePhone("") is an empty string) alongside every other
    // email-only customer.
    const withPhone = records.filter(r => normalizePhone(r.phone));
    return {
        recipients: withPhone.map(r => ({ type: "customer", refId: r.phone, refName: r.name })),
        skippedCount: records.length - withPhone.length,
    };
}

async function resolveCleanerRecipients() {
    const snapshot = await adminDb.collection("users").get();
    const recipients = [];
    let skippedCount = 0;
    snapshot.forEach(doc => {
        const data = doc.data();
        const role = normalizeRole(data.role);
        if (data.status !== "approved" || !FIELD_STAFF_ROLES.includes(role)) return;
        if (INACTIVE_EMPLOYMENT_STATUSES.includes(data.employmentStatus)) {
            skippedCount += 1;
            return;
        }
        recipients.push({ type: "cleaner", refId: data.uid, refName: data.name || data.email || "Team member" });
    });
    return { recipients, skippedCount };
}

// GET: history of past bulk announcements, newest first — the "so we know
// the history" record of what was broadcast and when, separate from each
// recipient's own thread (which just shows the message like any other).
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch management can view announcement history." }, { status: 403 });
        }
        const snapshot = await adminDb.collection("announcements").get();
        const announcements = snapshot.docs
            .map(doc => doc.data())
            .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
            .slice(0, 50);
        return NextResponse.json(announcements, { status: 200 });
    } catch (err) {
        console.error("GET announcements error:", err);
        return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
    }
}

// POST: send one message into every recipient's own persistent support
// thread (same appendSupportMessage writer the 1:1 support chat uses), so
// it becomes a normal, permanent part of their conversation history and any
// reply lands right back in that same thread for staff to see.
export async function POST(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canManageBranch(user)) {
            return NextResponse.json({ error: "Forbidden: Only branch management can send announcements." }, { status: 403 });
        }

        const { audience, text, sendSms, branchId } = await request.json();
        const trimmedText = String(text || "").trim();
        if (!["customer", "cleaner"].includes(audience) || !trimmedText) {
            return NextResponse.json({ error: "Missing audience or message text." }, { status: 400 });
        }

        const { recipients, skippedCount } = audience === "customer"
            ? await resolveCustomerRecipients(user, branchId)
            : await resolveCleanerRecipients();

        if (recipients.length === 0) {
            return NextResponse.json({ error: "No recipients found for this audience." }, { status: 400 });
        }

        const senderName = user.name || user.email || "SmarTouch Clean";
        const results = await Promise.allSettled(
            recipients.map(r => appendSupportMessage(adminDb, {
                type: r.type, refId: r.refId, refName: r.refName,
                senderKind: "staff", senderId: user.uid, senderName,
                text: trimmedText,
            }))
        );
        const sentCount = results.filter(r => r.status === "fulfilled").length;

        let smsSentCount = 0;
        if (sendSms) {
            const smsResults = await Promise.allSettled(recipients.map(async (r) => {
                const phone = r.type === "customer" ? normalizePhone(r.refId) : (await adminDb.collection("users").doc(r.refId).get()).data()?.staffProfile?.personal?.phone;
                if (!phone) return { ok: false };
                return trySendSms(phone, buildSupportMessageSms(trimmedText, senderName));
            }));
            smsSentCount = smsResults.filter(r => r.status === "fulfilled" && r.value?.ok).length;
        }

        const announcement = {
            id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            audience,
            text: trimmedText,
            sendSms: Boolean(sendSms),
            sentBy: { uid: user.uid, name: senderName },
            sentAt: new Date().toISOString(),
            recipientCount: recipients.length,
            sentCount,
            smsSentCount,
            skippedCount,
        };
        await adminDb.collection("announcements").doc(announcement.id).set(announcement);

        return NextResponse.json({ message: `Sent to ${sentCount} of ${recipients.length} recipients.`, announcement }, { status: 200 });
    } catch (err) {
        console.error("POST announcement error:", err);
        return NextResponse.json({ error: err.message || "Failed to send announcement." }, { status: 500 });
    }
}
