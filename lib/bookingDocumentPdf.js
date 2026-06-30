import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { buildDocumentPricingBreakdown, getBookingDocumentLabel, getBookingDocumentNumber } from "./bookingDocuments";
import { generateReferralCode, getDocumentPromotions } from "./promotions";
import { getDocumentTerms, normalizeDocumentCopy } from "./documentCopy";

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

function getLogoImageSource(logoBuffer) {
    if (!logoBuffer) return null;
    if (typeof logoBuffer === "string") return logoBuffer;
    return `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
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
    const total = Number(booking.price || 0);
    const validUntil = getValidUntilDate(booking.date);
    const taxRatePercent = Math.round(Number(booking.taxRate || company.taxRate || 0.13) * 100);
    const branchPhone = company.branchPhone || "613-416-5001";
    const branchEmail = company.branchEmail || "info@smartouchclean.com";
    const website = company.website || "www.smartouchclean.com";
    const businessNumber = company.businessNumber || "723469631RC0001";
    const documentCopy = normalizeDocumentCopy(company.documentCopy || booking.documentCopy);
    const noteText = booking.note || documentCopy.notesBody;
    const referralCode = booking.referralCode || generateReferralCode(booking.phone, documentNumber, clientName);
    const pricing = buildDocumentPricingBreakdown(booking, company);
    const documentPromotions = getDocumentPromotions(company.promotions ?? booking.promotions ?? []);
    const serviceNotes = pricing.services
        .map((service) => ({
            name: service.name,
            note: service.serviceNote || documentCopy.serviceNotesBody
        }))
        .filter((service) => service.name || service.note);

    return {
        company,
        documentLabel,
        documentNumber,
        clientDisplay,
        addressLine1,
        addressLine2,
        subtotal,
        total,
        validUntil,
        taxRatePercent,
        branchPhone,
        branchEmail,
        website,
        businessNumber,
        documentCopy,
        noteText,
        referralCode,
        pricing,
        documentPromotions,
        serviceNotes
    };
}

export async function buildBookingDocumentPdf(booking = {}, options = {}) {
    const context = getPdfContext(booking);
    const logoImageSource = getLogoImageSource(options.logoBuffer);
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
            height: opts.height || 34,
            align: opts.align,
            lineGap: opts.lineGap,
            lineBreak: opts.lineBreak ?? false
        });
    };

    let y = margin;

    try {
        if (logoImageSource) {
            doc.image(logoImageSource, margin, y, { fit: [128, 128] });
        }
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", margin, y + 10, {
            size: 24,
            color: navy,
            font: "Helvetica-Bold"
        });
    }

    addText(context.company.branchName || booking.branchName || "Ottawa", margin, y + 136, { size: 12 });
    addText(context.branchEmail, margin, y + 154, { size: 12 });

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

    addText("CLIENT", margin, cardTop, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.clientDisplay, margin, cardTop + 20, { size: 20, font: "Helvetica-Bold" });
    addText(booking.phone || "", margin, cardTop + 48, { size: 12, color: slate, width: leftCardWidth - 12 });
    addText(booking.email || "", margin, cardTop + 64, { size: 12, color: slate, width: leftCardWidth - 12 });

    doc.moveTo(margin + leftCardWidth + 12, cardTop).lineTo(margin + leftCardWidth + 12, cardTop + 82).lineWidth(1).strokeColor(border).stroke();

    addText("SERVICE ADDRESS", rightCardX, cardTop, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.addressLine1 || booking.address1 || "Address Pending", rightCardX, cardTop + 20, {
        size: 18,
        font: "Helvetica-Bold",
        width: leftCardWidth
    });
    addText(context.addressLine2 || "Ottawa, ON", rightCardX, cardTop + 56, {
        size: 12,
        color: slate,
        width: leftCardWidth
    });

    y = cardTop + 98;
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
    context.pricing.services.forEach((item) => {
        const rowHeight = 56 + (item.addonLines.length * 16);
        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#ffffff", border);
        cursorX = tableX;
        const cells = [
            String(item.index).padStart(2, "0"),
            item.name || "Service",
            item.details || "Included",
            formatMoney(item.total)
        ];

        cells.forEach((cell, cellIndex) => {
            addText(cell, cursorX + 8, y + 11, {
                size: 10.5,
                color: cellIndex === 3 ? navy : "#071b3a",
                font: cellIndex === 1 || cellIndex === 3 ? "Helvetica-Bold" : "Helvetica",
                width: colWidths[cellIndex] - 16,
                align: cellIndex === 0 ? "center" : cellIndex === 3 ? "right" : "left"
            });
            cursorX += colWidths[cellIndex];
        });

        addText("Base service price", tableX + colWidths[0] + 8, y + 28, {
            size: 9.5,
            color: slate,
            width: colWidths[1] + colWidths[2] - 16
        });
        addText(formatMoney(item.baseAmount), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, y + 28, {
            size: 9.5,
            color: navy,
            font: "Helvetica-Bold",
            width: colWidths[3] - 16,
            align: "right"
        });

        item.addonLines.forEach((addon, addonIndex) => {
            const addonY = y + 42 + (addonIndex * 16);
            const addonLabel = addon.qty > 1
                ? `Add-on: ${addon.name} (${addon.qty} × ${formatMoney(addon.unitPrice)})`
                : `Add-on: ${addon.name}`;
            addText(addonLabel, tableX + colWidths[0] + 8, addonY, {
                size: 9,
                color: slate,
                width: colWidths[1] + colWidths[2] - 16
            });
            addText(formatMoney(addon.total), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, addonY, {
                size: 9,
                color: navy,
                font: "Helvetica-Bold",
                width: colWidths[3] - 16,
                align: "right"
            });
        });

        y += rowHeight;
    });

    y += 18;
    const totalBoxWidth = 320;
    const totalsX = pageWidth - margin - totalBoxWidth;
    const promoLabel = context.pricing.promoCode
        ? `${context.pricing.promoName || "Promo"} (${context.pricing.promoCode})`
        : "";
    const hasDiscounts = context.pricing.totalDiscount > 0;
    const totalLines = [
        ["Subtotal", formatMoney(context.pricing.subtotal)],
        ...(context.pricing.fixedDiscount > 0 ? [["Discount (fixed)", `-${formatMoney(context.pricing.fixedDiscount)}`]] : []),
        ...(context.pricing.percentDiscountValue > 0 ? [["Discount (%)", `-${formatMoney(context.pricing.percentDiscountValue)}`]] : []),
        ...(context.pricing.promoCode && context.pricing.promoDiscount > 0
            ? [[promoLabel, `-${formatMoney(context.pricing.promoDiscount)}`]]
            : context.pricing.promoCode
                ? [[promoLabel, "Applied"]]
                : []),
        ...(hasDiscounts ? [["Subtotal after discounts", formatMoney(context.pricing.subtotalAfterDiscounts)]] : []),
        ...(context.pricing.showTaxAmount
            ? [[`${context.pricing.taxLabel} (${context.pricing.taxRatePercent}%)`, formatMoney(context.pricing.taxAmount)]]
            : []),
        ...(context.pricing.giftCardCode ? [["Gift Card", context.pricing.giftCardCode]] : [])
    ];
    addText("PRICING SUMMARY", totalsX, y - 2, { size: 12, color: navy, font: "Helvetica-Bold", width: totalBoxWidth });
    totalLines.forEach(([label, value], index) => {
        const lineY = y + 18 + (index * 18);
        const isSubtotalAfter = label === "Subtotal after discounts";
        addText(label, totalsX, lineY, {
            size: 11,
            width: 170,
            font: isSubtotalAfter ? "Helvetica-Bold" : "Helvetica",
            color: isSubtotalAfter ? navy : "#071b3a"
        });
        addText(value, totalsX + 170, lineY, { size: 11, font: "Helvetica-Bold", width: 140, align: "right" });
    });
    const totalBoxY = y + 28 + (totalLines.length * 18);
    doc.roundedRect(totalsX, totalBoxY, totalBoxWidth, 44, 6).fillColor(navy).fill();
    const totalLabel = context.pricing.showTaxAmount
        ? "TOTAL"
        : `TOTAL + ${context.pricing.taxLabel} (${context.pricing.taxRatePercent}%)`;
    const totalDisplay = context.pricing.showTaxAmount
        ? context.pricing.total
        : context.pricing.subtotalAfterDiscounts;
    const totalLabelSize = context.pricing.showTaxAmount ? 18 : 11;
    addText(totalLabel, totalsX + 16, totalBoxY + (context.pricing.showTaxAmount ? 14 : 17), {
        size: totalLabelSize,
        color: "#ffffff",
        font: "Helvetica-Bold",
        width: 160
    });
    addText(formatMoney(totalDisplay), totalsX + 176, totalBoxY + 14, {
        size: 22,
        color: "#ffffff",
        font: "Helvetica-Bold",
        width: 120,
        align: "right"
    });
    addText(`Page 2 includes ${context.documentPromotions.length ? "promotions, " : ""}service notes, and terms.`, margin, totalBoxY + 14, {
        size: 10,
        color: slate,
        width: totalsX - margin - 26,
        lineGap: 2
    });

    const addFooter = (pageNumber) => {
        const footerY = pageHeight - 92;
        doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(2).strokeColor(green).stroke();
        addText(`Phone: ${context.branchPhone}`, margin, footerY + 14, { size: 9.5, color: slate });
        addText(`Email: ${context.branchEmail}`, margin, footerY + 30, { size: 9.5, color: slate });
        addText(`Web: ${context.website}`, margin, footerY + 46, { size: 9.5, color: slate });
        addText(context.company.companyName || "SmarTouch Clean", margin + 214, footerY + 14, {
            size: 10.5,
            color: navy,
            font: "Helvetica-Bold",
            width: 170,
            align: "center"
        });
        addText("Professional Residential & Commercial Cleaning Services", margin + 204, footerY + 30, {
            size: 9,
            color: slate,
            width: 190,
            align: "center"
        });
        addText(`Page ${pageNumber} of 2`, margin + 244, footerY + 50, {
            size: 8.5,
            color: green,
            font: "Helvetica-Bold",
            width: 110,
            align: "center"
        });
        if (context.documentLabel === "Invoice" || context.documentLabel === "Receipt") {
            addText("Business Number (HST):", pageWidth - margin - 170, footerY + 16, {
                size: 9.5,
                color: green,
                width: 170,
                align: "right"
            });
            addText(context.businessNumber, pageWidth - margin - 170, footerY + 34, {
                size: 13,
                color: "#071b3a",
                font: "Helvetica-Bold",
                width: 170,
                align: "right"
            });
        }
    };

    addFooter(1);

    doc.addPage({ size: "A4", margin });
    y = margin;
    try {
        if (logoImageSource) {
            doc.image(logoImageSource, margin, y, { fit: [86, 86] });
        }
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", margin, y + 8, {
            size: 20,
            color: navy,
            font: "Helvetica-Bold"
        });
    }
    addText(`${context.documentLabel.toUpperCase()} DETAILS`, pageWidth - margin - 250, y + 4, {
        size: 20,
        color: navy,
        font: "Helvetica-Bold",
        width: 250,
        align: "right"
    });
    addText(context.documentNumber, pageWidth - margin - 250, y + 32, {
        size: 11,
        color: slate,
        width: 250,
        align: "right"
    });
    y += 98;

    if (booking.customerPortalUrl) {
        doc.roundedRect(margin, y, contentWidth, 56, 10).fillAndStroke("#f8fbff", border);
        addText("CUSTOMER LOGIN / SIGN UP", margin + 18, y + 12, { size: 11, color: navy, font: "Helvetica-Bold" });
        addText("Use the phone number on file to confirm this document and access your customer portal.", margin + 18, y + 30, {
            size: 10,
            color: slate,
            width: contentWidth - 190
        });
        addText("Open Portal", pageWidth - margin - 128, y + 21, {
            size: 11,
            color: navy,
            font: "Helvetica-Bold",
            width: 100,
            align: "right"
        });
        doc.link(pageWidth - margin - 130, y + 12, 110, 34, booking.customerPortalUrl);
        y += 76;
    }

    const promoCards = context.documentPromotions.length ? context.documentPromotions : [];
    if (promoCards.length > 0) {
        addText("AVAILABLE PROMOTIONS", margin, y, { size: 13, color: navy, font: "Helvetica-Bold" });
        y += 18;
        const cardGap = 12;
        const cardWidth = (contentWidth - cardGap) / 2;
        promoCards.slice(0, 4).forEach((promo, index) => {
            const cardX = margin + ((index % 2) * (cardWidth + cardGap));
            const cardY = y + (Math.floor(index / 2) * 82);
            doc.roundedRect(cardX, cardY, cardWidth, 68, 10).fillAndStroke(pale, "#cfe3bf");
            addText(promo.code, cardX + 14, cardY + 12, { size: 12, color: green, font: "Helvetica-Bold", width: cardWidth - 28 });
            addText(`${promo.name} - ${promo.displayValue}`, cardX + 14, cardY + 30, { size: 10.5, color: "#071b3a", font: "Helvetica-Bold", width: cardWidth - 28 });
            addText(promo.description || "Ask customer care to apply this promotion during checkout.", cardX + 14, cardY + 46, {
                size: 8.5,
                color: slate,
                width: cardWidth - 28
            });
        });
        y += Math.ceil(Math.min(promoCards.length, 4) / 2) * 82;

        doc.roundedRect(margin, y, contentWidth, 48, 10).fillAndStroke("#f8fff4", "#cfe3bf");
        addText("REFERRAL CODE", margin + 14, y + 10, { size: 10.5, color: green, font: "Helvetica-Bold" });
        addText(context.referralCode, margin + 150, y + 10, { size: 12, color: green, font: "Helvetica-Bold", width: 190 });
        addText("Share this code with friends or customer care. Referral rules are managed in Promotions Manager.", margin + 14, y + 28, {
            size: 9.5,
            color: slate,
            width: contentWidth - 28
        });
        y += 68;
    }

    const columnGap = 26;
    const columnWidth = (contentWidth - columnGap) / 2;
    addText(context.documentCopy.serviceNotesTitle, margin, y, { size: 12, color: navy, font: "Helvetica-Bold" });
    addText(context.documentCopy.notesTitle, margin + columnWidth + columnGap, y, { size: 12, color: navy, font: "Helvetica-Bold" });
    y += 18;
    const notesTop = y;
    context.serviceNotes.slice(0, 5).forEach((service, index) => {
        const noteY = notesTop + (index * 34);
        addText(service.name || `Service ${index + 1}`, margin, noteY, { size: 9.8, color: "#071b3a", font: "Helvetica-Bold", width: columnWidth });
        addText(service.note, margin, noteY + 13, { size: 8.6, color: slate, width: columnWidth, lineGap: 1 });
    });
    addText(context.noteText, margin + columnWidth + columnGap, notesTop, {
        size: 10,
        color: "#2f3f58",
        width: columnWidth,
        lineGap: 3
    });

    y = notesTop + 184;
    addText(context.documentCopy.termsTitle, margin, y, { size: 12, color: navy, font: "Helvetica-Bold" });
    const terms = getDocumentTerms(context.documentCopy, context.documentLabel);
    terms.forEach((term, index) => {
        const termY = y + 20 + (index * 16);
        addText("-", margin, termY, { size: 10, color: green, font: "Helvetica-Bold", width: 10 });
        addText(term, margin + 14, termY, { size: 9.5, color: "#2f3f58", width: contentWidth - 28 });
    });

    const signatureY = pageHeight - 126;
    doc.moveTo(margin, signatureY).lineTo(margin + 220, signatureY).lineWidth(1).strokeColor("#5c6670").stroke();
    doc.moveTo(margin + 270, signatureY).lineTo(margin + 430, signatureY).lineWidth(1).strokeColor("#5c6670").stroke();
    addText("Client Signature", margin, signatureY + 8, { size: 9, color: slate, width: 160 });
    addText("Date", margin + 270, signatureY + 8, { size: 9, color: slate, width: 100 });
    addFooter(2);

    doc.end();
    return pdfBuffer;
}
