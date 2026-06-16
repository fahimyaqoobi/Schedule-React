export function getBookingDocumentLabel(booking = {}) {
    if (booking.documentStage === "invoice" || booking.invoiceNumber) return "Invoice";
    if (booking.documentStage === "estimate") return "Estimate";
    return ["Lead", "Follow Up", "Pending"].includes(booking.status) ? "Estimate" : "Booking";
}

export function getBookingDocumentNumber(booking = {}) {
    return booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "Pending";
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

function buildServiceRows(booking = {}) {
    const items = Array.isArray(booking.cartItems) ? booking.cartItems : [];
    if (!items.length) {
        return `
            <tr>
              <td class="num">01</td>
              <td><strong>${escapeHtml(booking.service || "Cleaning Service")}</strong></td>
              <td>${escapeHtml([booking.frequency || "One-Time", `${booking.duration || 0} Hours`].join(" • "))}</td>
              <td class="amount">${formatMoney(booking.subtotal || booking.price || 0)}</td>
            </tr>
        `;
    }

    return items.map((item, index) => {
        const itemName = item.name || "Service";
        const detailBase = [item.optionName, item.bathroomKey].filter(Boolean).join(" • ") || "Included";
        const included = Number(item.price || 0) <= 0;
        const amountLabel = included ? "Included" : formatMoney(item.price || 0);
        const amountClass = included ? "amount green" : "amount";
        return `
            <tr>
              <td class="num">${String(index + 1).padStart(2, "0")}</td>
              <td><strong>${escapeHtml(itemName)}</strong></td>
              <td>${escapeHtml(detailBase)}</td>
              <td class="${amountClass}">${amountLabel}</td>
            </tr>
        `;
    }).join("");
}

export function buildBookingDocumentHtml(booking = {}, options = {}) {
    const company = booking.companySnapshot || {};
    const documentLabel = getBookingDocumentLabel(booking);
    const documentNumber = getBookingDocumentNumber(booking);
    const logoUrl = options.logoUrl || company.logoUrl || "/logo.png";
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

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(company.companyName || "SmarTouch Clean")} ${escapeHtml(documentLabel)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 30px;
      color: #071b3a;
    }

    .page {
      width: 850px;
      margin: auto;
      background: #fff;
      padding: 55px 60px 35px;
      border: 1px solid #ddd;
    }

    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #d6dce3;
      padding-bottom: 25px;
      gap: 40px;
    }

    .logo {
      width: 240px;
      max-width: 100%;
      display: block;
      margin-bottom: 26px;
    }

    .estimate-title {
      font-size: 28px;
      letter-spacing: 3px;
      color: #062b63;
      font-weight: 800;
      margin-bottom: 20px;
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
      grid-template-columns: 130px 1fr;
      gap: 10px;
      font-size: 14px;
    }

    .blue { color: #063d8f; font-weight: 700; }
    .green { color: #4b9d2f; font-weight: 700; }

    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      padding: 40px 0 25px;
      align-items: stretch;
    }

    .info-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 18px;
      align-items: flex-start;
    }

    .info-card + .info-card {
      border-left: 1px solid #d6dce3;
      padding-left: 40px;
    }

    .icon {
      width: 55px;
      height: 55px;
      border: 1px solid #0a3b85;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
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
      font-size: 20px;
      font-weight: 700;
    }

    .services-title {
      color: #063d8f;
      font-weight: 800;
      margin: 20px 0 12px;
      font-size: 16px;
      letter-spacing: .5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 35px;
      border: 1px solid #d8dde4;
      border-radius: 8px;
      overflow: hidden;
    }

    th {
      background: #062b63;
      color: #fff;
      text-align: left;
      padding: 14px;
      font-size: 13px;
      text-transform: uppercase;
    }

    td {
      padding: 18px 14px;
      border-bottom: 1px solid #dde2e8;
      font-size: 15px;
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

    .main-bottom {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 70px;
      margin-top: 10px;
      align-items: start;
    }

    .promo {
      background: #eef7e9;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      gap: 15px;
      align-items: center;
      max-width: 310px;
    }

    .promo-icon {
      width: 55px;
      height: 55px;
      border: 1px solid #5ba531;
      border-radius: 50%;
      color: #5ba531;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 25px;
      flex-shrink: 0;
    }

    .promo p {
      margin: 8px 0 0;
      line-height: 1.45;
    }

    .totals {
      font-size: 15px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }

    .total-box {
      background: #062b63;
      color: #fff;
      padding: 18px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 5px;
      font-size: 25px;
      font-weight: 800;
      margin-top: 12px;
    }

    .terms-note {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 35px;
      font-size: 13px;
      line-height: 1.55;
    }

    ul {
      padding-left: 18px;
      margin: 0;
    }

    li {
      margin-bottom: 6px;
    }

    li::marker {
      color: #5ba531;
    }

    .signature {
      margin-top: 45px;
    }

    .signature-line {
      border-bottom: 1px solid #333;
      height: 25px;
      margin-bottom: 8px;
    }

    .footer {
      margin-top: 35px;
      padding-top: 20px;
      border-top: 2px solid #5ba531;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 25px;
      font-size: 13px;
      align-items: center;
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
      font-size: 16px;
      color: #071b3a;
    }

    .contact-line {
      margin: 10px 0;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      .page {
        width: auto;
        border: none;
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
        ${buildServiceRows(booking)}
      </tbody>
    </table>

    <div class="main-bottom">
      <div class="promo">
        <div class="promo-icon">🏷</div>
        <div>
          <strong class="green">REFER &amp; SAVE</strong>
          <p>Refer a friend and you both get <strong>$30 OFF</strong> your next cleaning service.</p>
        </div>
      </div>

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></div>
        <div class="totals-row"><span>${escapeHtml(company.taxLabel || booking.taxLabel || "HST")} (${taxRatePercent}%)</span><strong>${formatMoney(tax)}</strong></div>
        <div class="total-box">
          <span>TOTAL</span>
          <span>${formatMoney(total)}</span>
        </div>
      </div>
    </div>

    <div class="terms-note">
      <div>
        <div class="section-title">TERMS &amp; CONDITIONS</div>
        <ul>
          <li>This ${documentLabel.toLowerCase()} is valid for 30 days from the date above.</li>
          <li>Services will be scheduled upon acceptance of this ${documentLabel.toLowerCase()}.</li>
          <li>Payment is due upon completion of the service.</li>
          <li>Cancellations must be made at least 24 hours in advance.</li>
          <li>Prices do not include tips or gratuities.</li>
          <li>We are not responsible for pre-existing damage or issues beyond our control.</li>
        </ul>
      </div>

      <div>
        <div class="section-title">NOTE</div>
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
