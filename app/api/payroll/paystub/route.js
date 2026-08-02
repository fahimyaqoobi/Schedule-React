import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch, getRoleLabel } from "../../../../lib/permissions";
import { calculatePayrollBreakdown, getPayPeriodFromKey } from "../../../../lib/payroll";
import { getBranchById } from "../../../../lib/branches";
import { buildPaystubPdf } from "../../../../lib/paystubPdf";

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

async function loadLogoBuffer(origin) {
    try {
        const res = await fetch(`${origin}/logo-full.png`);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

// One employee's paystub PDF for one biweekly pay period — cutoff dates,
// a day-by-day time log (in/out/break/hours), and an earnings summary.
// Admins can pull anyone's on their branch; a cleaner/subcontractor can
// pull their own without needing to ask an admin.
export async function GET(request) {
    try {
        const requester = await authenticateRequest(request);
        const { searchParams, origin } = new URL(request.url);
        const cleanerUid = searchParams.get("cleanerUid");
        const periodKey = searchParams.get("periodKey");
        if (!cleanerUid || !periodKey) {
            return NextResponse.json({ error: "cleanerUid and periodKey are required." }, { status: 400 });
        }

        const isSelf = requester.uid === cleanerUid;
        if (!isSelf && !canManageBranch(requester)) {
            return NextResponse.json({ error: "Forbidden: You cannot view this paystub." }, { status: 403 });
        }

        const period = getPayPeriodFromKey(periodKey);
        if (!period) return NextResponse.json({ error: "Invalid periodKey." }, { status: 400 });

        const cleanerDoc = await adminDb.collection("users").doc(cleanerUid).get();
        if (!cleanerDoc.exists) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
        const cleaner = cleanerDoc.data();

        if (!isSelf && requester.branchId && cleaner.branchId && requester.branchId !== cleaner.branchId && requester.role !== "super-admin") {
            return NextResponse.json({ error: "Forbidden: You cannot view this branch's payroll." }, { status: 403 });
        }

        const startMs = period.periodStart.getTime();
        const endMs = period.cutoffDate.getTime();

        const entriesSnap = await adminDb.collection("timeEntries").where("cleanerUid", "==", cleanerUid).get();
        const entries = [];
        entriesSnap.forEach((doc) => {
            const entry = doc.data();
            if (entry.status !== "approved") return;
            const d = new Date(entry.startedAt || entry.bookingDate || 0).getTime();
            if (d >= startMs && d <= endMs) entries.push(entry);
        });
        entries.sort((a, b) => new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime());

        // The staff profile's employment settings are the current, admin-
        // configured rate — the source of truth. The rate snapshotted onto
        // each time entry at creation only backs that up if the profile is
        // somehow missing rate data (e.g. a very old entry), since a rate
        // edited after the entry was created would otherwise go stale here.
        const employment = cleaner.staffProfile?.employment || {};
        const payRate = Number(employment.hourlyRate ?? entries[0]?.payRate ?? 20);
        const overtimeRate = Number(employment.overtimeRate ?? entries[0]?.overtimeRate ?? 30);
        const overtimeAfterHours = Number(employment.overtimeAfterHours ?? entries[0]?.overtimeAfterHours ?? 44);
        const bonusAmount = Number(employment.bonusAmount ?? 0);

        const totalMinutes = entries.reduce((sum, e) => sum + Number(e.durationMinutes || 0), 0);
        const breakdown = calculatePayrollBreakdown(totalMinutes, {
            hourlyRate: payRate,
            overtimeRate,
            overtimeAfterHours,
            bonusAmount,
        });

        const rows = entries.map((entry) => {
            const durationMinutes = Number(entry.durationMinutes || 0);
            return {
                date: new Date(entry.startedAt || entry.bookingDate),
                jobLabel: [entry.serviceName, entry.customerFirstName].filter(Boolean).join(" — ") || entry.locationLabel || "Manual entry",
                timeIn: entry.startedAt,
                timeOut: entry.endedAt,
                breakMinutes: Number(entry.unpaidBreakMinutes || 0),
                durationMinutes,
                dailyPay: Number(((durationMinutes / 60) * payRate).toFixed(2)),
            };
        });

        const periodDoc = await adminDb.collection("payrollPeriods").doc(`${periodKey}_${cleanerUid}`).get();
        const payrollRecord = periodDoc.exists ? periodDoc.data() : null;

        const settingsSnap = await adminDb.collection("settings").doc("pricing").get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};
        const company = { companyName: settings.companyName || "SmarTouch Clean" };

        const branchTimeZone = getBranchById(cleaner.branchId).timezone;

        const logoBuffer = await loadLogoBuffer(origin);
        const pdfBuffer = await buildPaystubPdf({
            employee: {
                name: cleaner.name || cleaner.email || "Employee",
                roleLabel: getRoleLabel(cleaner.role),
                employeeId: cleanerUid.slice(-8).toUpperCase(),
                phone: cleaner.staffProfile?.personal?.phone || cleaner.phone || "",
            },
            period,
            rows,
            breakdown,
            company,
            payrollRecord,
        }, { logoBuffer, timeZone: branchTimeZone });

        const safeName = (cleaner.name || "employee").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${safeName}-paystub-${periodKey}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("GET paystub PDF error:", err);
        const status = err.message?.includes("Authorization") || err.message?.includes("approved") ? 401 : 500;
        return NextResponse.json({ error: err.message || "Failed to generate paystub." }, { status });
    }
}
