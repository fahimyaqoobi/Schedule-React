import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch, roleHasDepartment } from "../../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchScopeForUser, userCanAccessBranch } from "../../../../lib/branches";
import { buildCustomerRecords } from "../../../../lib/customers";
import { buildCustomerReportPdf } from "../../../../lib/customerReportPdf";

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

function canViewCustomers(user) {
    return canManageBranch(user) || roleHasDepartment(user.role, "sales") || roleHasDepartment(user.role, "operations");
}

async function loadLogoBuffer(origin) {
    try {
        const res = await fetch(`${origin}/logo-full.png`);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

// Per-customer "small report" PDF — completed services only, with a
// paid/unpaid summary, downloadable from the Customer Directory.
export async function GET(request) {
    try {
        const user = await authenticateRequest(request);
        if (!canViewCustomers(user)) {
            return NextResponse.json({ error: "Forbidden: You cannot view the customer directory." }, { status: 403 });
        }

        const { searchParams, origin } = new URL(request.url);
        const key = searchParams.get("key");
        if (!key) return NextResponse.json({ error: "Missing customer key." }, { status: 400 });

        const requestedBranchId = searchParams.get("branchId");
        const branchScope = getBranchScopeForUser(user);
        const activeBranchId = requestedBranchId || branchScope.activeBranchId || DEFAULT_BRANCH_ID;

        let query = adminDb.collection("bookings");
        if (!branchScope.canSwitchBranches || requestedBranchId) {
            if (!userCanAccessBranch(user, activeBranchId)) {
                return NextResponse.json({ error: "Forbidden: You cannot access this branch." }, { status: 403 });
            }
            query = query.where("branchId", "==", activeBranchId);
        }

        const snapshot = await query.get();
        const bookings = [];
        snapshot.forEach((doc) => bookings.push(doc.data()));

        const records = buildCustomerRecords(bookings);
        const record = records.find((r) => r.key === key);
        if (!record) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

        const completedBookings = record.bookings.filter((b) => b.status === "Completed");

        const settingsSnap = await adminDb.collection("settings").doc("pricing").get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};
        const company = {
            companyName: settings.companyName || "SmarTouch Clean",
        };

        const logoBuffer = await loadLogoBuffer(origin);
        const pdfBuffer = await buildCustomerReportPdf(
            { customer: record, bookings: completedBookings, company },
            { logoBuffer }
        );

        const safeName = (record.name || "customer").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${safeName}-service-report.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("GET customer report PDF error:", err);
        const status = err.message?.includes("Authorization") || err.message?.includes("approved") ? 401 : 500;
        return NextResponse.json({ error: err.message || "Failed to generate report." }, { status });
    }
}
