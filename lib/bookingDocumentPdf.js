import PDFDocument from "pdfkit";
import { getBookingDocumentLabel, getBookingDocumentNumber } from "./bookingDocuments";
import { generateReferralCode } from "./promotions";

function formatDate(value) {
    if (!value) return "TBD";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function getValidUntilDate(value) {
    if (!value) return "";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    parsed.setDate(parsed.getDate() + 30);
    return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getPdfContext(booking = {}) {
    const company = booking.companySnapshot || {};
    const documentLabel = getBookingDocumentLabel(booking);
    const documentNumber = getBookingDocumentNumber(booking);
    const clientName = booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";
    const clientDisplay = clientName.split(" ").filter(Boolean)[0] || clientName;
    const addressLine1 = [booking.address1, booking.address2].filter(Boolean).join(", ");
    const addressLine2 = [booking.city, booking.state, booking.postalCode].filter(Boolean).join(", ");
    const subtotal = Number(booking.subtotal || booking.price || 0);
    const tax = Number(booking.tax || 0);
    const total = Number(booking.price || 0);
    const validUntil = getValidUntilDate(booking.date);
    const taxRatePercent = Math.round(Number(booking.taxRate || company.taxRate || 0.13) * 100);
    const branchPhone = company.branchPhone || "613-416-5001";
    const branchEmail = company.branchEmail || "info@smartouchclean.com";
    const website = company.website || "www.smartouchclean.com";
    const businessNumber = company.businessNumber || "723469631RC0001";
    const noteText = booking.note || "Thank you for considering SmarTouch Clean. We look forward to providing you with exceptional service.";
    const referralCode = booking.referralCode || generateReferralCode(booking.phone, documentNumber, clientName);
    const items = Array.isArray(booking.cartItems) && booking.cartItems.length
        ? booking.cartItems
        : [
            {
                name: booking.service || "Cleaning Service",
                optionName: booking.frequency || "One-Time",
                bathroomKey: booking.duration ? `${booking.duration} Hours` : "",
                price: subtotal
            }
        ];

    return {
        company,
        documentLabel,
        documentNumber,
        clientDisplay,
        addressLine1,
        addressLine2,
        subtotal,
        tax,
        total,
        validUntil,
        taxRatePercent,
        branchPhone,
        branchEmail,
        website,
        businessNumber,
        noteText,
        referralCode,
        items
    };
}

export async function buildBookingDocumentPdf(booking = {}, options = {}) {
    const context = getPdfContext(booking);
    const doc = new PDFDocument({
        size: "A4",
        margin: 36
    });
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
    const navy = "#062b63";
    const green = "#5ba531";
    const slate = "#41546f";
    const border = "#d8dde4";
    const pale = "#eef7e9";

    const addText = (text, x, y, opts = {}) => {
        doc.fillColor(opts.color || "#071b3a");
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || 11);
        doc.text(String(text || ""), x, y, {
            width: opts.width,
            align: opts.align,
            lineGap: opts.lineGap
        });
    };

    let y = margin;

    try {
        if (options.logoBuffer) {
            doc.image(options.logoBuffer, margin, y, { fit: [260, 110] });
        }
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", margin, y + 10, {
            size: 24,
            color: navy,
            font: "Helvetica-Bold"
        });
    }

    addText(context.company.branchName || booking.branchName || "Ottawa", margin, y + 112, { size: 12 });
    addText(context.branchEmail, margin, y + 132, { size: 12 });

    const rightX = margin + (contentWidth * 0.62);
    addText(context.documentLabel.toUpperCase(), rightX, y + 4, {
        size: 24,
        color: navy,
        font: "Helvetica-Bold",
        width: contentWidth * 0.38,
        align: "right"
    });
    doc.moveTo(rightX + 60, y + 38).lineTo(pageWidth - margin, y + 38).lineWidth(2).strokeColor(green).stroke();

    const detailX = rightX;
    const detailY = y + 58;
    const detailLabelWidth = 92;
    const detailValueX = detailX + detailLabelWidth + 10;
    const detailRows = [
        [`${context.documentLabel} #:`, context.documentNumber, navy],
        ["Date:", formatDate(booking.date), "#071b3a"],
        ["Status:", booking.status || "Pending", green],
        ["Payment:", (booking.paymentStatus || "unpaid").replace(/^./, (match) => match.toUpperCase()), "#071b3a"],
        ["Valid Until:", context.validUntil ? `${context.validUntil} (30 Days)` : "30 Days from issue", "#071b3a"]
    ];

    detailRows.forEach(([label, value, color], index) => {
        const rowY = detailY + (index * 20);
        addText(label, detailX, rowY, { size: 12, font: "Helvetica-Bold", width: detailLabelWidth });
        addText(value, detailValueX, rowY, { size: 12, color, width: contentWidth * 0.34 });
    });

    y = 208;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor(border).stroke();
    y += 18;

    const cardTop = y;
    const leftCardWidth = (contentWidth - 24) / 2;
    const rightCardX = margin + leftCardWidth + 24;

    doc.circle(margin + 22, cardTop + 18, 18).lineWidth(1).strokeColor(navy).stroke();
    addText("CLIENT", margin + 52, cardTop + 4, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.clientDisplay, margin + 52, cardTop + 24, { size: 20, font: "Helvetica-Bold" });
    addText(booking.phone || "", margin + 52, cardTop + 56, { size: 12, color: slate, width: leftCardWidth - 52 });
    addText(booking.email || "", margin + 52, cardTop + 74, { size: 12, color: slate, width: leftCardWidth - 52 });

    doc.moveTo(margin + leftCardWidth + 12, cardTop).lineTo(margin + leftCardWidth + 12, cardTop + 100).lineWidth(1).strokeColor(border).stroke();

    doc.circle(rightCardX + 22, cardTop + 18, 18).lineWidth(1).strokeColor(navy).stroke();
    addText("SERVICE ADDRESS", rightCardX + 52, cardTop + 4, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.addressLine1 || booking.address1 || "Address Pending", rightCardX + 52, cardTop + 24, {
        size: 18,
        font: "Helvetica-Bold",
        width: leftCardWidth - 52
    });
    addText(context.addressLine2 || "Ottawa, ON", rightCardX + 52, cardTop + 60, {
        size: 12,
        color: slate,
        width: leftCardWidth - 52
    });

    y = cardTop + 122;
    addText("SERVICES", margin, y, { size: 14, color: navy, font: "Helvetica-Bold" });
    y += 16;

    const tableX = margin;
    const tableWidth = contentWidth;
    const colWidths = [44, 220, 170, tableWidth - 44 - 220 - 170];
    const headerHeight = 28;
    doc.roundedRect(tableX, y, tableWidth, headerHeight, 8).fillColor(navy).fill();

    const headers = ["#", "DESCRIPTION", "DETAILS", "AMOUNT"];
    let cursorX = tableX;
    headers.forEach((header, index) => {
        addText(header, cursorX + 8, y + 8, {
            size: 10,
            color: "#ffffff",
            font: "Helvetica-Bold",
            width: colWidths[index] - 16,
            align: index === 3 ? "right" : "left"
        });
        cursorX += colWidths[index];
    });

    y += headerHeight;
    context.items.forEach((item, index) => {
        const detailBase = [item.optionName, item.bathroomKey].filter(Boolean).join(" • ") || "Included";
        const included = Number(item.price || 0) <= 0;
        const amountLabel = included ? "Included" : formatMoney(item.price || 0);
        const rowHeight = 38;
        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#ffffff", border);
        cursorX = tableX;
        const cells = [
            String(index + 1).padStart(2, "0"),
            item.name || "Service",
            detailBase,
            amountLabel
        ];

        cells.forEach((cell, cellIndex) => {
            addText(cell, cursorX + 8, y + 11, {
                size: 10.5,
                color: cellIndex === 3 && included ? green : cellIndex === 3 ? navy : "#071b3a",
                font: cellIndex === 1 || cellIndex === 3 ? "Helvetica-Bold" : "Helvetica",
                width: colWidths[cellIndex] - 16,
                align: cellIndex === 0 ? "center" : cellIndex === 3 ? "right" : "left"
            });
            cursorX += colWidths[cellIndex];
        });

        y += rowHeight;
    });

    y += 16;
    const promoWidth = 220;
    const totalBoxWidth = 280;
    doc.roundedRect(margin, y, promoWidth, 70, 10).fillColor(pale).fill();
    doc.circle(margin + 28, y + 34, 18).lineWidth(1).strokeColor(green).stroke();
    addText("REFER & SAVE", margin + 54, y + 16, { size: 12, color: green, font: "Helvetica-Bold" });
    addText("Refer a friend and you both get $30 OFF your next cleaning service.", margin + 54, y + 22, {
        size: 10.5,
        color: "#2f3f58",
        width: promoWidth - 68,
        lineGap: 2
    });
    addText(context.referralCode, margin + 54, y + 50, {
        size: 11,
        color: green,
        font: "Helvetica-Bold",
        width: promoWidth - 68
    });

    const totalsX = pageWidth - margin - totalBoxWidth;
    addText("Subtotal", totalsX, y + 2, { size: 12, width: 120 });
    addText(formatMoney(context.subtotal), totalsX + 160, y + 2, { size: 12, font: "Helvetica-Bold", width: 120, align: "right" });
    addText(`${context.company.taxLabel || booking.taxLabel || "HST"} (${context.taxRatePercent}%)`, totalsX, y + 24, { size: 12, width: 140 });
    addText(formatMoney(context.tax), totalsX + 160, y + 24, { size: 12, font: "Helvetica-Bold", width: 120, align: "right" });
    doc.roundedRect(totalsX, y + 48, totalBoxWidth, 44, 6).fillColor(navy).fill();
    addText("TOTAL", totalsX + 16, y + 62, { size: 18, color: "#ffffff", font: "Helvetica-Bold" });
    addText(formatMoney(context.total), totalsX + 160, y + 62, {
        size: 22,
        color: "#ffffff",
        font: "Helvetica-Bold",
        width: 104,
        align: "right"
    });

    y += 118;
    const columnGap = 30;
    const columnWidth = (contentWidth - columnGap) / 2;
    addText("TERMS & CONDITIONS", margin, y, { size: 12, color: navy, font: "Helvetica-Bold" });
    const termsY = y + 20;
    const terms = [
        `This ${context.documentLabel.toLowerCase()} is valid for 30 days from the date above.`,
        `Services will be scheduled upon acceptance of this ${context.documentLabel.toLowerCase()}.`,
        "Payment is due upon completion of the service.",
        "Cancellations must be made at least 24 hours in advance.",
        "Prices do not include tips or gratuities.",
        "We are not responsible for pre-existing damage or issues beyond our control."
    ];

    let bulletY = termsY;
    terms.forEach((term) => {
        addText("•", margin, bulletY, { size: 12, color: green, width: 10 });
        addText(term, margin + 14, bulletY, { size: 10.5, color: "#2f3f58", width: columnWidth - 14, lineGap: 2 });
        bulletY += 18;
    });

    const noteX = margin + columnWidth + columnGap;
    addText("NOTE", noteX, y, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.noteText, noteX, termsY, {
        size: 10.5,
        color: "#2f3f58",
        width: columnWidth,
        lineGap: 3
    });
    if (booking.customerPortalUrl) {
        const portalY = termsY + 60;
        doc.roundedRect(noteX, portalY, columnWidth, 34, 8).fillColor("#f8fbff").fill();
        addText("Customer Login / Sign Up", noteX + 12, portalY + 11, {
            size: 11,
            color: navy,
            font: "Helvetica-Bold",
            width: columnWidth - 24
        });
        doc.link(noteX, portalY, columnWidth, 34, booking.customerPortalUrl);
        doc.underline(noteX + 12, portalY + 24, 152, 0.5, { color: navy });
    }
    doc.moveTo(noteX, termsY + 106).lineTo(noteX + columnWidth, termsY + 106).lineWidth(1).strokeColor("#5c6670").stroke();
    addText("Client Signature                                Date", noteX, termsY + 112, { size: 9.5, color: slate });

    const footerY = pageHeight - 92;
    doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(2).strokeColor(green).stroke();
    addText(`☎ ${context.branchPhone}`, margin, footerY + 14, { size: 10.5, color: slate });
    addText(`✉ ${context.branchEmail}`, margin, footerY + 30, { size: 10.5, color: slate });
    addText(`🌐 ${context.website}`, margin, footerY + 46, { size: 10.5, color: slate });
    addText(context.company.companyName || "SmarTouch Clean", margin + 220, footerY + 14, {
        size: 11,
        color: navy,
        font: "Helvetica-Bold",
        width: 150,
        align: "center"
    });
    addText("Professional Residential & Commercial Cleaning Services", margin + 210, footerY + 30, {
        size: 9.5,
        color: slate,
        width: 170,
        align: "center"
    });
    addText("Fully Insured • Quality Guaranteed", margin + 220, footerY + 46, {
        size: 9.5,
        color: green,
        font: "Helvetica-Bold",
        width: 150,
        align: "center"
    });
    addText("Business Number (HST):", pageWidth - margin - 170, footerY + 16, {
        size: 10,
        color: green,
        width: 170,
        align: "right"
    });
    addText(context.businessNumber, pageWidth - margin - 170, footerY + 34, {
        size: 14,
        color: "#071b3a",
        font: "Helvetica-Bold",
        width: 170,
        align: "right"
    });

    doc.end();
    return pdfBuffer;
}
