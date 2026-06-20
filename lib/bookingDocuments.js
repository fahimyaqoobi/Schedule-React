import { generateReferralCode, getDocumentPromotions } from "./promotions";
import { getDocumentTerms, normalizeDocumentCopy } from "./documentCopy";

export function getBookingDocumentLabel(booking = {}) {
    if (booking.documentStage === "receipt" || booking.receiptNumber) return "Receipt";
    if (booking.documentStage === "invoice" || booking.invoiceNumber) return "Invoice";
    if (booking.documentStage === "estimate") return "Estimate";
    return ["Lead", "Follow Up", "Pending"].includes(booking.status) ? "Estimate" : "Booking";
}

export function getBookingDocumentNumber(booking = {}) {
    return booking.receiptNumber || booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "Pending";
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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
    const tax = Number(booking.tax || 0);
    const fixedDiscount = Number(booking.customDiscountAmount || 0);
    const percentDiscountValue = subtotal * (Number(booking.customDiscountPercent || 0) / 100);
    const totalDiscount = Math.min(subtotal, fixedDiscount + percentDiscountValue);
    const total = Number(booking.price || Math.max(0, subtotal + tax - totalDiscount));

    return {
        services,
        subtotal,
        tax,
        total,
        fixedDiscount,
        percentDiscountValue,
        totalDiscount,
        promoCode: booking.promoCode || "",
        promoName: booking.promoName || "",
        promoDiscount: Number(booking.promoDiscount || 0),
        giftCardCode: booking.giftCardCode || "",
        taxLabel: company.taxLabel || booking.taxLabel || "HST",
        taxRatePercent: Math.round(Number(booking.taxRate || company.taxRate || 0.13) * 100)
    };
}

function buildServiceRows(booking = {}, company = {}) {
    const breakdown = buildDocumentPricingBreakdown(booking, company);
    return breakdown.services.map((item) => {
        const addonMarkup = item.addonLines.map((addon) => `
            <div class="service-breakdown-line">
              <span>Add-on: ${escapeHtml(addon.name)}${addon.qty > 1 ? ` x${addon.qty}` : ""}</span>
              <strong>${formatMoney(addon.total)}</strong>
            </div>
        `).join("");
        return `
            <tr>
              <td class="num">${String(item.index).padStart(2, "0")}</td>
              <td>
                <strong>${escapeHtml(item.name)}</strong>
                <div class="service-breakdown-meta">${escapeHtml(item.details)}</div>
                <div class="service-breakdown-line">
                  <span>Base service</span>
                  <strong>${formatMoney(item.baseAmount)}</strong>
                </div>
                ${addonMarkup || `<div class="service-breakdown-line"><span>Add-ons</span><strong>${formatMoney(0)}</strong></div>`}
              </td>
              <td>${escapeHtml(`${item.durationHrs ? `${item.durationHrs} hrs` : ""}` || "Included")}</td>
              <td class="amount">${formatMoney(item.total)}</td>
            </tr>
        `;
    }).join("");
}

function getDocumentContext(booking = {}, options = {}) {
    const company = booking.companySnapshot || {};
    const documentLabel = getBookingDocumentLabel(booking);
    const documentNumber = getBookingDocumentNumber(booking);
    const logoUrl = options.logoUrl || company.logoUrl || "/logo-full.png";
    const clientName = booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Client";
    const clientDisplay = clientName.split(" ").filter(Boolean)[0] || clientName;
    const addressLine1 = [booking.address1, booking.address2].filter(Boolean).join(", ");
    const addressLine2 = [booking.city, booking.state, booking.postalCode].filter(Boolean).filter(Boolean).join(", ");
    const subtotal = Number(booking.subtotal || booking.price || 0);
    const tax = Number(booking.tax || 0);
    const total = Number(booking.price || 0);
    const validUntil = getValidUntilDate(booking.date);
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
    const documentPromotions = getDocumentPromotions(company.promotions ?? booking.promotions ?? []);

    return {
        company,
        documentLabel,
        documentNumber,
        logoUrl,
        clientName,
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
        documentCopy,
        noteText,
        customerPortalUrl,
        referralCode,
        pricing,
        documentPromotions
    };
}

export function buildBookingEmailHtml(booking = {}, options = {}) {
    const context = getDocumentContext(booking, options);
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
                  <td style="width:50%;padding:14px 16px;border:1px solid #d9e1ec;border-radius:14px;background:#f8fbff;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0b3d91;text-transform:uppercase;margin-bottom:8px;">Status</div>
                    <div style="font-size:18px;font-weight:700;color:#10233f;">${escapeHtml(booking.status || "Pending")}</div>
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

export function buildBookingDocumentHtml(booking = {}, options = {}) {
    const context = getDocumentContext(booking, options);
    const {
        company,
        documentLabel,
        documentNumber,
        logoUrl,
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
        documentCopy,
        customerPortalUrl,
        referralCode,
        documentPromotions
    } = context;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(company.companyName || "SmarTouch Clean")} ${escapeHtml(documentLabel)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0.5in;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 16px;
      color: #071b3a;
    }

    .page {
      width: 100%;
      max-width: 794px;
      margin: auto;
      background: #fff;
      padding: 28px 30px 24px;
      border: 1px solid #ddd;
      page-break-after: avoid;
      page-break-inside: avoid;
    }

    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #d6dce3;
      padding-bottom: 16px;
      gap: 28px;
    }

    .logo {
      width: 205px;
      max-width: 100%;
      display: block;
      margin-bottom: 18px;
    }

    .estimate-title {
      font-size: 24px;
      letter-spacing: 2px;
      color: #062b63;
      font-weight: 800;
      margin-bottom: 14px;
      text-align: right;
      text-transform: uppercase;
    }

    .title-line {
      height: 3px;
      background: linear-gradient(to right, #5ba531 25%, #bfc5ca 25%);
      margin-bottom: 15px;
    }

    .details {
      display: grid;
      grid-template-columns: 118px 1fr;
      gap: 8px;
      font-size: 13px;
    }

    .blue { color: #063d8f; font-weight: 700; }
    .green { color: #4b9d2f; font-weight: 700; }

    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
      padding: 24px 0 18px;
      align-items: stretch;
    }

    .info-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 14px;
      align-items: flex-start;
    }

    .info-card + .info-card {
      border-left: 1px solid #d6dce3;
      padding-left: 26px;
    }

    .icon {
      width: 48px;
      height: 48px;
      border: 1px solid #0a3b85;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      color: #0a3b85;
      box-sizing: border-box;
    }

    .section-title {
      color: #063d8f;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .5px;
      margin-bottom: 12px;
    }

    h3 {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 700;
    }

    .services-title {
      color: #063d8f;
      font-weight: 800;
      margin: 14px 0 10px;
      font-size: 15px;
      letter-spacing: .5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      border: 1px solid #d8dde4;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    th {
      background: #062b63;
      color: #fff;
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      text-transform: uppercase;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #dde2e8;
      font-size: 13px;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .num {
      width: 60px;
      color: #063d8f;
      font-weight: 700;
      text-align: center;
    }

    .amount {
      text-align: right;
      font-weight: 700;
      color: #063d8f;
    }

    .service-breakdown-meta {
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
    }

    .service-breakdown-line {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-top: 6px;
      color: #334155;
      font-size: 12px;
    }

    .service-breakdown-line strong {
      white-space: nowrap;
      color: #063d8f;
      font-size: 12px;
    }

    .main-bottom {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 34px;
      margin-top: 6px;
      align-items: start;
      page-break-inside: avoid;
    }

    .promo {
      background: #eef7e9;
      border-radius: 8px;
      padding: 14px;
      display: flex;
      gap: 12px;
      align-items: center;
      max-width: 285px;
    }

    .promo-icon {
      width: 46px;
      height: 46px;
      border: 1px solid #5ba531;
      border-radius: 50%;
      color: #5ba531;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .promo p {
      margin: 6px 0 0;
      line-height: 1.35;
      font-size: 12px;
    }

    .promo-code {
      margin-top: 8px;
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid #cfe3bf;
      color: #2f6e1e;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
    }

    .portal-cta {
      margin: 18px 0 8px;
      padding: 16px 18px;
      border: 1px solid #d7e0ea;
      border-radius: 10px;
      background: #f8fbff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      page-break-inside: avoid;
    }

    .portal-cta a {
      display: inline-block;
      padding: 11px 16px;
      border-radius: 999px;
      background: #062b63;
      color: #ffffff;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }

    .totals {
      font-size: 14px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .total-box {
      background: #062b63;
      color: #fff;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 5px;
      font-size: 22px;
      font-weight: 800;
      margin-top: 8px;
    }

    .terms-note {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 22px;
      font-size: 12px;
      line-height: 1.4;
      page-break-inside: avoid;
    }

    ul {
      padding-left: 18px;
      margin: 0;
    }

    li {
      margin-bottom: 4px;
    }

    li::marker {
      color: #5ba531;
    }

    .signature {
      margin-top: 24px;
    }

    .signature-line {
      border-bottom: 1px solid #333;
      height: 18px;
      margin-bottom: 6px;
    }

    .footer {
      margin-top: 22px;
      padding-top: 14px;
      border-top: 2px solid #5ba531;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 18px;
      font-size: 12px;
      align-items: center;
      page-break-inside: avoid;
    }

    .footer-center {
      text-align: center;
      border-left: 1px solid #d8dde4;
      border-right: 1px solid #d8dde4;
      padding: 0 20px;
    }

    .footer-center p {
      margin: 8px 0;
    }

    .hst {
      text-align: right;
    }

    .hst strong {
      font-size: 15px;
      color: #071b3a;
    }

    .contact-line {
      margin: 6px 0;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        width: 100%;
        max-width: none;
        border: none;
        padding: 0;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <img src="${escapeHtml(logoUrl)}" class="logo" alt="SmarTouch Clean" />
        <p>${escapeHtml(company.branchName || booking.branchName || "Ottawa")}</p>
        <p>${escapeHtml(branchEmail)}</p>
      </div>

      <div>
        <div class="estimate-title">${escapeHtml(documentLabel)}</div>
        <div class="title-line"></div>

        <div class="details">
          <strong>${escapeHtml(documentLabel)} #:</strong><span class="blue">${escapeHtml(documentNumber)}</span>
          <strong>Date:</strong><span>${escapeHtml(formatDate(booking.date))}</span>
          <strong>Status:</strong><span class="${getStatusClass(booking.status)}">${escapeHtml(booking.status || "Pending")}</span>
          <strong>Payment:</strong><span class="${getStatusClass(booking.paymentStatus)}">${escapeHtml((booking.paymentStatus || "unpaid").replace(/^./, (m) => m.toUpperCase()))}</span>
          <strong>Valid Until:</strong><span>${escapeHtml(validUntil ? `${validUntil} (30 Days)` : "30 Days from issue")}</span>
        </div>
      </div>
    </div>

    <div class="info-section">
      <div class="info-card">
        <div class="icon">👤</div>
        <div>
          <div class="section-title">CLIENT</div>
          <h3>${escapeHtml(clientDisplay)}</h3>
          <p>${escapeHtml(booking.phone || "")}</p>
          <p>${escapeHtml(booking.email || "")}</p>
        </div>
      </div>

      <div class="info-card">
        <div class="icon">📍</div>
        <div>
          <div class="section-title">SERVICE ADDRESS</div>
          <h3>${escapeHtml(addressLine1 || booking.address1 || "Address Pending")}</h3>
          <p>${escapeHtml(addressLine2 || "Ottawa, ON")}</p>
        </div>
      </div>
    </div>

    <div class="services-title">SERVICES</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Details</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${buildServiceRows(booking, company)}
      </tbody>
    </table>

    ${customerPortalUrl ? `
      <div class="portal-cta">
        <div>
          <div class="section-title">CUSTOMER LOGIN / SIGN UP</div>
          <p>Use the phone number on file to confirm this ${escapeHtml(documentLabel.toLowerCase())} and access your customer portal.</p>
        </div>
        <a href="${escapeHtml(customerPortalUrl)}">Open Portal</a>
      </div>
    ` : ""}

    <div class="main-bottom">
      ${documentPromotions.length ? `
        <div class="promo">
          <div class="promo-icon">🏷</div>
          <div>
            <strong class="green">REFER &amp; SAVE</strong>
            <p>Refer a friend and ask customer care about active referral promotions.</p>
            <div class="promo-code">${escapeHtml(referralCode)}</div>
          </div>
        </div>
      ` : ""}

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><strong>${formatMoney(context.pricing.subtotal)}</strong></div>
        <div class="totals-row"><span>${escapeHtml(context.pricing.taxLabel)} (${context.pricing.taxRatePercent}%)</span><strong>${formatMoney(context.pricing.tax)}</strong></div>
        ${context.pricing.promoCode ? `<div class="totals-row"><span>Promo Code</span><strong>${escapeHtml(context.pricing.promoCode)}</strong></div>` : ""}
        ${context.pricing.giftCardCode ? `<div class="totals-row"><span>Gift Card</span><strong>${escapeHtml(context.pricing.giftCardCode)}</strong></div>` : ""}
        ${context.pricing.fixedDiscount > 0 ? `<div class="totals-row"><span>Manual Discount ($)</span><strong>-${formatMoney(context.pricing.fixedDiscount).replace("$", "")}</strong></div>` : ""}
        ${context.pricing.percentDiscountValue > 0 ? `<div class="totals-row"><span>Manual Discount (%)</span><strong>-${formatMoney(context.pricing.percentDiscountValue).replace("$", "")}</strong></div>` : ""}
        ${context.pricing.totalDiscount > 0 ? `<div class="totals-row"><span>Total Discounts</span><strong>-${formatMoney(context.pricing.totalDiscount).replace("$", "")}</strong></div>` : ""}
        <div class="total-box">
          <span>TOTAL</span>
          <span>${formatMoney(context.pricing.total)}</span>
        </div>
      </div>
    </div>

    <div class="terms-note">
      <div>
        <div class="section-title">${escapeHtml(documentCopy.termsTitle)}</div>
        <ul>
          ${getDocumentTerms(documentCopy, documentLabel).map((term) => `<li>${escapeHtml(term)}</li>`).join("")}
        </ul>
      </div>

      <div>
        <div class="section-title">${escapeHtml(documentCopy.notesTitle)}</div>
        <p>${escapeHtml(noteText)}</p>

        <div class="signature">
          <div class="signature-line"></div>
          <small>Client Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date</small>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>
        <p class="contact-line">☎ ${escapeHtml(branchPhone)}</p>
        <p class="contact-line">✉ ${escapeHtml(branchEmail)}</p>
        <p class="contact-line">🌐 ${escapeHtml(website)}</p>
      </div>

      <div class="footer-center">
        <strong>${escapeHtml(company.companyName || "SmarTouch Clean")}</strong>
        <p>Professional Residential &amp; Commercial Cleaning Services</p>
        <p class="green">Fully Insured • Quality Guaranteed</p>
      </div>

      <div class="hst">
        <p class="green">Business Number (HST):</p>
        <strong>${escapeHtml(businessNumber)}</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}
