import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { canManageBranch } from "../../../../lib/permissions";
import { DEFAULT_BRANCH_ID, getBranchById, getBranchScopeForUser } from "../../../../lib/branches";
import { calculateBiweeklyPayrollBreakdown, getPayPeriodForDateKey } from "../../../../lib/payroll";
import { getZonedDateKey } from "../../../../lib/timezone";

async function authenticateRequest(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing or malformed Authorization header");
    }
    const decodedToken = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) throw new Error("User profile not found");
    const userData = userDoc.data();
    if (userData.status !== "approved") throw new Error("User account is pending approval or disabled");
    return { uid: decodedToken.uid, ...userData };
}

const round2 = (n) => Number(Number(n || 0).toFixed(2));

function formatTime(iso, timeZone) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function formatWeekday(dateKey) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function formatLongDate(date, timeZone) {
    return getZonedDateKey(date, timeZone);
}

function setColumnWidths(sheet, widths) {
    sheet["!cols"] = widths.map((wch) => ({ wch }));
}

// Every approved time entry for the branch, bucketed into its biweekly pay
// cycle, as a two-sheet Excel workbook: a flat line-per-shift sheet (date,
// in, out, break, hours, the rate that shift was actually paid at) meant
// for importing into another system, plus a per-employee-per-cycle summary
// with weekly overtime applied and the paid/pending status. The rate comes
// from each entry's own snapshot, so a raise mid-history shows up on the
// cycles it actually applied to.
export async function GET(request) {
    try {
        const requester = await authenticateRequest(request);
        if (!canManageBranch(requester)) {
            return NextResponse.json({ error: "Forbidden: Admins only." }, { status: 403 });
        }

        const branchId = getBranchScopeForUser(requester).activeBranchId || DEFAULT_BRANCH_ID;
        const timeZone = getBranchById(branchId).timezone;

        const entriesSnap = await adminDb.collection("timeEntries").where("branchId", "==", branchId).get();
        const entries = [];
        entriesSnap.forEach((doc) => {
            const entry = doc.data();
            if (entry.status !== "approved" || !entry.startedAt) return;
            entries.push(entry);
        });
        entries.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

        const uids = [...new Set(entries.map((e) => e.cleanerUid).filter(Boolean))];
        const userDocs = uids.length
            ? await adminDb.getAll(...uids.map((uid) => adminDb.collection("users").doc(uid)))
            : [];
        const users = {};
        userDocs.forEach((doc) => { if (doc.exists) users[doc.id] = doc.data(); });

        const payrollSnap = await adminDb.collection("payrollPeriods").get();
        const payrollRecords = {};
        payrollSnap.forEach((doc) => {
            const r = doc.data();
            payrollRecords[`${r.periodKey}_${r.cleanerUid}`] = r;
        });

        const groups = new Map();
        const lineRows = [];

        entries.forEach((entry) => {
            const startedAt = new Date(entry.startedAt);
            const dateKey = getZonedDateKey(startedAt, timeZone);
            const period = getPayPeriodForDateKey(dateKey);
            const user = users[entry.cleanerUid] || {};
            const employment = user.staffProfile?.employment || {};
            const name = entry.cleanerName || user.name || user.email || "Unknown";
            const email = user.email || "";
            const payRate = Number(entry.payRate ?? employment.hourlyRate ?? 20);
            const overtimeRate = Number(entry.overtimeRate ?? employment.overtimeRate ?? 30);
            const overtimeAfterHours = Number(entry.overtimeAfterHours ?? employment.overtimeAfterHours ?? 44);
            const minutes = Number(entry.durationMinutes || 0);

            lineRows.push({
                "Pay Period": period.label,
                "Period Start": formatLongDate(period.periodStart, timeZone),
                "Period End": formatLongDate(period.cutoffDate, timeZone),
                "Employee": name,
                "Email": email,
                "Employee ID": entry.cleanerUid || "",
                "Date": dateKey,
                "Day": formatWeekday(dateKey),
                "Time In": formatTime(entry.startedAt, timeZone),
                "Time Out": formatTime(entry.endedAt, timeZone),
                "Unpaid Break (min)": Number(entry.unpaidBreakMinutes || 0),
                "Paid Hours": round2(minutes / 60),
                "Pay Rate ($/h)": round2(payRate),
                "Job / Service": [entry.serviceName, entry.customerFirstName].filter(Boolean).join(" — ") || entry.locationLabel || "",
                "Entry ID": entry.id || "",
                _sortKey: `${period.key}|${name}|${entry.startedAt}`,
            });

            const groupKey = `${period.key}|${entry.cleanerUid}`;
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    period, uid: entry.cleanerUid, name, email,
                    minutesByDate: {}, rates: new Set(), totalMinutes: 0,
                    payRate, overtimeRate, overtimeAfterHours,
                });
            }
            const g = groups.get(groupKey);
            g.minutesByDate[dateKey] = (g.minutesByDate[dateKey] || 0) + minutes;
            g.totalMinutes += minutes;
            g.rates.add(round2(payRate));
            // Entries are chronological, so this ends on the cycle's latest rate.
            g.payRate = payRate;
            g.overtimeRate = overtimeRate;
            g.overtimeAfterHours = overtimeAfterHours;
        });

        lineRows.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
        const lineSheetRows = lineRows.map(({ _sortKey, ...rest }) => rest);

        const summaryRows = [...groups.values()]
            .map((g) => {
                const breakdown = calculateBiweeklyPayrollBreakdown(g.minutesByDate, g.period.periodStart, {
                    hourlyRate: g.payRate,
                    overtimeRate: g.overtimeRate,
                    overtimeAfterHours: g.overtimeAfterHours,
                    bonusAmount: 0,
                });
                const week2StartKey = formatLongDate(new Date(g.period.periodStart.getTime() + 7 * 86400000 + 12 * 3600000), timeZone);
                let week1 = 0;
                let week2 = 0;
                Object.entries(g.minutesByDate).forEach(([dateKey, mins]) => {
                    if (dateKey >= week2StartKey) week2 += mins; else week1 += mins;
                });
                const record = payrollRecords[`${g.period.key}_${g.uid}`];
                return {
                    "Pay Period": g.period.label,
                    "Period Start": formatLongDate(g.period.periodStart, timeZone),
                    "Period End": formatLongDate(g.period.cutoffDate, timeZone),
                    "Pay Date": formatLongDate(g.period.payDate, timeZone),
                    "Employee": g.name,
                    "Email": g.email,
                    "Employee ID": g.uid || "",
                    "Week 1 Hours": round2(week1 / 60),
                    "Week 2 Hours": round2(week2 / 60),
                    "Total Hours": breakdown.totalHours,
                    "Regular Hours": breakdown.regularHours,
                    "Overtime Hours": breakdown.overtimeHours,
                    "Pay Rate ($/h)": round2(g.payRate),
                    "OT Rate ($/h)": round2(g.overtimeRate),
                    "Regular Pay": breakdown.regularPay,
                    "Overtime Pay": breakdown.overtimePay,
                    "Gross Pay": breakdown.grossPay,
                    "Rate Note": g.rates.size > 1 ? "Rate changed mid-cycle — see Time Entries sheet" : "",
                    "Payment Status": record?.status || "pending",
                    "Paid On": record?.paidAt ? formatLongDate(new Date(record.paidAt), timeZone) : "",
                    _sortKey: `${g.period.key}|${g.name}`,
                };
            })
            .sort((a, b) => a._sortKey.localeCompare(b._sortKey))
            .map(({ _sortKey, ...rest }) => rest);

        const entriesSheet = XLSX.utils.json_to_sheet(lineSheetRows);
        setColumnWidths(entriesSheet, [18, 12, 12, 24, 28, 30, 12, 6, 9, 9, 18, 12, 14, 34, 28]);
        entriesSheet["!autofilter"] = { ref: entriesSheet["!ref"] };

        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        setColumnWidths(summarySheet, [18, 12, 12, 12, 24, 28, 30, 13, 13, 12, 13, 14, 14, 13, 13, 13, 12, 40, 14, 12]);
        summarySheet["!autofilter"] = { ref: summarySheet["!ref"] };

        const notesSheet = XLSX.utils.aoa_to_sheet([
            ["SmarTouch Clean — payroll export"],
            [`Generated ${new Date().toLocaleString("en-CA", { timeZone })} (${timeZone})`],
            [],
            ["Time Entries sheet", "One row per approved shift. Paid Hours = clock-out minus clock-in minus unpaid break. Pay Rate is the rate recorded on that shift when it was created, so past raises appear on the cycles they applied to."],
            ["Cycle Summary sheet", "One row per employee per biweekly cycle. Overtime is calculated per calendar week (hours over the overtime threshold, 44 by default, in each of the cycle's two weeks), then added together."],
            ["Included", "Approved time entries only. Pending, rejected and deleted entries are excluded."],
            ["Not included", "Bonuses, deductions, taxes and CPP/EI. Gross Pay here is hours × rate only."],
            ["Times", `All dates and times are in the branch timezone (${timeZone}), 24-hour clock.`],
        ]);
        setColumnWidths(notesSheet, [22, 120]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, entriesSheet, "Time Entries");
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Cycle Summary");
        XLSX.utils.book_append_sheet(workbook, notesSheet, "Notes");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        const fileDate = getZonedDateKey(new Date(), timeZone);

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="payroll-all-cycles-${fileDate}.xlsx"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("GET payroll export error:", err);
        const status = err.message?.includes("Authorization") || err.message?.includes("approved") ? 401 : 500;
        return NextResponse.json({ error: err.message || "Failed to generate export." }, { status });
    }
}
