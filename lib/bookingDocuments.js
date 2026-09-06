import { generateReferralCode, getDocumentPromotions } from "./promotions";
import { getDocumentTerms, normalizeDocumentCopy } from "./documentCopy";
import { computeBookingPricing } from "./pricing";
import { formatZonedDate } from "./timezone";

// Same two links on every Estimate/Booking/Invoice/Receipt — accepting the
// document and receiving the service means accepting both, so this line
// belongs next to the terms fine print on all four, not just one type.
export const PRIVACY_POLICY_URL = "https://www.smartouchclean.com/en/privacy";
export const TERMS_OF_SERVICE_URL = "https://www.smartouchclean.com/en/terms";

export function getBookingDocumentLabel(booking = {}) {
    if (booking.documentStage === "receipt" || booking.receiptNumber) return "Receipt";
    if (booking.documentStage === "invoice" || booking.invoiceNumber) return "Invoice";
    if (booking.documentStage === "estimate") return "Estimate";
    return ["Lead", "Follow Up", "Quote", "Pending"].includes(booking.status) ? "Estimate" : "Booking";
}

export function getBookingDocumentNumber(booking = {}) {
    return booking.receiptNumber || booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "Pending";
}

export function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function formatDate(value) {
    if (!value) return "TBD";
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatZonedDate(parsed, { year: "numeric", month: "long", day: "numeric" });
}

export function formatMoney(value) {
    return `CA$${Number(value || 0).toFixed(2)}`;
}

// Adds `days` to a date (accepts an ISO datetime, a "YYYY-MM-DD" string, or
// nothing — nothing falls back to today) and returns it formatted for
// display. Used for "Valid until" (estimate) and "Date due" (invoice) when
// the booking doesn't carry an explicit override for either.
function formatDatePlusDays(value, days) {
    const base = value ? new Date(value) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + days);
    return formatZonedDate(base, { year: "numeric", month: "long", day: "numeric" });
}

function getStatusClass(status = "") {
    return ["pending", "unpaid", "redo"].includes(String(status).toLowerCase()) ? "green" : "blue";
}

export function buildDocumentPricingBreakdown(booking = {}, company = {}) {
    const items = Array.isArray(booking.cartItems) && booking.cartItems.length
        ? booking.cartItems
        : [
            {
                cartId: booking.id || "service-1",
                name: booking.service || "Cleaning Service",
                optionName: booking.frequency || "One-Time",
                bathroomKey: booking.duration ? `${booking.duration} Hours` : "",
                price: Number(booking.subtotal || booking.price || 0),
                durationHrs: Number(booking.duration || 0),
                addons: []
            }
        ];

    const services = items.map((item, index) => {
        const addons = Array.isArray(item.addons) ? item.addons : [];
        const addonLines = addons.map((addon, addonIndex) => ({
            id: addon.id || `${item.cartId || index}-addon-${addonIndex}`,
            name: addon.name || "Add-on",
            qty: Number(addon.qty || 1),
            unitPrice: Number(addon.price || 0),
            total: Number(addon.price || 0) * Number(addon.qty || 1)
        }));
        const addonTotal = addonLines.reduce((sum, addon) => sum + addon.total, 0);
        const total = Number(item.price || 0);
        const baseAmount = Math.max(0, total - addonTotal);

        return {
            id: item.cartId || item.id || `service-${index + 1}`,
            index: index + 1,
            name: item.name || "Service",
            details: [item.optionName, item.bathroomKey].filter(Boolean).join(" • ") || "Included",
            durationHrs: Number(item.durationHrs || item.duration || 0),
            serviceNote: item.serviceNote || item.documentNote || item.note || item.specialNotes || "",
            baseAmount,
            addonLines,
            addonTotal,
            total
        };
    });

    const subtotal = Number(booking.subtotal || services.reduce((sum, item) => sum + item.total, 0));
    const taxRate = Number(booking.taxRate || company.taxRate || 0.13);
    const taxRatePercent = Math.round(taxRate * 100);
    const taxLabel = company.taxLabel || booking.taxLabel || "HST";

    // Single canonical formula — same one used at checkout/edit save time.
    const computed = computeBookingPricing({
        subtotal,
        customDiscountAmount: booking.customDiscountAmount,
        customDiscountPercent: booking.customDiscountPercent,
        promoDiscount: booking.promoDiscount,
        taxRate
    });

    // Legacy safety net: bookings saved before this formula was unified may
    // have a stored tax/price that doesn't match a fresh recompute. Never
    // silently change what a client was already quoted/charged — if the
    // recomputed total disagrees with the stored total, trust the stored
    // figures and only use the fresh numbers for the discount line items.
    const storedTotal = Number(booking.price);
    const trustStored = Number.isFinite(storedTotal) && storedTotal > 0 && Math.abs(storedTotal - computed.total) > 0.01;
    const taxAmount = trustStored ? Number(booking.tax || 0) : computed.taxAmount;
    const total = trustStored ? storedTotal : computed.total;
    const subtotalAfterDiscounts = trustStored ? Math.max(0, total - taxAmount) : computed.subtotalAfterDiscounts;

    const fixedDiscount = computed.fixedDiscount;
    const percentDiscountValue = computed.percentDiscountValue;
    const promoDiscount = computed.promoDiscount;
    const manualDiscount = computed.manualDiscount;
    const totalDiscount = computed.totalDiscount;

    const documentLabel = getBookingDocumentLabel(booking);
    // Estimates and bookings show "+ tax" wording only; invoices/receipts show the calculated amount
    const showTaxAmount = documentLabel === "Invoice" || documentLabel === "Receipt";

    return {
        services,
        subtotal,
        subtotalAfterDiscounts,
        taxAmount,
        total,
        fixedDiscount,
        percentDiscountValue,
        manualDiscount,
        totalDiscount,
        promoCode: booking.promoCode || "",
        promoName: booking.promoName || "",
        promoDiscount,
        giftCardCode: booking.giftCardCode || "",
        taxLabel,
        taxRatePercent,
        showTaxAmount,
        documentLabel,
    };
}

// Flattens services + their add-ons into one flat list of billable rows —
// one per service base price, one per add-on — matching how a plain,
// minimal invoice actually lists things (see the reference design: every
// line, base price or add-on, gets its own Qty/Unit price/Tax/Amount row
// instead of nesting add-ons as sub-text under a parent row).
export function buildDocumentLineItems(pricing) {
    const rows = [];
    pricing.services.forEach((service) => {
        rows.push({
            description: [service.name, service.details, service.addonLines.length ? "Base Price" : ""].filter(Boolean).join(" "),
            qty: 1,
            unitPrice: service.baseAmount,
            taxPercent: pricing.taxRatePercent,
            amount: service.baseAmount
        });
        service.addonLines.forEach((addon) => {
            rows.push({
                description: `Add-on: ${addon.name}`,
                qty: addon.qty,
                unitPrice: addon.unitPrice,
                taxPercent: pricing.taxRatePercent,
                amount: addon.total
            });
        });
    });
    return rows;
}

// Billing address is a distinct concept from where the crew actually shows
// up (service address) — most bookings have the same address for both, so
// this defaults to "same as service" unless a booking explicitly stores a
// different billing address (billingSameAsService: false + its own
// billingAddress* fields, set via the "different billing address" checkbox
// on the booking form).
export function getBillingAddressLines(booking = {}) {
    const sameAsService = booking.billingSameAsService !== false;
    if (sameAsService) {
        return {
            sameAsService: true,
            line1: [booking.address1, booking.address2].filter(Boolean).join(", "),
            line2: [booking.city, booking.state, booking.postalCode].filter(Boolean).join(", "),
            country: booking.country || "Canada"
        };
    }
    return {
        sameAsService: false,
        line1: [booking.billingAddress1, booking.billingAddress2].filter(Boolean).join(", "),
        line2: [booking.billingCity, booking.billingState, booking.billingPostalCode].filter(Boolean).join(", "),
        country: booking.billingCountry || booking.country || "Canada"
    };
}

// Single context builder shared by the PDF (pdfkit) renderer, the printable
// HTML preview, and the notification email — so all three ever agree on
// dates, addresses, and money. Previously this was two near-identical,
// separately-maintained copies (one per renderer) that could quietly drift.
export function getBookingDocumentContext(booking = {}, options = {}) {
    const company = booking.companySnapshot || {};
    const documentLabel = getBookingDocumentLabel(booking);
    const documentNumber = getBookingDocumentNumber(booking);
    const logoUrl = options.logoUrl || company.logoUrl || "/logo-full.png";
    const clientName = booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";
    const clientDisplay = clientName.split(" ").filter(Boolean)[0] || clientName;

    const serviceAddress = {
        line1: [booking.address1, booking.address2].filter(Boolean).join(", "),
        line2: [booking.city, booking.state, booking.postalCode].filter(Boolean).join(", ")
    };
    const billingAddress = getBillingAddressLines(booking);

    // Kept for older callers that read addressLine1/2 directly (this is the
    // SERVICE address, same meaning as before this refactor).
    const addressLine1 = serviceAddress.line1;
    const addressLine2 = serviceAddress.line2;

    const total = Number(booking.price || 0);
    const taxRatePercent = Math.round(Number(booking.taxRate || company.taxRate || 0.13) * 100);
    const branchPhone = company.branchPhone || "613-416-5001";
    const branchEmail = company.branchEmail || "info@smartouchclean.com";
    const website = company.website || "www.smartouchclean.com";
    const businessNumber = company.businessNumber || "723469631RC0001";
    const documentCopy = normalizeDocumentCopy(company.documentCopy || booking.documentCopy);
    const noteText = booking.note || documentCopy.notesBody;
    const customerPortalUrl = options.customerPortalUrl || booking.customerPortalUrl || "";
    const referralCode = booking.referralCode || generateReferralCode(booking.phone, documentNumber, clientName);
    const pricing = buildDocumentPricingBreakdown(booking, company);
    const lineItems = buildDocumentLineItems(pricing);
    const documentPromotions = getDocumentPromotions(company.promotions ?? booking.promotions ?? []);

    // "Date of issue" means something different per document type. An
    // Estimate/Booking is issued the moment that record is created, so
    // booking.createdAt is correct and stays stable across repeat
    // downloads. An Invoice/Receipt is issued whenever it's actually
    // generated/sent — for a RECURRING booking that can be months after
    // this occurrence's own createdAt (later occurrences are often created
    // well ahead of when they're actually cleaned and invoiced), so reusing
    // createdAt there showed a "Date of issue" months in the past on an
    // invoice being sent today. Invoices/receipts always get "today".
    const isMoneyDocument = documentLabel === "Invoice" || documentLabel === "Receipt";
    const todayIso = new Date().toISOString();
    const issueDateSource = isMoneyDocument ? todayIso : (booking.createdAt || booking.date);
    const issueDate = isMoneyDocument
        ? formatDate(todayIso.slice(0, 10))
        : formatDate(booking.createdAt ? booking.createdAt.slice(0, 10) : booking.date);
    const validUntil = formatDatePlusDays(issueDateSource, 30);
    // Payment is due the same day the invoice is generated ("due on
    // receipt") unless a booking explicitly carries its own due date.
    const paymentDue = booking.paymentDueDate ? formatDate(booking.paymentDueDate) : issueDate;

    const SHIFT_HOURS = {
        morning: "Morning · 7:00 AM – 12:00 PM",
        afternoon: "Afternoon · 12:00 PM – 6:00 PM",
        evening: "Evening · 6:00 PM – 8:00 PM"
    };
    const shiftText = (booking.shifts || []).map((shift) => SHIFT_HOURS[shift]).filter(Boolean).join("  |  ");
    const frequencyText = booking.isRecurring ? `${booking.frequency || "Recurring"} (Recurring)` : (booking.frequency || "One-Time");

    return {
        company,
        documentLabel,
        documentNumber,
        logoUrl,
        clientName,
        clientDisplay,
        serviceAddress,
        billingAddress,
        addressLine1,
        addressLine2,
        total,
        issueDate,
        validUntil,
        paymentDue,
        shiftText,
        frequencyText,
        taxRatePercent,
        branchPhone,
        branchEmail,
        website,
        businessNumber,
        documentCopy,
        noteText,
        customerPortalUrl,
        referralCode,
        pricing,
        lineItems,
        documentPromotions
    };
}

// Kept as an alias — some older call sites may still import this name.
export const getDocumentContext = getBookingDocumentContext;

export function buildBookingEmailHtml(booking = {}, options = {}) {
    const context = getBookingDocumentContext(booking, options);
    const intro = context.documentLabel === "Invoice"
        ? "Your invoice from SmarTouch Clean is attached as a PDF for easy review."
        : context.documentLabel === "Receipt"
            ? "Your payment receipt from SmarTouch Clean is attached as a PDF for your records."
            : context.documentLabel === "Booking"
                ? "Your booking summary from SmarTouch Clean is attached as a PDF for easy review."
                : "Your estimate from SmarTouch Clean is attached as a PDF for easy review.";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(context.documentLabel)} ${escapeHtml(context.documentNumber)}</title>
</head>
<body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,sans-serif;color:#10233f;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #d9e1ec;">
          <tr>
            <td style="background:linear-gradient(135deg,#0b3d91 0%,#113e76 100%);padding:28px 24px;color:#ffffff;">
              <img src="${escapeHtml(context.logoUrl)}" alt="SmarTouch Clean" style="max-width:220px;width:100%;height:auto;display:block;margin:0 0 18px;" />
              <div style="font-size:28px;font-weight:800;letter-spacing:0.02em;">${escapeHtml(context.documentLabel)}</div>
              <div style="margin-top:8px;font-size:16px;opacity:.92;">${escapeHtml(context.documentNumber)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 12px;">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">Hello ${escapeHtml(context.clientDisplay)},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#41546f;">${escapeHtml(intro)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 12px;">
                <tr>
                  <td style="width:50%;padding:14px 16px;border:1.5px solid #5ba531;border-radius:14px;background:#f2fbec;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#3e7a1e;text-transform:uppercase;margin-bottom:8px;">Service Date</div>
                    <div style="font-size:18px;font-weight:800;color:#10233f;">${escapeHtml(formatDate(booking.date) || "To be scheduled")}</div>
                  </td>
                  <td style="width:50%;padding:14px 16px;border:1.5px solid #5ba531;border-radius:14px;background:#f2fbec;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#3e7a1e;text-transform:uppercase;margin-bottom:8px;">Arrival Time</div>
                    <div style="font-size:18px;font-weight:800;color:#10233f;">${escapeHtml(booking.time || "To be confirmed")}</div>
                  </td>
                </tr>
                <tr>
                  <td style="width:50%;padding:14px 16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fbff;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0b3d91;text-transform:uppercase;margin-bottom:8px;">Status</div>
                    <div style="font-size:18px;font-weight:700;color:#10233f;">${escapeHtml(booking.status || "Pending")}${booking.isRecurring ? ` · ${escapeHtml(booking.frequency || "Recurring")}` : ""}</div>
                  </td>
                  <td style="width:50%;padding:14px 16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fbff;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0b3d91;text-transform:uppercase;margin-bottom:8px;">Total</div>
                    <div style="font-size:18px;font-weight:700;color:#10233f;">${escapeHtml(formatMoney(context.total))}</div>
                  </td>
                </tr>
              </table>
              ${context.customerPortalUrl ? `
                <div style="margin-top:6px;padding:16px 18px;border:1px solid #d9e1ec;border-radius:16px;background:#f8fbff;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0b3d91;text-transform:uppercase;margin-bottom:8px;">Customer Access</div>
                  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#41546f;">Use your phone number on file to confirm this ${escapeHtml(context.documentLabel.toLowerCase())} and access your future customer portal.</p>
                  <a href="${escapeHtml(context.customerPortalUrl)}" style="display:inline-block;background:#0b3d91;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">Open Customer Login / Sign Up</a>
                </div>
              ` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;">
              <div style="border:1px solid #d9e1ec;border-radius:16px;padding:18px;background:#ffffff;">
                <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0b3d91;text-transform:uppercase;margin-bottom:10px;">Service Address</div>
                <div style="font-size:16px;font-weight:700;margin-bottom:6px;">${escapeHtml(context.addressLine1 || booking.address1 || "Address Pending")}</div>
                <div style="font-size:14px;color:#5c6b80;">${escapeHtml(context.addressLine2 || "Ottawa, ON")}</div>
              </div>
            </td>
          </tr>
          ${context.documentPromotions.length ? `
            <tr>
              <td style="padding:0 24px 24px;">
                <div style="border:1px solid #d9e1ec;border-radius:16px;padding:18px;background:#f8fff4;">
                  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#5ba531;text-transform:uppercase;margin-bottom:10px;">Refer and Save</div>
                  <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Referral Code: ${escapeHtml(context.referralCode)}</div>
                  <div style="font-size:14px;line-height:1.7;color:#41546f;">Share this code during checkout or with customer care to unlock referral promotions. Admins can validate and apply this code later from the promotions manager.</div>
                </div>
              </td>
            </tr>
          ` : ""}
          <tr>
            <td style="padding:0 24px 28px;">
              <p style="margin:0;font-size:14px;line-height:1.7;color:#41546f;">If you have any questions, just reply to this email or call ${escapeHtml(context.branchPhone)}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background:#f7fafc;border-top:1px solid #d9e1ec;font-size:13px;color:#5c6b80;line-height:1.7;">
              <strong style="color:#10233f;">SmarTouch Clean</strong><br />
              ${escapeHtml(context.branchEmail)}<br />
              ${escapeHtml(context.branchPhone)}<br />
              ${escapeHtml(context.website)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Minimal, plain-document HTML — mirrors the pdfkit-rendered PDF exactly
// (same rows, same section order) so the on-screen "preview" and the actual
// downloaded/emailed PDF never look like two different documents. Modelled
// on a clean, single-page invoice layout: thin rules instead of boxes/fills,
// plain label/value pairs, one flat line-items table.
export function buildBookingDocumentHtml(booking = {}, options = {}) {
    const context = getBookingDocumentContext(booking, options);
    const {
        company, documentLabel, documentNumber, logoUrl, clientDisplay,
        billingAddress, serviceAddress, branchPhone, branchEmail, website,
        businessNumber, noteText, documentCopy, issueDate, validUntil, paymentDue
    } = context;

    const isMoneyDoc = documentLabel === "Invoice" || documentLabel === "Receipt";
    const showServiceAddressBlock = !billingAddress.sameAsService || documentLabel !== "Invoice" && documentLabel !== "Receipt";

    const metaRows = documentLabel === "Estimate"
        ? [[`${documentLabel} number`, documentNumber], ["Date of issue", issueDate], ["Valid until", validUntil]]
        : documentLabel === "Invoice"
            ? [[`${documentLabel} number`, documentNumber], ["Date of issue", issueDate], ["Date due", paymentDue]]
            : documentLabel === "Receipt"
                ? [[`${documentLabel} number`, documentNumber], ["Date of issue", issueDate], ["Payment received", formatDate(booking.date)]]
                : [[`${documentLabel} number`, documentNumber], ["Date of issue", issueDate], ["Service date", formatDate(booking.date)]];

    const calloutLine = documentLabel === "Invoice"
        ? `${formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts)} due ${paymentDue}`
        : documentLabel === "Receipt"
            ? `${formatMoney(context.pricing.total)} paid in full`
            : documentLabel === "Estimate"
                ? `Estimated total: ${formatMoney(context.pricing.subtotalAfterDiscounts)}`
                : `Total: ${formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts)}`;

    // "Amount due" implies a fixed, payable-now obligation — correct for an
    // Invoice, but wrong for an Estimate/Booking: showTaxAmount is false for
    // both (see the "* HST added at time of invoicing" line above), so the
    // figure here doesn't even include tax yet and nothing is actually owed
    // at this stage.
    const totalLabel = documentLabel === "Receipt"
        ? "Amount paid"
        : documentLabel === "Estimate"
            ? "Estimated Total"
            : documentLabel === "Booking"
                ? "Booking Total"
                : "Amount due";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(company.companyName || "SmarTouch Clean")} ${escapeHtml(documentLabel)}</title>
  <style>
    @page { size: A4 portrait; margin: 0.6in; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: #f4f6f8; margin: 0; padding: 16px; color: #1a2942; }
    .page { width: 100%; max-width: 794px; margin: auto; background: #fff; padding: 0 0 20px; }
    .accent-bar { height: 6px; background: #0b2f5e; margin-bottom: 26px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .doc-title { font-size: 28px; font-weight: 800; color: #1a2942; margin: 0 0 10px; }
    .logo { width: 90px; height: auto; }
    .meta-row { display: flex; gap: 8px; font-size: 12.5px; margin-bottom: 3px; }
    .meta-row .label { font-weight: 700; width: 130px; flex-shrink: 0; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 22px 0; }
    .col-title { font-weight: 700; font-size: 12.5px; margin-bottom: 6px; }
    .col p { margin: 0 0 2px; font-size: 12.5px; line-height: 1.5; color: #1a2942; }
    .service-line { font-size: 12px; color: #5a6b81; margin: 14px 0 22px; }
    .callout { font-size: 18px; font-weight: 800; margin: 18px 0 6px; }
    .pay-link { color: #0b2f5e; font-size: 13px; text-decoration: underline; margin-bottom: 14px; display: inline-block; }
    .payment-method { font-size: 12.5px; line-height: 1.7; margin: 14px 0 22px; color: #1a2942; }
    .payment-method .fine { color: #5a6b81; font-size: 11px; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    table.items th { text-align: left; font-size: 11.5px; font-weight: 700; color: #5a6b81; padding: 0 8px 8px 0; border-bottom: 1px solid #dde3ea; }
    table.items th.num, table.items td.num { text-align: right; }
    table.items td { font-size: 12.5px; padding: 10px 8px 10px 0; border-bottom: 1px solid #eef1f5; vertical-align: top; }
    .totals { width: 320px; margin-left: auto; margin-top: 14px; font-size: 12.5px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals-row.bold { font-weight: 700; }
    .totals-row.rule { border-top: 1px solid #dde3ea; margin-top: 4px; padding-top: 9px; }
    .notes { margin-top: 26px; font-size: 12px; color: #5a6b81; line-height: 1.6; }
    .notes strong { color: #1a2942; }
    .terms { margin-top: 14px; font-size: 10.5px; color: #8a94a3; line-height: 1.6; text-align: justify; }
    .legal-links { margin-top: 10px; font-size: 10.5px; color: #8a94a3; line-height: 1.6; }
    .legal-links a { color: #0b2f5e; text-decoration: underline; }
    .signature { margin-top: 30px; display: flex; gap: 60px; }
    .signature .line { border-top: 1px solid #8a94a3; width: 200px; padding-top: 6px; font-size: 11px; color: #5a6b81; }
    .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #dde3ea; text-align: center; font-size: 11.5px; color: #5a6b81; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { max-width: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="accent-bar"></div>
    <div class="header">
      <div class="doc-title">${escapeHtml(documentLabel)}</div>
      <img src="${escapeHtml(logoUrl)}" class="logo" alt="SmarTouch Clean" />
    </div>

    ${metaRows.map(([label, value]) => `<div class="meta-row"><span class="label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join("")}

    <div class="cols">
      <div class="col">
        <div class="col-title">${escapeHtml(company.companyName || "SmarTouch Clean")}</div>
        <p>${escapeHtml(company.branchAddress || "214 Viewmount Drive, Nepean, Ontario K2E 7X2")}</p>
        <p>Canada</p>
        <p>${escapeHtml(branchPhone)}</p>
        ${isMoneyDoc ? `<p>CA GST/HST ${escapeHtml(businessNumber)}</p>` : ""}
      </div>
      <div class="col">
        <div class="col-title">Bill to</div>
        <p>${escapeHtml(context.clientName)}</p>
        <p>${escapeHtml(billingAddress.line1 || "Address Pending")}</p>
        <p>${escapeHtml(billingAddress.line2)}</p>
        <p>${escapeHtml(billingAddress.country)}</p>
        <p>${escapeHtml(booking.phone || "")}</p>
        <p>${escapeHtml(booking.email || "")}</p>
      </div>
    </div>

    ${!billingAddress.sameAsService ? `
      <div class="service-line">
        <strong>Service address:</strong> ${escapeHtml(serviceAddress.line1 || "Address Pending")}, ${escapeHtml(serviceAddress.line2)}
        &nbsp;·&nbsp; ${escapeHtml(formatDate(booking.date))}${booking.time ? `, ${escapeHtml(booking.time)}` : ""}${context.shiftText ? ` (${escapeHtml(context.shiftText)})` : ""} &nbsp;·&nbsp; ${escapeHtml(context.frequencyText)}
      </div>
    ` : `
      <div class="service-line">
        <strong>Service date:</strong> ${escapeHtml(formatDate(booking.date))}${booking.time ? `, ${escapeHtml(booking.time)}` : ""}${context.shiftText ? ` (${escapeHtml(context.shiftText)})` : ""} &nbsp;·&nbsp; ${escapeHtml(context.frequencyText)}
      </div>
    `}

    <div class="callout">${escapeHtml(calloutLine)}</div>

    ${isMoneyDoc && booking.customerPortalUrl ? `<a class="pay-link" href="${escapeHtml(booking.customerPortalUrl)}">Pay online</a>` : ""}

    ${isMoneyDoc ? `
      <div class="payment-method">
        <strong>PAYMENT METHOD:</strong><br />
        E-transfer: ${escapeHtml(branchEmail)}<br />
        Bank transfer: Request banking instructions by email.<br />
        Credit card: Request a secure payment link by email.<br />
        <span class="fine">Please do not send credit card details by email.</span>
      </div>
    ` : ""}

    <table class="items">
      <thead>
        <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Tax</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>
        ${context.lineItems.map((row) => `
          <tr>
            <td>${escapeHtml(row.description)}</td>
            <td class="num">${row.qty}</td>
            <td class="num">${formatMoney(row.unitPrice)}</td>
            <td class="num">${row.taxPercent}%</td>
            <td class="num">${formatMoney(row.amount)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatMoney(context.pricing.subtotal)}</span></div>
      ${context.pricing.fixedDiscount > 0 ? `<div class="totals-row"><span>Discount (fixed)</span><span>-${formatMoney(context.pricing.fixedDiscount)}</span></div>` : ""}
      ${context.pricing.percentDiscountValue > 0 ? `<div class="totals-row"><span>Discount (${booking.customDiscountPercent || ""}%)</span><span>-${formatMoney(context.pricing.percentDiscountValue)}</span></div>` : ""}
      ${context.pricing.promoCode && context.pricing.promoDiscount > 0 ? `<div class="totals-row"><span>${escapeHtml(context.pricing.promoName || "Promo")} (${escapeHtml(context.pricing.promoCode)})</span><span>-${formatMoney(context.pricing.promoDiscount)}</span></div>` : ""}
      <div class="totals-row rule"><span>Total excluding tax</span><span>${formatMoney(context.pricing.subtotalAfterDiscounts)}</span></div>
      ${context.pricing.showTaxAmount ? `
        <div class="totals-row"><span>${escapeHtml(context.pricing.taxLabel)} (${context.pricing.taxRatePercent}% on ${formatMoney(context.pricing.subtotalAfterDiscounts)})</span><span>${formatMoney(context.pricing.taxAmount)}</span></div>
        <div class="totals-row rule"><span>Total</span><span>${formatMoney(context.pricing.total)}</span></div>
      ` : `
        <div class="totals-row" style="font-style:italic;color:#8a94a3;font-size:11px;"><span>* ${escapeHtml(context.pricing.taxLabel)} (${context.pricing.taxRatePercent}%) added at time of invoicing</span></div>
      `}
      <div class="totals-row bold"><span>${totalLabel}</span><span>${formatMoney(context.pricing.showTaxAmount ? context.pricing.total : context.pricing.subtotalAfterDiscounts)}</span></div>
    </div>

    <div class="notes">
      <strong>${escapeHtml(documentCopy.notesTitle)}:</strong> ${escapeHtml(noteText)}
    </div>
    <div class="terms">
      ${getDocumentTerms(documentCopy, documentLabel).join(" &nbsp;·&nbsp; ")}
    </div>
    <div class="legal-links">
      By accepting this ${escapeHtml(documentLabel.toLowerCase())} and receiving the service, you agree to our
      <a href="${PRIVACY_POLICY_URL}">Privacy Policy</a> and <a href="${TERMS_OF_SERVICE_URL}">Terms of Service</a>.
    </div>

    ${documentLabel === "Estimate" ? `
      <div class="signature">
        <div class="line">Client Signature</div>
        <div class="line">Date</div>
      </div>
    ` : ""}

    <div class="footer">${escapeHtml(branchPhone)} &nbsp;|&nbsp; ${escapeHtml(branchEmail)} &nbsp;|&nbsp; ${escapeHtml(website)}</div>
  </div>
</body>
</html>`;
}
