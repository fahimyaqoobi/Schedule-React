import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { buildDocumentPricingBreakdown, getBookingDocumentLabel, getBookingDocumentNumber } from "./bookingDocuments";
import { generateReferralCode, getDocumentPromotions } from "./promotions";
import { getDocumentTerms, normalizeDocumentCopy } from "./documentCopy";

// Professional print scale — keep every new addText() call within this
// range. Nothing on the page should read louder than the TOTAL figure.
const SIZE = {
    title: 16,     // document type ("ESTIMATE" / "INVOICE"), page-2 heading
    subhead: 11,    // section labels: CLIENT, SERVICE ADDRESS, SERVICES...
    body: 9.5,      // table cells, detail rows, notes
    small: 8,       // fine print: addon lines, footer, base-price captions
    totalLabel: 13,
    totalValue: 18
};

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
    const navy = "#0b2f5e";
    const green = "#5ba531";
    const slate = "#5a6b81";
    const border = "#dde3ea";
    const pale = "#f3f8f0";
    const logoSize = 64;

    const addText = (text, x, y, opts = {}) => {
        doc.fillColor(opts.color || "#1a2942");
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || SIZE.body);
        doc.text(String(text || ""), x, y, {
            width: opts.width,
            height: opts.height || 34,
            align: opts.align,
            lineGap: opts.lineGap,
            lineBreak: opts.lineBreak ?? false
        });
    };

    // Reserve space at the bottom of every page for the footer band.
    const footerReserve = 92;
    const pageBottom = pageHeight - footerReserve - 12;

    let pageNumber = 1;
    const addFooter = (num) => {
        const footerY = pageHeight - 78;
        doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(1.5).strokeColor(green).stroke();
        addText(`Phone: ${context.branchPhone}`, margin, footerY + 10, { size: SIZE.small, color: slate });
        addText(`Email: ${context.branchEmail}`, margin, footerY + 23, { size: SIZE.small, color: slate });
        addText(`Web: ${context.website}`, margin, footerY + 36, { size: SIZE.small, color: slate });
        addText(context.company.companyName || "SmarTouch Clean", margin + 190, footerY + 10, {
            size: SIZE.small + 0.5,
            color: navy,
            font: "Helvetica-Bold",
            width: 170,
            align: "center"
        });
        addText("Professional Residential & Commercial Cleaning", margin + 180, footerY + 24, {
            size: SIZE.small - 0.5,
            color: slate,
            width: 190,
            align: "center"
        });
        addText(`Page ${num}`, margin + 220, footerY + 38, {
            size: SIZE.small - 0.5,
            color: green,
            font: "Helvetica-Bold",
            width: 110,
            align: "center"
        });
        if (context.documentLabel === "Invoice" || context.documentLabel === "Receipt") {
            addText("Business Number (HST):", pageWidth - margin - 170, footerY + 10, {
                size: SIZE.small,
                color: green,
                width: 170,
                align: "right"
            });
            addText(context.businessNumber, pageWidth - margin - 170, footerY + 24, {
                size: SIZE.body + 1,
                color: "#1a2942",
                font: "Helvetica-Bold",
                width: 170,
                align: "right"
            });
        }
    };

    const startPage = () => {
        addFooter(pageNumber);
        doc.addPage({ size: "A4", margin });
        pageNumber += 1;
        return margin;
    };

    let y = margin;

    // ── Header: logo, branch, document type + key facts ──
    try {
        if (logoImageSource) {
            doc.image(logoImageSource, margin, y, { fit: [logoSize, logoSize] });
        } else {
            throw new Error("no-logo");
        }
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", margin, y + 6, {
            size: SIZE.title,
            color: navy,
            font: "Helvetica-Bold"
        });
    }

    addText(context.company.branchName || booking.branchName || "Ottawa", margin, y + logoSize + 8, { size: SIZE.body, font: "Helvetica-Bold" });
    addText(context.branchEmail, margin, y + logoSize + 21, { size: SIZE.small, color: slate });

    const rightX = margin + (contentWidth * 0.58);
    addText(context.documentLabel.toUpperCase(), rightX, y + 2, {
        size: SIZE.title,
        color: navy,
        font: "Helvetica-Bold",
        width: contentWidth * 0.42,
        align: "right"
    });
    doc.moveTo(rightX + 90, y + 24).lineTo(pageWidth - margin, y + 24).lineWidth(1.5).strokeColor(green).stroke();

    const detailX = rightX;
    const detailY = y + 34;
    const detailLabelWidth = 78;
    const detailValueX = detailX + detailLabelWidth + 6;
    const detailRows = [
        [`${context.documentLabel} #:`, context.documentNumber, navy],
        ["Date:", formatDate(booking.date), "#1a2942"],
        ["Status:", booking.status || "Pending", green],
        ["Payment:", (booking.paymentStatus || "unpaid").replace(/^./, (match) => match.toUpperCase()), "#1a2942"]
    ];
    detailRows.forEach(([label, value, color], index) => {
        const rowY = detailY + (index * 14.5);
        addText(label, detailX, rowY, { size: SIZE.small, font: "Helvetica-Bold", width: detailLabelWidth });
        addText(value, detailValueX, rowY, { size: SIZE.small, color, width: contentWidth * 0.42 - detailLabelWidth });
    });

    y = margin + logoSize + 42;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor(border).stroke();
    y += 14;

    // ── Client / address cards ──
    const cardTop = y;
    const leftCardWidth = (contentWidth - 24) / 2;
    const rightCardX = margin + leftCardWidth + 24;
    const cardHeight = 62;

    addText("CLIENT", margin, cardTop, { size: SIZE.small, color: navy, font: "Helvetica-Bold" });
    addText(context.clientDisplay, margin, cardTop + 14, { size: SIZE.subhead + 2, font: "Helvetica-Bold" });
    addText(booking.phone || "", margin, cardTop + 34, { size: SIZE.small, color: slate, width: leftCardWidth - 12 });
    addText(booking.email || "", margin, cardTop + 46, { size: SIZE.small, color: slate, width: leftCardWidth - 12 });

    doc.moveTo(margin + leftCardWidth + 12, cardTop).lineTo(margin + leftCardWidth + 12, cardTop + cardHeight).lineWidth(1).strokeColor(border).stroke();

    addText("SERVICE ADDRESS", rightCardX, cardTop, { size: SIZE.small, color: navy, font: "Helvetica-Bold" });
    addText(context.addressLine1 || booking.address1 || "Address Pending", rightCardX, cardTop + 14, {
        size: SIZE.subhead + 1,
        font: "Helvetica-Bold",
        width: leftCardWidth
    });
    addText(context.addressLine2 || "Ottawa, ON", rightCardX, cardTop + 40, {
        size: SIZE.small,
        color: slate,
        width: leftCardWidth
    });

    // ── SCHEDULED SERVICE banner: date, arrival time, frequency ──
    y = cardTop + cardHeight + 12;
    const SHIFT_HOURS = {
        morning: "Morning · 7:00 AM – 12:00 PM",
        afternoon: "Afternoon · 12:00 PM – 6:00 PM",
        evening: "Evening · 6:00 PM – 8:00 PM"
    };
    const shiftText = (booking.shifts || []).map((shift) => SHIFT_HOURS[shift]).filter(Boolean).join("  |  ");
    const bannerHeight = shiftText ? 52 : 44;
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).fillColor(pale).fill();
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 7).lineWidth(1).strokeColor(green).stroke();
    const bannerColWidth = contentWidth / 3;
    addText("SERVICE DATE", margin + 14, y + 8, { size: SIZE.small - 0.5, color: slate, font: "Helvetica-Bold" });
    addText(formatDate(booking.date) || "To be scheduled", margin + 14, y + 19, {
        size: SIZE.subhead,
        color: navy,
        font: "Helvetica-Bold",
        width: bannerColWidth - 20
    });
    addText("ARRIVAL TIME", margin + 14 + bannerColWidth, y + 8, { size: SIZE.small - 0.5, color: slate, font: "Helvetica-Bold" });
    addText(booking.time || "To be confirmed", margin + 14 + bannerColWidth, y + 19, {
        size: SIZE.subhead,
        color: navy,
        font: "Helvetica-Bold",
        width: bannerColWidth - 20
    });
    addText("FREQUENCY", margin + 14 + (bannerColWidth * 2), y + 8, { size: SIZE.small - 0.5, color: slate, font: "Helvetica-Bold" });
    addText(
        booking.isRecurring ? `${booking.frequency || "Recurring"} (Recurring)` : (booking.frequency || "One-Time"),
        margin + 14 + (bannerColWidth * 2), y + 19, {
            size: SIZE.subhead,
            color: navy,
            font: "Helvetica-Bold",
            width: bannerColWidth - 20
        }
    );
    if (shiftText) {
        addText(shiftText, margin + 14, y + 36, { size: SIZE.small - 0.5, color: slate, width: contentWidth - 28 });
    }
    y += bannerHeight + 14;

    // ── Services table (paginates if the list is long) ──
    const tableX = margin;
    const tableWidth = contentWidth;
    const colWidths = [30, 210, 165, tableWidth - 30 - 210 - 165];
    const headerHeight = 20;

    const drawTableHeader = (headerY) => {
        doc.roundedRect(tableX, headerY, tableWidth, headerHeight, 6).fillColor(navy).fill();
        const headers = ["#", "DESCRIPTION", "DETAILS", "AMOUNT"];
        let cursorX = tableX;
        headers.forEach((header, index) => {
            addText(header, cursorX + 8, headerY + 5.5, {
                size: SIZE.small,
                color: "#ffffff",
                font: "Helvetica-Bold",
                width: colWidths[index] - 16,
                align: index === 3 ? "right" : "left"
            });
            cursorX += colWidths[index];
        });
        return headerY + headerHeight;
    };

    addText("SERVICES", margin, y, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold" });
    y += 15;
    y = drawTableHeader(y);

    // Measures how tall a string will render at a given width/font so a
    // long or manually-overridden service name can wrap onto extra lines
    // instead of overflowing into whatever is drawn below it.
    const measureHeight = (text, opts = {}) => {
        doc.font(opts.font || "Helvetica");
        doc.fontSize(opts.size || SIZE.body);
        return doc.heightOfString(String(text || ""), { width: opts.width, lineGap: opts.lineGap || 0 });
    };

    context.pricing.services.forEach((item) => {
        const nameWidth = colWidths[1] - 16;
        const detailsWidth = colWidths[2] - 16;
        const nameHeight = measureHeight(item.name || "Service", { font: "Helvetica-Bold", size: SIZE.body, width: nameWidth });
        const detailsHeight = measureHeight(item.details || "Included", { size: SIZE.body, width: detailsWidth });
        // Whichever of name/details wraps taller sets where the "base price"
        // caption and add-on lines start — never a fixed offset.
        const descBlockHeight = Math.max(nameHeight, detailsHeight, 12);
        const priceLineY = 8 + descBlockHeight + 4;
        const rowHeight = priceLineY + 13 + (item.addonLines.length * 13) + 8;

        // Only the row itself needs to fit here — whether the totals block
        // fits under the *last* row is checked separately once the table is
        // done, so a long list still uses the full page instead of jumping
        // early "just in case."
        if (y + rowHeight > pageBottom) {
            y = startPage();
            addText(`${context.documentLabel.toUpperCase()} ${context.documentNumber} — continued`, margin, y, {
                size: SIZE.small, color: slate, font: "Helvetica-Bold"
            });
            y += 16;
            y = drawTableHeader(y);
        }

        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#ffffff", border);
        let cursorX = tableX;
        addText(String(item.index).padStart(2, "0"), cursorX + 8, y + 8, {
            size: SIZE.body, width: colWidths[0] - 16, align: "center"
        });
        cursorX += colWidths[0];
        addText(item.name || "Service", cursorX + 8, y + 8, {
            size: SIZE.body, font: "Helvetica-Bold", width: nameWidth, lineBreak: true
        });
        cursorX += colWidths[1];
        addText(item.details || "Included", cursorX + 8, y + 8, {
            size: SIZE.body, width: detailsWidth, lineBreak: true
        });
        cursorX += colWidths[2];
        addText(formatMoney(item.total), cursorX + 8, y + 8, {
            size: SIZE.body, color: navy, font: "Helvetica-Bold", width: colWidths[3] - 16, align: "right"
        });

        addText("Base service price", tableX + colWidths[0] + 8, y + priceLineY, {
            size: SIZE.small - 0.5,
            color: slate,
            width: colWidths[1] + colWidths[2] - 16
        });
        addText(formatMoney(item.baseAmount), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, y + priceLineY, {
            size: SIZE.small - 0.5,
            color: navy,
            font: "Helvetica-Bold",
            width: colWidths[3] - 16,
            align: "right"
        });

        item.addonLines.forEach((addon, addonIndex) => {
            const addonY = y + priceLineY + 13 + (addonIndex * 13);
            const addonLabel = addon.qty > 1
                ? `Add-on: ${addon.name} (${addon.qty} × ${formatMoney(addon.unitPrice)})`
                : `Add-on: ${addon.name}`;
            addText(addonLabel, tableX + colWidths[0] + 8, addonY, {
                size: SIZE.small - 0.5,
                color: slate,
                width: colWidths[1] + colWidths[2] - 16
            });
            addText(formatMoney(addon.total), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, addonY, {
                size: SIZE.small - 0.5,
                color: navy,
                font: "Helvetica-Bold",
                width: colWidths[3] - 16,
                align: "right"
            });
        });

        y += rowHeight;
    });

    // ── Totals block — start a fresh page if it won't fit under the table ──
    y += 14;
    const totalBoxWidth = 260;
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

    const neededHeight = 20 + (totalLines.length * 15) + 60;
    if (y + neededHeight > pageBottom) {
        y = startPage();
    }

    addText("PRICING SUMMARY", totalsX, y - 2, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold", width: totalBoxWidth });
    totalLines.forEach(([label, value], index) => {
        const lineY = y + 15 + (index * 15);
        const isSubtotalAfter = label === "Subtotal after discounts";
        addText(label, totalsX, lineY, {
            size: SIZE.small + 0.5,
            width: 150,
            font: isSubtotalAfter ? "Helvetica-Bold" : "Helvetica",
            color: isSubtotalAfter ? navy : "#1a2942"
        });
        addText(value, totalsX + 150, lineY, { size: SIZE.small + 0.5, font: "Helvetica-Bold", width: 110, align: "right" });
    });
    const totalBoxY = y + 24 + (totalLines.length * 15);
    doc.roundedRect(totalsX, totalBoxY, totalBoxWidth, 36, 6).fillColor(navy).fill();
    const totalDisplay = context.pricing.showTaxAmount
        ? context.pricing.total
        : context.pricing.subtotalAfterDiscounts;
    addText("TOTAL", totalsX + 14, totalBoxY + 10, {
        size: SIZE.totalLabel,
        color: "#ffffff",
        font: "Helvetica-Bold",
        width: 100
    });
    addText(formatMoney(totalDisplay), totalsX + 120, totalBoxY + 8, {
        size: SIZE.totalValue,
        color: "#ffffff",
        font: "Helvetica-Bold",
        width: 128,
        align: "right"
    });
    if (!context.pricing.showTaxAmount) {
        addText(
            `* ${context.pricing.taxLabel} (${context.pricing.taxRatePercent}%) is not included. It will be added at the time of invoicing.`,
            totalsX, totalBoxY + 42, {
                size: SIZE.small - 0.5,
                color: slate,
                font: "Helvetica-Oblique",
                width: totalBoxWidth,
                lineGap: 1
            }
        );
    }
    addText(`The next page includes ${context.documentPromotions.length ? "promotions, " : ""}service notes, and terms.`, margin, totalBoxY + 10, {
        size: SIZE.small,
        color: slate,
        width: totalsX - margin - 20,
        lineGap: 2
    });

    addFooter(pageNumber);

    // ── Page 2: promotions, service/booking notes, terms, signature ──
    doc.addPage({ size: "A4", margin });
    pageNumber += 1;
    y = margin;
    try {
        if (logoImageSource) {
            doc.image(logoImageSource, margin, y, { fit: [48, 48] });
        } else {
            throw new Error("no-logo");
        }
    } catch (_error) {
        addText(context.company.companyName || "SmarTouch Clean", margin, y + 6, {
            size: SIZE.subhead + 2,
            color: navy,
            font: "Helvetica-Bold"
        });
    }
    addText(`${context.documentLabel.toUpperCase()} DETAILS`, pageWidth - margin - 250, y + 2, {
        size: SIZE.title - 2,
        color: navy,
        font: "Helvetica-Bold",
        width: 250,
        align: "right"
    });
    addText(context.documentNumber, pageWidth - margin - 250, y + 22, {
        size: SIZE.small + 0.5,
        color: slate,
        width: 250,
        align: "right"
    });
    y += 66;

    if (booking.customerPortalUrl) {
        doc.roundedRect(margin, y, contentWidth, 46, 8).fillAndStroke("#f8fbff", border);
        addText("CUSTOMER LOGIN / SIGN UP", margin + 14, y + 9, { size: SIZE.small + 0.5, color: navy, font: "Helvetica-Bold" });
        addText("Use the phone number on file to confirm this document and access your customer portal.", margin + 14, y + 23, {
            size: SIZE.small,
            color: slate,
            width: contentWidth - 170
        });
        addText("Open Portal", pageWidth - margin - 118, y + 16, {
            size: SIZE.body,
            color: navy,
            font: "Helvetica-Bold",
            width: 90,
            align: "right"
        });
        doc.link(pageWidth - margin - 120, y + 8, 100, 30, booking.customerPortalUrl);
        y += 62;
    }

    const promoCards = context.documentPromotions.length ? context.documentPromotions : [];
    if (promoCards.length > 0) {
        addText("AVAILABLE PROMOTIONS", margin, y, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold" });
        y += 15;
        const cardGap = 10;
        const cardWidth = (contentWidth - cardGap) / 2;
        const cardHeight2 = 56;
        promoCards.slice(0, 4).forEach((promo, index) => {
            const cardX = margin + ((index % 2) * (cardWidth + cardGap));
            const cardY = y + (Math.floor(index / 2) * (cardHeight2 + 10));
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight2, 8).fillAndStroke(pale, "#cfe3bf");
            addText(promo.code, cardX + 12, cardY + 9, { size: SIZE.body, color: green, font: "Helvetica-Bold", width: cardWidth - 24 });
            addText(`${promo.name} - ${promo.displayValue}`, cardX + 12, cardY + 23, { size: SIZE.small + 0.5, color: "#1a2942", font: "Helvetica-Bold", width: cardWidth - 24 });
            addText(promo.description || "Ask customer care to apply this promotion during checkout.", cardX + 12, cardY + 37, {
                size: SIZE.small - 1,
                color: slate,
                width: cardWidth - 24
            });
        });
        y += (Math.ceil(Math.min(promoCards.length, 4) / 2) * (cardHeight2 + 10)) + 4;

        doc.roundedRect(margin, y, contentWidth, 40, 8).fillAndStroke("#f8fff4", "#cfe3bf");
        addText("REFERRAL CODE", margin + 12, y + 8, { size: SIZE.small + 0.5, color: green, font: "Helvetica-Bold" });
        addText(context.referralCode, margin + 128, y + 8, { size: SIZE.body, color: green, font: "Helvetica-Bold", width: 190 });
        addText("Share this code with friends or customer care. Referral rules are managed in Promotions Manager.", margin + 12, y + 22, {
            size: SIZE.small - 1,
            color: slate,
            width: contentWidth - 24
        });
        y += 56;
    }

    const columnGap = 22;
    const columnWidth = (contentWidth - columnGap) / 2;
    addText(context.documentCopy.serviceNotesTitle, margin, y, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold" });
    addText(context.documentCopy.notesTitle, margin + columnWidth + columnGap, y, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold" });
    y += 15;
    const notesTop = y;
    context.serviceNotes.slice(0, 5).forEach((service, index) => {
        const noteY = notesTop + (index * 30);
        addText(service.name || `Service ${index + 1}`, margin, noteY, { size: SIZE.small + 0.5, color: "#1a2942", font: "Helvetica-Bold", width: columnWidth });
        addText(service.note, margin, noteY + 12, { size: SIZE.small - 0.5, color: slate, width: columnWidth, lineGap: 1 });
    });
    addText(context.noteText, margin + columnWidth + columnGap, notesTop, {
        size: SIZE.body,
        color: "#28374f",
        width: columnWidth,
        lineGap: 3
    });

    y = notesTop + 168;
    addText(context.documentCopy.termsTitle, margin, y, { size: SIZE.subhead, color: navy, font: "Helvetica-Bold" });
    const terms = getDocumentTerms(context.documentCopy, context.documentLabel);
    terms.forEach((term, index) => {
        const termY = y + 17 + (index * 14);
        addText("–", margin, termY, { size: SIZE.small, color: green, font: "Helvetica-Bold", width: 10 });
        addText(term, margin + 12, termY, { size: SIZE.small, color: "#28374f", width: contentWidth - 24 });
    });

    const signatureY = pageHeight - 118;
    doc.moveTo(margin, signatureY).lineTo(margin + 200, signatureY).lineWidth(1).strokeColor("#8a94a3").stroke();
    doc.moveTo(margin + 250, signatureY).lineTo(margin + 400, signatureY).lineWidth(1).strokeColor("#8a94a3").stroke();
    addText("Client Signature", margin, signatureY + 6, { size: SIZE.small, color: slate, width: 160 });
    addText("Date", margin + 250, signatureY + 6, { size: SIZE.small, color: slate, width: 100 });
    addFooter(pageNumber);

    doc.end();
    return pdfBuffer;
}
