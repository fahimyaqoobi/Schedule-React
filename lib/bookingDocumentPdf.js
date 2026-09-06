import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { getBookingDocumentContext, formatDate, formatMoney, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "./bookingDocuments";
import { getDocumentTerms } from "./documentCopy";

// Minimal, plain-document PDF — mirrors buildBookingDocumentHtml exactly
// (same rows, same section order, same copy) so the on-screen preview and
// the actual downloaded/emailed PDF are never two different-looking
// documents. Thin rules instead of boxes/fills, plain label/value pairs,
// one flat line-items table — modelled on a clean, single-page invoice.
const SIZE = {
    title: 24,
    label: 9,
    body: 10,
    small: 8.5,
    callout: 15,
    total: 11
};

function getLogoImageSource(logoBuffer) {
    if (!logoBuffer) return null;
    if (typeof logoBuffer === "string") return logoBuffer;
    return `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
}

export async function buildBookingDocumentPdf(booking = {}, options = {}) {
    const context = getBookingDocumentContext(booking, options);
    const logoImageSource = getLogoImageSource(options.logoBuffer);
    const doc = new PDFDocument({ size: "A4", margin: 43 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const pdfBuffer = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 43;
    const contentWidth = pageWidth - (margin * 2);
    const navy = "#0b2f5e";
    const ink = "#1a2942";
    const slate = "#5a6b81";
    const faint = "#8a94a3";
    const rule = "#dde3ea";

    const isMoneyDoc = context.documentLabel === "Invoice" || context.documentLabel === "Receipt";
    // "Amount due" implies a fixed, payable-now obligation — correct for an
    // Invoice, but wrong for an Estimate/Booking: showTaxAmount is false for
    // both (see the "* HST added at time of invoicing" line above), so the
    // figure here doesn't even include tax yet and nothing is actually owed
    // at this stage.
    const totalLabel = context.documentLabel === "Receipt"
        ? "Amount paid"
        : context.documentLabel === "Estimate"
            ? "Estimated Total"
            : context.documentLabel === "Booking"
                ? "Booking Total"
                : "Amount due";
    const calloutLine = context.documentLabel === "Invoice"
        ? `${formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts)} due ${context.paymentDue}`
        : context.documentLabel === "Receipt"
            ? `${formatMoney(context.pricing.total)} paid in full`
            : context.documentLabel === "Estimate"
                ? `Estimated total: ${formatMoney(context.pricing.subtotalAfterDiscounts)}`
                : `Total: ${formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts)}`;
    const metaRows = context.documentLabel === "Estimate"
        ? [[`${context.documentLabel} number`, context.documentNumber], ["Date of issue", context.issueDate], ["Valid until", context.validUntil]]
        : context.documentLabel === "Invoice"
            ? [[`${context.documentLabel} number`, context.documentNumber], ["Date of issue", context.issueDate], ["Date due", context.paymentDue]]
            : context.documentLabel === "Receipt"
                ? [[`${context.documentLabel} number`, context.documentNumber], ["Date of issue", context.issueDate], ["Payment received", formatDate(booking.date)]]
                : [[`${context.documentLabel} number`, context.documentNumber], ["Date of issue", context.issueDate], ["Service date", formatDate(booking.date)]];

    const addText = (text, x, y, opts = {}) => {
        doc.fillColor(opts.color || ink);
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || SIZE.body);
        doc.text(String(text ?? ""), x, y, {
            width: opts.width,
            align: opts.align,
            lineGap: opts.lineGap,
            lineBreak: opts.lineBreak ?? false
        });
    };
    const measureHeight = (text, opts = {}) => {
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || SIZE.body);
        return doc.heightOfString(String(text ?? ""), { width: opts.width, lineGap: opts.lineGap || 0 });
    };

    const footerReserve = 40;
    const pageBottom = pageHeight - footerReserve - margin;
    let pageNumber = 1;

    const addFooter = () => {
        const footerY = pageHeight - margin - 14;
        doc.moveTo(margin, footerY - 10).lineTo(pageWidth - margin, footerY - 10).lineWidth(1).strokeColor(rule).stroke();
        addText(`${context.branchPhone}  |  ${context.branchEmail}  |  ${context.website}`, margin, footerY, {
            size: SIZE.small, color: slate, width: contentWidth, align: "center"
        });
        addText(`Page ${pageNumber}`, pageWidth - margin - 80, footerY, {
            size: SIZE.small - 0.5, color: faint, width: 80, align: "right"
        });
    };

    const startPage = () => {
        addFooter();
        doc.addPage({ size: "A4", margin });
        pageNumber += 1;
        doc.rect(0, 0, pageWidth, 6).fillColor(navy).fill();
        return margin + 16;
    };

    let y = margin;

    // ── Accent bar + header: doc title left, logo right ──
    doc.rect(0, 0, pageWidth, 6).fillColor(navy).fill();
    y += 22;
    addText(context.documentLabel, margin, y, { size: SIZE.title, color: ink, font: "Helvetica-Bold" });
    try {
        if (!logoImageSource) throw new Error("no-logo");
        doc.image(logoImageSource, pageWidth - margin - 70, y - 4, { fit: [70, 40] });
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", pageWidth - margin - 180, y + 4, {
            size: SIZE.body, color: navy, font: "Helvetica-Bold", width: 180, align: "right"
        });
    }
    y += 40;

    // ── Meta rows (Number / Issue date / Valid-until|Due|Service date) ──
    metaRows.forEach(([label, value]) => {
        addText(label, margin, y, { size: SIZE.small, font: "Helvetica-Bold", width: 130 });
        addText(value, margin + 130, y, { size: SIZE.small, color: ink, width: 200 });
        y += 14;
    });
    y += 14;

    // ── Two columns: company info | bill to ──
    const colGap = 30;
    const colWidth = (contentWidth - colGap) / 2;
    const col2X = margin + colWidth + colGap;
    const colTop = y;
    addText(context.company.companyName || "SmarTouch Clean", margin, colTop, { size: SIZE.small, font: "Helvetica-Bold", width: colWidth });
    addText(context.company.branchAddress || "214 Viewmount Drive, Nepean, Ontario K2E 7X2", margin, colTop + 14, { size: SIZE.small, color: slate, width: colWidth });
    addText("Canada", margin, colTop + 27, { size: SIZE.small, color: slate, width: colWidth });
    addText(context.branchPhone, margin, colTop + 40, { size: SIZE.small, color: slate, width: colWidth });
    let leftY = colTop + 53;
    if (isMoneyDoc) {
        addText(`CA GST/HST ${context.businessNumber}`, margin, leftY, { size: SIZE.small, color: slate, width: colWidth });
        leftY += 13;
    }

    addText("Bill to", col2X, colTop, { size: SIZE.small, font: "Helvetica-Bold", width: colWidth });
    addText(context.clientName, col2X, colTop + 14, { size: SIZE.small, color: ink, width: colWidth });
    addText(context.billingAddress.line1 || "Address Pending", col2X, colTop + 27, { size: SIZE.small, color: slate, width: colWidth });
    addText(context.billingAddress.line2, col2X, colTop + 40, { size: SIZE.small, color: slate, width: colWidth });
    addText(booking.phone || "", col2X, colTop + 53, { size: SIZE.small, color: slate, width: colWidth });
    addText(booking.email || "", col2X, colTop + 66, { size: SIZE.small, color: slate, width: colWidth });

    y = Math.max(leftY, colTop + 79) + 12;

    // ── Service line: address (only if it differs from billing) + date/time/frequency ──
    const serviceLineText = !context.billingAddress.sameAsService
        ? `Service address: ${context.serviceAddress.line1 || "Address Pending"}, ${context.serviceAddress.line2}  ·  ${formatDate(booking.date)}${booking.time ? `, ${booking.time}` : ""}${context.shiftText ? ` (${context.shiftText})` : ""}  ·  ${context.frequencyText}`
        : `Service date: ${formatDate(booking.date)}${booking.time ? `, ${booking.time}` : ""}${context.shiftText ? ` (${context.shiftText})` : ""}  ·  ${context.frequencyText}`;
    const serviceLineHeight = measureHeight(serviceLineText, { size: SIZE.small, width: contentWidth });
    addText(serviceLineText, margin, y, { size: SIZE.small, color: slate, width: contentWidth, lineBreak: true, lineGap: 2 });
    y += serviceLineHeight + 16;

    // ── Bold callout line ──
    addText(calloutLine, margin, y, { size: SIZE.callout, color: ink, font: "Helvetica-Bold", width: contentWidth });
    y += 24;

    // ── Payment methods (Invoice/Receipt only) ──
    if (isMoneyDoc) {
        addText("PAYMENT METHOD:", margin, y, { size: SIZE.small, font: "Helvetica-Bold" });
        y += 13;
        addText(`E-transfer: ${context.branchEmail}`, margin, y, { size: SIZE.small, color: ink }); y += 13;
        addText("Bank transfer: Request banking instructions by email.", margin, y, { size: SIZE.small, color: ink }); y += 13;
        addText("Credit card: Request a secure payment link by email.", margin, y, { size: SIZE.small, color: ink }); y += 13;
        addText("Please do not send credit card details by email.", margin, y, { size: SIZE.small - 0.5, color: faint }); y += 20;
    } else {
        y += 8;
    }

    // ── Line items table — plain rows, one rule under the header ──
    const colDesc = contentWidth - 260;
    const colQty = 40;
    const colUnit = 75;
    const colTax = 45;
    const colAmt = 100;
    const rightEdge = margin + contentWidth;

    const drawTableHeader = (headerY) => {
        addText("Description", margin, headerY, { size: SIZE.small, color: slate, font: "Helvetica-Bold", width: colDesc });
        addText("Qty", rightEdge - colAmt - colTax - colUnit - colQty, headerY, { size: SIZE.small, color: slate, font: "Helvetica-Bold", width: colQty, align: "right" });
        addText("Unit price", rightEdge - colAmt - colTax - colUnit, headerY, { size: SIZE.small, color: slate, font: "Helvetica-Bold", width: colUnit, align: "right" });
        addText("Tax", rightEdge - colAmt - colTax, headerY, { size: SIZE.small, color: slate, font: "Helvetica-Bold", width: colTax, align: "right" });
        addText("Amount", rightEdge - colAmt, headerY, { size: SIZE.small, color: slate, font: "Helvetica-Bold", width: colAmt, align: "right" });
        const ruleY = headerY + 15;
        doc.moveTo(margin, ruleY).lineTo(rightEdge, ruleY).lineWidth(1).strokeColor(rule).stroke();
        return ruleY + 8;
    };

    y = drawTableHeader(y);

    context.lineItems.forEach((row) => {
        const descHeight = measureHeight(row.description, { width: colDesc });
        const rowHeight = Math.max(descHeight, 12) + 12;
        if (y + rowHeight > pageBottom) {
            y = startPage();
            y = drawTableHeader(y);
        }
        addText(row.description, margin, y, { size: SIZE.body, color: ink, width: colDesc, lineBreak: true });
        addText(String(row.qty), rightEdge - colAmt - colTax - colUnit - colQty, y, { size: SIZE.body, color: ink, width: colQty, align: "right" });
        addText(formatMoney(row.unitPrice), rightEdge - colAmt - colTax - colUnit, y, { size: SIZE.body, color: ink, width: colUnit, align: "right" });
        addText(`${row.taxPercent}%`, rightEdge - colAmt - colTax, y, { size: SIZE.body, color: ink, width: colTax, align: "right" });
        addText(formatMoney(row.amount), rightEdge - colAmt, y, { size: SIZE.body, color: ink, width: colAmt, align: "right" });
        const ruleY = y + rowHeight - 6;
        doc.moveTo(margin, ruleY).lineTo(rightEdge, ruleY).lineWidth(0.5).strokeColor("#eef1f5").stroke();
        y += rowHeight;
    });
    y += 8;

    // ── Totals — plain right-aligned label/value rows ──
    const totalsWidth = 260;
    const totalsX = rightEdge - totalsWidth;
    const totalLineLabelWidth = totalsWidth - 100;
    const totalLines = [
        ["Subtotal", formatMoney(context.pricing.subtotal)],
        ...(context.pricing.fixedDiscount > 0 ? [["Discount (fixed)", `-${formatMoney(context.pricing.fixedDiscount)}`]] : []),
        ...(context.pricing.percentDiscountValue > 0 ? [["Discount (%)", `-${formatMoney(context.pricing.percentDiscountValue)}`]] : []),
        ...(context.pricing.promoCode && context.pricing.promoDiscount > 0
            ? [[`${context.pricing.promoName || "Promo"} (${context.pricing.promoCode})`, `-${formatMoney(context.pricing.promoDiscount)}`]]
            : []),
        ["Total excluding tax", formatMoney(context.pricing.subtotalAfterDiscounts)],
        ...(context.pricing.showTaxAmount
            ? [[`${context.pricing.taxLabel} (${context.pricing.taxRatePercent}% on ${formatMoney(context.pricing.subtotalAfterDiscounts)})`, formatMoney(context.pricing.taxAmount)],
                ["Total", formatMoney(context.pricing.total)]]
            : [])
    ];
    const neededHeight = (totalLines.length * 15) + 40;
    if (y + neededHeight > pageBottom) {
        y = startPage();
    }
    totalLines.forEach(([label, value]) => {
        addText(label, totalsX, y, { size: SIZE.small + 0.5, font: "Helvetica", color: ink, width: totalLineLabelWidth });
        addText(value, totalsX + totalLineLabelWidth, y, { size: SIZE.small + 0.5, font: "Helvetica", color: ink, width: 100, align: "right" });
        y += 15;
    });
    if (!context.pricing.showTaxAmount) {
        addText(`* ${context.pricing.taxLabel} (${context.pricing.taxRatePercent}%) added at time of invoicing`, totalsX, y, {
            size: SIZE.small - 1, color: faint, font: "Helvetica-Oblique", width: totalsWidth
        });
        y += 15;
    }
    doc.moveTo(totalsX, y + 2).lineTo(rightEdge, y + 2).lineWidth(1).strokeColor(rule).stroke();
    y += 10;
    addText(totalLabel, totalsX, y, { size: SIZE.total, font: "Helvetica-Bold", color: ink, width: totalLineLabelWidth });
    addText(formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts), totalsX + totalLineLabelWidth, y, {
        size: SIZE.total, font: "Helvetica-Bold", color: ink, width: 100, align: "right"
    });
    y += 30;

    // ── Notes + condensed terms ──
    if (y + 60 > pageBottom) {
        y = startPage();
    }
    const notesHeight = measureHeight(context.noteText, { width: contentWidth, size: SIZE.small });
    addText(`${context.documentCopy.notesTitle}:`, margin, y, { size: SIZE.small, font: "Helvetica-Bold", color: slate, width: 80 });
    addText(context.noteText, margin + 80, y, { size: SIZE.small, color: slate, width: contentWidth - 80, lineBreak: true, lineGap: 1 });
    y += Math.max(notesHeight, 11) + 10;

    const termsText = getDocumentTerms(context.documentCopy, context.documentLabel).join("   ·   ");
    const termsHeight = measureHeight(termsText, { width: contentWidth, size: SIZE.small - 1.5 });
    if (y + termsHeight > pageBottom) {
        y = startPage();
    }
    addText(termsText, margin, y, {
        size: SIZE.small - 1.5, color: faint, width: contentWidth, lineBreak: true, lineGap: 2, align: "justify"
    });
    y += termsHeight + 10;

    // ── Privacy Policy / Terms of Service — accepting the document and
    // getting the service means accepting both. pdfkit has no inline-link
    // markup, so this line is built as separate text segments positioned
    // left-to-right (measuring each segment's own width first), with a
    // real clickable doc.link() rectangle laid over just the two link
    // segments — the rest of the sentence stays plain, non-clickable text.
    if (y + 16 > pageBottom) {
        y = startPage();
    }
    const legalSize = SIZE.small - 1.5;
    doc.font("Helvetica").fontSize(legalSize);
    const legalSegments = [
        { text: `By accepting this ${context.documentLabel.toLowerCase()} and receiving the service, you agree to our `, color: faint },
        { text: "Privacy Policy", color: navy, url: PRIVACY_POLICY_URL },
        { text: " and ", color: faint },
        { text: "Terms of Service", color: navy, url: TERMS_OF_SERVICE_URL },
        { text: ".", color: faint }
    ];
    let legalX = margin;
    legalSegments.forEach((segment) => {
        const segmentWidth = doc.widthOfString(segment.text);
        addText(segment.text, legalX, y, { size: legalSize, color: segment.color, width: segmentWidth + 2, lineBreak: false });
        if (segment.url) {
            doc.link(legalX, y - 1, segmentWidth, legalSize + 4, segment.url);
        }
        legalX += segmentWidth;
    });
    y += 20;

    // ── Signature (Estimate only) ──
    if (context.documentLabel === "Estimate") {
        if (y + 40 > pageBottom) {
            y = startPage();
        }
        doc.moveTo(margin, y).lineTo(margin + 200, y).lineWidth(1).strokeColor(faint).stroke();
        doc.moveTo(margin + 260, y).lineTo(margin + 400, y).lineWidth(1).strokeColor(faint).stroke();
        addText("Client Signature", margin, y + 5, { size: SIZE.small - 1, color: slate, width: 160 });
        addText("Date", margin + 260, y + 5, { size: SIZE.small - 1, color: slate, width: 100 });
    }

    addFooter();
    doc.end();
    return pdfBuffer;
}
