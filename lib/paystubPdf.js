import PDFDocument from "pdfkit/js/pdfkit.standalone.js";

// Same print scale and palette as lib/bookingDocumentPdf.js / lib/customerReportPdf.js —
// keeps every PDF this app generates looking like one family of documents.
const SIZE = {
    title: 16,
    subhead: 11,
    body: 9.5,
    small: 8,
};

const NAVY = "#0b2f5e";
const GREEN = "#5ba531";
const SLATE = "#5a6b81";
const BORDER = "#dde3ea";
const PALE = "#f3f8f0";
const RED = "#b3261e";
const AMBER = "#b45309";

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

// Every timestamp here comes off Firestore as a UTC ISO string. Without an
// explicit timeZone, toLocaleDateString/toLocaleTimeString fall back to the
// server process's local zone (UTC on most hosts) — a cleaner who clocked in
// at 8:00 AM Eastern would show as 12:00 PM (or roll onto the wrong day
// entirely for a late-evening shift). Branch is Eastern by default; the
// route passes the branch's actual timezone when it has one.
function formatDateLong(date, timeZone) {
    if (!date) return "—";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone });
}

function formatDateShort(date, timeZone) {
    if (!date) return "—";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
}

function formatClockTime(value, timeZone) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

function formatHours(minutes) {
    return (Number(minutes || 0) / 60).toFixed(2);
}

function getLogoImageSource(logoBuffer) {
    if (!logoBuffer) return null;
    if (typeof logoBuffer === "string") return logoBuffer;
    return `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
}

const STATUS_COLOR = { paid: GREEN, processing: "#2563eb", pending: AMBER };

// One employee's earnings statement for one pay period: cutoff dates, a
// day-by-day time log (in/out/break/hours), and an earnings summary that
// splits regular vs. overtime the same way the Payroll tab computes it.
// Not a tax document — this app doesn't model withholding, so gross pay
// and net pay are the same figure (called out explicitly on the page).
export async function buildPaystubPdf({ employee = {}, period = {}, rows = [], breakdown = {}, company = {}, payrollRecord = null }, options = {}) {
    const timeZone = options.timeZone || "America/Toronto";
    const logoImageSource = getLogoImageSource(options.logoBuffer);
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const pdfBuffer = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 36;
    const contentWidth = pageWidth - (margin * 2);
    const logoSize = 56;

    const addText = (text, x, y, opts = {}) => {
        doc.fillColor(opts.color || "#1a2942");
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || SIZE.body);
        doc.text(String(text ?? ""), x, y, {
            width: opts.width,
            height: opts.height || 34,
            align: opts.align,
            lineGap: opts.lineGap,
            lineBreak: opts.lineBreak ?? false,
            ellipsis: opts.ellipsis,
        });
    };

    const footerReserve = 60;
    const pageBottom = pageHeight - footerReserve - 12;

    let pageNumber = 1;
    const addFooter = (num) => {
        const footerY = pageHeight - 48;
        doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(1).strokeColor(BORDER).stroke();
        addText(company.companyName || "SmarTouch Clean", margin, footerY + 8, { size: SIZE.small, color: SLATE, font: "Helvetica-Bold" });
        addText("This is an earnings statement, not a tax document. Retain for your records.", margin, footerY + 20, { size: SIZE.small - 0.5, color: SLATE });
        addText(`Page ${num}`, pageWidth - margin - 100, footerY + 14, { size: SIZE.small, color: GREEN, font: "Helvetica-Bold", width: 100, align: "right" });
    };

    const startPage = () => {
        addFooter(pageNumber);
        doc.addPage({ size: "A4", margin });
        pageNumber += 1;
        return margin;
    };

    let y = margin;

    // ── Header ──
    try {
        if (logoImageSource) {
            doc.image(logoImageSource, margin, y, { fit: [logoSize, logoSize] });
        } else {
            throw new Error("no-logo");
        }
    } catch (_error) {
        addText(company.companyName || "SmarTouch Clean", margin, y + 6, { size: SIZE.title, color: NAVY, font: "Helvetica-Bold" });
    }

    const rightX = margin + (contentWidth * 0.5);
    addText("PAY STATEMENT", rightX, y + 2, {
        size: SIZE.title, color: NAVY, font: "Helvetica-Bold", width: contentWidth * 0.5, align: "right",
    });
    doc.moveTo(rightX + 90, y + 24).lineTo(pageWidth - margin, y + 24).lineWidth(1.5).strokeColor(GREEN).stroke();
    addText(period.label || "", rightX, y + 30, {
        size: SIZE.small, color: SLATE, width: contentWidth * 0.5, align: "right",
    });

    y = margin + logoSize + 16;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor(BORDER).stroke();
    y += 14;

    // ── Employee card / Pay period card ──
    const cardTop = y;
    const leftCardWidth = (contentWidth - 24) / 2;
    const rightCardX = margin + leftCardWidth + 24;
    const cardHeight = 74;

    addText("EMPLOYEE", margin, cardTop, { size: SIZE.small, color: NAVY, font: "Helvetica-Bold" });
    addText(employee.name || "Employee", margin, cardTop + 14, { size: SIZE.subhead + 2, font: "Helvetica-Bold", width: leftCardWidth - 12, height: 17, ellipsis: true });
    addText(employee.roleLabel || "Field Staff", margin, cardTop + 34, { size: SIZE.small, color: SLATE });
    addText(`Employee ID: ${employee.employeeId || "—"}`, margin, cardTop + 46, { size: SIZE.small, color: SLATE });
    addText(employee.phone || "", margin, cardTop + 58, { size: SIZE.small, color: SLATE });

    doc.moveTo(margin + leftCardWidth + 12, cardTop).lineTo(margin + leftCardWidth + 12, cardTop + cardHeight).lineWidth(1).strokeColor(BORDER).stroke();

    const statusKey = (payrollRecord?.status || "pending").toLowerCase();
    const statusLabel = statusKey === "paid" ? "Paid" : statusKey === "processing" ? "Processing" : "Pending";
    addText("PAY PERIOD", rightCardX, cardTop, { size: SIZE.small, color: NAVY, font: "Helvetica-Bold" });
    addText(`${formatDateLong(period.periodStart, timeZone)} – ${formatDateLong(period.cutoffDate, timeZone)}`, rightCardX, cardTop + 14, {
        size: SIZE.body, font: "Helvetica-Bold", width: leftCardWidth,
    });
    addText(`Pay date: ${period.payDateFull || "—"}`, rightCardX, cardTop + 34, { size: SIZE.small, color: SLATE });
    addText("Status: ", rightCardX, cardTop + 46, { size: SIZE.small, color: SLATE, width: 46 });
    addText(statusLabel, rightCardX + 40, cardTop + 46, { size: SIZE.small, color: STATUS_COLOR[statusKey] || AMBER, font: "Helvetica-Bold" });
    if (payrollRecord?.paidAt) {
        addText(`Paid on ${formatDateLong(new Date(payrollRecord.paidAt), timeZone)}`, rightCardX, cardTop + 58, { size: SIZE.small, color: SLATE });
    }

    y = cardTop + cardHeight + 14;

    // ── Earnings summary band ──
    const bonusAmount = Number(breakdown.bonusAmount || 0);
    const summaryCols = [
        ["REGULAR", `${Number(breakdown.regularHours || 0).toFixed(2)}h @ ${formatMoney(breakdown.hourlyRate)}`, formatMoney(breakdown.regularPay), NAVY],
        ["OVERTIME", `${Number(breakdown.overtimeHours || 0).toFixed(2)}h @ ${formatMoney(breakdown.overtimeRate)}`, formatMoney(breakdown.overtimePay), Number(breakdown.overtimeHours || 0) > 0 ? AMBER : NAVY],
        ...(bonusAmount > 0 ? [["BONUS", "—", formatMoney(bonusAmount), NAVY]] : []),
        ["GROSS PAY", "This period", formatMoney(breakdown.grossPay), GREEN],
    ];
    const bannerHeight = 48;
    const bannerColWidth = contentWidth / summaryCols.length;
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).fillColor(PALE).fill();
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).lineWidth(1).strokeColor(GREEN).stroke();
    summaryCols.forEach(([label, sub, value, color], index) => {
        const colX = margin + 14 + (index * bannerColWidth);
        addText(label, colX, y + 8, { size: SIZE.small - 0.5, color: SLATE, font: "Helvetica-Bold", width: bannerColWidth - 20 });
        addText(sub, colX, y + 19, { size: SIZE.small - 0.5, color: SLATE, width: bannerColWidth - 20 });
        addText(value, colX, y + 30, { size: SIZE.subhead + 1, color, font: "Helvetica-Bold", width: bannerColWidth - 20 });
    });
    y += bannerHeight + 16;

    // ── Daily time log table ──
    const tableX = margin;
    const tableWidth = contentWidth;
    const cellPad = 6;
    const rowFont = SIZE.body - 0.5;
    const headFont = SIZE.small - 0.5;
    // DATE | JOB / CLIENT | TIME IN | TIME OUT | BREAK | HOURS | DAILY PAY
    const colWidths = [82, tableWidth - 82 - 62 - 62 - 52 - 52 - 66, 62, 62, 52, 52, 66];
    const MONEY_COL_START = 5;
    const headerHeight = 18;
    const headers = ["DATE", "JOB / CLIENT", "TIME IN", "TIME OUT", "BREAK", "HOURS", "DAILY PAY"];

    const drawTableHeader = (headerY) => {
        doc.roundedRect(tableX, headerY, tableWidth, headerHeight, 5).fillColor(NAVY).fill();
        let cursorX = tableX;
        headers.forEach((header, index) => {
            addText(header, cursorX + cellPad, headerY + 5, {
                size: headFont, color: "#ffffff", font: "Helvetica-Bold",
                width: colWidths[index] - (cellPad * 2), align: index >= MONEY_COL_START ? "right" : "left",
            });
            cursorX += colWidths[index];
        });
        return headerY + headerHeight;
    };

    addText("DAILY TIME LOG", margin, y, { size: SIZE.subhead, color: NAVY, font: "Helvetica-Bold" });
    y += 14;
    y = drawTableHeader(y);

    if (rows.length === 0) {
        doc.rect(tableX, y, tableWidth, 26).fillAndStroke("#ffffff", BORDER);
        addText("No approved time entries in this pay period.", tableX + cellPad, y + 8, { size: rowFont, color: SLATE });
        y += 26;
    }

    let totalBreakMinutes = 0;
    let totalHoursMinutes = 0;
    let totalDailyPay = 0;

    rows.forEach((row) => {
        const dateText = formatDateShort(row.date, timeZone);
        const jobText = row.jobLabel || "—";
        const jobWidth = colWidths[1] - (cellPad * 2);
        const measure = (text, width, font) => {
            doc.font(font).fontSize(rowFont);
            return doc.heightOfString(text, { width });
        };
        const wrapHeight = measure(jobText, jobWidth, "Helvetica");
        const rowHeight = Math.max(20, wrapHeight + 10);

        if (y + rowHeight > pageBottom) {
            y = startPage();
            addText("DAILY TIME LOG — continued", margin, y, { size: headFont, color: SLATE, font: "Helvetica-Bold" });
            y += 14;
            y = drawTableHeader(y);
        }

        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#ffffff", BORDER);
        let cursorX = tableX;
        addText(dateText, cursorX + cellPad, y + 6, { size: rowFont, font: "Helvetica-Bold", width: colWidths[0] - (cellPad * 2), height: rowHeight - 4 });
        cursorX += colWidths[0];
        addText(jobText, cursorX + cellPad, y + 6, { size: rowFont, color: SLATE, width: jobWidth, height: rowHeight - 4, lineBreak: true });
        cursorX += colWidths[1];
        addText(formatClockTime(row.timeIn, timeZone), cursorX + cellPad, y + 6, { size: rowFont, width: colWidths[2] - (cellPad * 2) });
        cursorX += colWidths[2];
        addText(formatClockTime(row.timeOut, timeZone), cursorX + cellPad, y + 6, { size: rowFont, width: colWidths[3] - (cellPad * 2) });
        cursorX += colWidths[3];
        addText(row.breakMinutes > 0 ? `${row.breakMinutes}m` : "—", cursorX + cellPad, y + 6, { size: rowFont, color: SLATE, width: colWidths[4] - (cellPad * 2), align: "right" });
        cursorX += colWidths[4];
        addText(formatHours(row.durationMinutes), cursorX + cellPad, y + 6, { size: rowFont, font: "Helvetica-Bold", width: colWidths[5] - (cellPad * 2), align: "right" });
        cursorX += colWidths[5];
        addText(formatMoney(row.dailyPay), cursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[6] - (cellPad * 2), align: "right" });

        totalBreakMinutes += Number(row.breakMinutes || 0);
        totalHoursMinutes += Number(row.durationMinutes || 0);
        totalDailyPay += Number(row.dailyPay || 0);

        y += rowHeight;
    });

    const totalsRowHeight = 20;
    if (y + totalsRowHeight > pageBottom) {
        y = startPage();
        y = drawTableHeader(y);
    }
    doc.rect(tableX, y, tableWidth, totalsRowHeight).fillAndStroke(PALE, BORDER);
    addText("TOTAL", tableX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - cellPad });
    let totalsCursorX = tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    addText(totalBreakMinutes > 0 ? `${totalBreakMinutes}m` : "—", totalsCursorX + cellPad, y + 6, { size: rowFont, color: SLATE, font: "Helvetica-Bold", width: colWidths[4] - (cellPad * 2), align: "right" });
    totalsCursorX += colWidths[4];
    addText(formatHours(totalHoursMinutes), totalsCursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[5] - (cellPad * 2), align: "right" });
    totalsCursorX += colWidths[5];
    addText(formatMoney(totalDailyPay), totalsCursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[6] - (cellPad * 2), align: "right" });
    y += totalsRowHeight + 8;

    addText(
        `Daily pay above is shown at the base rate of ${formatMoney(breakdown.hourlyRate)}/hr. Overtime premium for hours worked beyond ${breakdown.overtimeAfterHours || 44}h in the period (${formatMoney(breakdown.overtimeRate)}/hr) is applied period-wide and reflected in the Earnings Summary above, not per day.`,
        margin, y, { size: SIZE.small - 0.5, color: SLATE, width: contentWidth, lineBreak: true, height: 24 }
    );
    y += 26;

    // ── Net pay banner ──
    const netHeight = 40;
    if (y + netHeight > pageBottom) y = startPage();
    doc.roundedRect(margin, y, contentWidth, netHeight, 7).fillColor(NAVY).fill();
    addText("NET PAY", margin + 16, y + 12, { size: SIZE.subhead, color: "#ffffff", font: "Helvetica-Bold" });
    addText(formatMoney(breakdown.grossPay), margin, y + 8, { size: SIZE.title + 2, color: "#ffffff", font: "Helvetica-Bold", width: contentWidth - 16, align: "right" });

    addFooter(pageNumber);
    doc.end();
    return pdfBuffer;
}
