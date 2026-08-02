import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { formatZonedDate } from "./timezone";

// Same print scale and palette as lib/bookingDocumentPdf.js — keeps every
// PDF this app generates looking like one family of documents.
const SIZE = {
    title: 16,
    subhead: 11,
    body: 9.5,
    small: 8,
    totalLabel: 13,
    totalValue: 18,
};

const NAVY = "#0b2f5e";
const GREEN = "#5ba531";
const SLATE = "#5a6b81";
const BORDER = "#dde3ea";
const PALE = "#f3f8f0";

function formatDate(value) {
    if (!value) return "—";
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatZonedDate(parsed, { year: "numeric", month: "long", day: "numeric" });
}

// Short form ("Jun 1, 2026") for the compact table — keeps the date column
// narrow without wrapping onto a third line.
function formatDateShort(value) {
    if (!value) return "—";
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatZonedDate(parsed, { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function formatAddress(booking) {
    const line1 = [booking.address1, booking.address2].filter(Boolean).join(", ");
    const line2 = [booking.city, booking.state, booking.postalCode].filter(Boolean).join(", ");
    return [line1, line2].filter(Boolean).join(" — ") || "Address on file";
}

function paymentLabel(booking) {
    const status = (booking.paymentStatus || "unpaid").toLowerCase();
    if (status === "paid") return "Paid";
    if (status === "partial") return "Partial";
    return "Unpaid";
}

// booking.price is always the tax-INCLUDED total. booking.subtotal/booking.tax
// are stored on the doc going forward but can be missing on older bookings —
// derive them from the branch tax rate so every row still adds up.
function getLineBreakdown(booking) {
    const total = parseFloat(booking.price || booking.totalAmount || 0);
    const taxRate = Number(booking.taxRate ?? 0.13);
    let subtotal = booking.subtotal != null ? parseFloat(booking.subtotal) : null;
    let tax = booking.tax != null ? parseFloat(booking.tax) : null;
    if (subtotal == null && tax == null) {
        subtotal = total / (1 + taxRate);
        tax = total - subtotal;
    } else if (subtotal == null) {
        subtotal = total - tax;
    } else if (tax == null) {
        tax = total - subtotal;
    }
    return { subtotal, tax, total };
}

function getLogoImageSource(logoBuffer) {
    if (!logoBuffer) return null;
    if (typeof logoBuffer === "string") return logoBuffer;
    return `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
}

// A completed-jobs-only statement for one customer: date, service, location,
// status, payment status, and a paid/unpaid summary — the "small report" a
// branch can hand a customer or file for their own records.
export async function buildCustomerReportPdf({ customer = {}, bookings = [], company = {} }, options = {}) {
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
        });
    };

    const footerReserve = 60;
    const pageBottom = pageHeight - footerReserve - 12;

    let pageNumber = 1;
    const addFooter = (num) => {
        const footerY = pageHeight - 48;
        doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(1).strokeColor(BORDER).stroke();
        addText(company.companyName || "SmarTouch Clean", margin, footerY + 8, { size: SIZE.small, color: SLATE, font: "Helvetica-Bold" });
        addText(`Generated ${formatZonedDate(new Date(), { year: "numeric", month: "long", day: "numeric" })}`, margin, footerY + 20, { size: SIZE.small - 0.5, color: SLATE });
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
    addText("CUSTOMER SERVICE REPORT", rightX, y + 2, {
        size: SIZE.title, color: NAVY, font: "Helvetica-Bold", width: contentWidth * 0.5, align: "right",
    });
    doc.moveTo(rightX + 60, y + 24).lineTo(pageWidth - margin, y + 24).lineWidth(1.5).strokeColor(GREEN).stroke();
    addText("Completed services only", rightX, y + 30, {
        size: SIZE.small, color: SLATE, width: contentWidth * 0.5, align: "right",
    });

    y = margin + logoSize + 16;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor(BORDER).stroke();
    y += 14;

    // ── Client card ──
    addText("CLIENT", margin, y, { size: SIZE.small, color: NAVY, font: "Helvetica-Bold" });
    addText(customer.name || "Customer", margin, y + 14, { size: SIZE.subhead + 2, font: "Helvetica-Bold" });
    addText(customer.phone || "", margin, y + 34, { size: SIZE.small, color: SLATE });
    addText(customer.email || "", margin, y + 46, { size: SIZE.small, color: SLATE });
    y += 62;

    // ── Summary band: completed count, paid total, unpaid total ──
    const paidTotal = bookings
        .filter((b) => (b.paymentStatus || "").toLowerCase() === "paid")
        .reduce((sum, b) => sum + parseFloat(b.price || b.totalAmount || 0), 0);
    const unpaidTotal = bookings
        .filter((b) => (b.paymentStatus || "").toLowerCase() !== "paid")
        .reduce((sum, b) => sum + Math.max(0, parseFloat(b.price || b.totalAmount || 0) - parseFloat(b.amountReceived || 0)), 0);

    const bannerHeight = 48;
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).fillColor(PALE).fill();
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).lineWidth(1).strokeColor(GREEN).stroke();
    const bannerColWidth = contentWidth / 3;
    const summaryCols = [
        ["COMPLETED SERVICES", String(bookings.length), NAVY],
        ["PAID TOTAL", formatMoney(paidTotal), GREEN],
        ["UNPAID TOTAL", formatMoney(unpaidTotal), unpaidTotal > 0 ? "#b3261e" : NAVY],
    ];
    summaryCols.forEach(([label, value, color], index) => {
        const colX = margin + 14 + (index * bannerColWidth);
        addText(label, colX, y + 9, { size: SIZE.small - 0.5, color: SLATE, font: "Helvetica-Bold" });
        addText(value, colX, y + 21, { size: SIZE.subhead + 3, color, font: "Helvetica-Bold", width: bannerColWidth - 20 });
    });
    y += bannerHeight + 16;

    // ── Table — compact, invoice-style: every row shows the pre-tax cost,
    // tax, and total so the customer sees exactly how tax was added rather
    // than a single number that reads as a surprise. ──
    const tableX = margin;
    const tableWidth = contentWidth;
    const cellPad = 6;
    const rowFont = SIZE.body - 0.5;   // 9pt
    const headFont = SIZE.small - 0.5; // 7.5pt
    const colWidths = [46, 110, 96, 50, 54, 48, tableWidth - 46 - 110 - 96 - 50 - 54 - 48];
    const MONEY_COL_START = 4; // SUBTOTAL, TAX, TOTAL are right-aligned
    const headerHeight = 18;
    const headers = ["DATE", "SERVICE", "LOCATION", "PAY", "SUBTOTAL", "TAX", "TOTAL"];

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

    addText("SERVICE HISTORY", margin, y, { size: SIZE.subhead, color: NAVY, font: "Helvetica-Bold" });
    y += 14;
    y = drawTableHeader(y);

    const sorted = [...bookings].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    if (sorted.length === 0) {
        doc.rect(tableX, y, tableWidth, 26).fillAndStroke("#ffffff", BORDER);
        addText("No completed services on file yet.", tableX + cellPad, y + 8, { size: rowFont, color: SLATE });
        y += 26;
    }

    sorted.forEach((booking) => {
        const dateText = formatDateShort(booking.date);
        const dateWidth = colWidths[0] - (cellPad * 2);
        const serviceWidth = colWidths[1] - (cellPad * 2);
        const serviceText = booking.service || "Service";
        const locationWidth = colWidths[2] - (cellPad * 2);
        const locationText = formatAddress(booking);
        const payLabel = paymentLabel(booking);
        const payWidth = colWidths[3] - (cellPad * 2);

        const measure = (text, width, font) => {
            doc.font(font).fontSize(rowFont);
            return doc.heightOfString(text, { width });
        };
        // Every column that can wrap gets measured — missing one here is
        // exactly what let earlier drafts silently clip or bleed into the
        // row below when a value didn't fit on a single line.
        const wrapHeight = Math.max(
            measure(dateText, dateWidth, "Helvetica"),
            measure(serviceText, serviceWidth, "Helvetica-Bold"),
            measure(locationText, locationWidth, "Helvetica"),
            measure(payLabel, payWidth, "Helvetica-Bold"),
        );
        const rowHeight = Math.max(20, wrapHeight + 10);

        if (y + rowHeight > pageBottom) {
            y = startPage();
            addText("SERVICE HISTORY — continued", margin, y, { size: headFont, color: SLATE, font: "Helvetica-Bold" });
            y += 14;
            y = drawTableHeader(y);
        }

        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#ffffff", BORDER);
        const { subtotal, tax, total } = getLineBreakdown(booking);
        const cellHeight = wrapHeight + 4;
        let cursorX = tableX;
        addText(dateText, cursorX + cellPad, y + 6, { size: rowFont, width: dateWidth, height: cellHeight, lineBreak: true });
        cursorX += colWidths[0];
        addText(serviceText, cursorX + cellPad, y + 6, { size: rowFont, font: "Helvetica-Bold", width: serviceWidth, height: cellHeight, lineBreak: true });
        cursorX += colWidths[1];
        addText(locationText, cursorX + cellPad, y + 6, { size: rowFont, color: SLATE, width: locationWidth, height: cellHeight, lineBreak: true });
        cursorX += colWidths[2];
        addText(payLabel, cursorX + cellPad, y + 6, {
            size: rowFont, font: "Helvetica-Bold", width: payWidth, height: cellHeight,
            color: payLabel === "Paid" ? GREEN : payLabel === "Partial" ? "#b45309" : "#b3261e",
            lineBreak: true,
        });
        cursorX += colWidths[3];
        addText(formatMoney(subtotal), cursorX + cellPad, y + 6, {
            size: rowFont, color: SLATE, width: colWidths[4] - (cellPad * 2), align: "right",
        });
        cursorX += colWidths[4];
        addText(formatMoney(tax), cursorX + cellPad, y + 6, {
            size: rowFont, color: SLATE, width: colWidths[5] - (cellPad * 2), align: "right",
        });
        cursorX += colWidths[5];
        addText(formatMoney(total), cursorX + cellPad, y + 6, {
            size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[6] - (cellPad * 2), align: "right",
        });

        y += rowHeight;
    });

    // ── Grand totals — subtotal / tax / total across every row shown above ──
    const grandSubtotal = bookings.reduce((sum, b) => sum + getLineBreakdown(b).subtotal, 0);
    const grandTax = bookings.reduce((sum, b) => sum + getLineBreakdown(b).tax, 0);
    const grandTotal = bookings.reduce((sum, b) => sum + getLineBreakdown(b).total, 0);
    const totalsRowHeight = 20;
    if (y + totalsRowHeight > pageBottom) {
        y = startPage();
        y = drawTableHeader(y);
    }
    doc.rect(tableX, y, tableWidth, totalsRowHeight).fillAndStroke(PALE, BORDER);
    addText("TOTAL", tableX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - cellPad });
    let totalsCursorX = tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    addText(formatMoney(grandSubtotal), totalsCursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[4] - (cellPad * 2), align: "right" });
    totalsCursorX += colWidths[4];
    addText(formatMoney(grandTax), totalsCursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[5] - (cellPad * 2), align: "right" });
    totalsCursorX += colWidths[5];
    addText(formatMoney(grandTotal), totalsCursorX + cellPad, y + 6, { size: rowFont, color: NAVY, font: "Helvetica-Bold", width: colWidths[6] - (cellPad * 2), align: "right" });
    y += totalsRowHeight;

    addFooter(pageNumber);
    doc.end();
    return pdfBuffer;
}
