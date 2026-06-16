export function getBookingDocumentLabel(booking = {}) {
    if (booking.documentStage === "invoice" || booking.invoiceNumber) return "Invoice";
    if (booking.documentStage === "estimate") return "Estimate";
    return ["Lead", "Follow Up", "Pending"].includes(booking.status) ? "Estimate" : "Booking";
}

export function getBookingDocumentNumber(booking = {}) {
    return booking.invoiceNumber || booking.estimateNumber || booking.orderNumber || "Pending";
}

export function buildBookingDocumentHtml(booking = {}) {
    const documentLabel = getBookingDocumentLabel(booking);
    const documentNumber = getBookingDocumentNumber(booking);
    const company = booking.companySnapshot || {};
    const items = Array.isArray(booking.cartItems) ? booking.cartItems : [];
    const subtotal = Number(booking.subtotal || 0);
    const tax = Number(booking.tax || 0);
    const total = Number(booking.price || 0);
    const discount = Number(booking.customDiscountAmount || 0);
    const assigned = Array.isArray(booking.assignedStaff) && booking.assignedStaff.length
        ? booking.assignedStaff.map((member) => member.name).join(", ")
        : "Unassigned";
    const fullAddress = [
        booking.address1,
        booking.address2,
        [booking.city, booking.state, booking.postalCode].filter(Boolean).join(", "),
        booking.country
    ].filter(Boolean).join("<br />");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${documentLabel} ${documentNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 32px; background: #f8fafc; }
    .sheet { max-width: 960px; margin: 0 auto; background: #ffffff; border: 1px solid #dbeafe; border-radius: 24px; padding: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .brand h1 { margin: 0; font-size: 32px; color: #00327d; }
    .brand p, .meta p, .block p { margin: 6px 0; font-size: 14px; }
    .meta { text-align: right; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 24px; }
    .block { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; background: #fff; }
    .block h2 { margin: 0 0 12px; font-size: 16px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; vertical-align: top; }
    th { color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 0.06em; }
    .totals { margin-top: 24px; margin-left: auto; width: min(100%, 340px); }
    .totals-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; }
    .totals-row.total { border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #00327d; }
    .footer { margin-top: 28px; font-size: 13px; color: #475569; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <h1>${company.companyName || "SmarTouch Clean"}</h1>
        <p>${company.branchName || booking.branchName || ""}</p>
        <p>${company.branchEmail || ""}</p>
        <p>${company.branchPhone || ""}</p>
      </div>
      <div class="meta">
        <p><strong>${documentLabel}</strong></p>
        <p>${documentNumber}</p>
        <p>Status: ${booking.status || "Pending"}</p>
        <p>Payment: ${booking.paymentStatus || "unpaid"}</p>
        <p>Date: ${booking.date || "TBD"} ${booking.time || ""}</p>
      </div>
    </div>

    <div class="grid">
      <div class="block">
        <h2>Client</h2>
        <p>${booking.clientName || `${booking.firstName || ""} ${booking.lastName || ""}`.trim()}</p>
        <p>${booking.phone || ""}</p>
        <p>${booking.email || ""}</p>
      </div>
      <div class="block">
        <h2>Service Address</h2>
        <p>${fullAddress || "Not provided"}</p>
      </div>
      <div class="block">
        <h2>Booking Details</h2>
        <p>Service: ${booking.service || "Cleaning service"}</p>
        <p>Frequency: ${booking.frequency || "One-Time"}</p>
        <p>Estimated Duration: ${booking.duration || 0} hours</p>
      </div>
      <div class="block">
        <h2>Assigned Staff</h2>
        <p>${assigned}</p>
        <p>Notes: ${booking.specialNotes || "None"}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Description</th>
          <th style="text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.length
            ? items.map((item) => `
              <tr>
                <td>${item.name || "Service"}</td>
                <td>${[item.optionName, item.bathroomKey].filter(Boolean).join(" • ") || "Configured service"}</td>
                <td style="text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
              </tr>
            `).join("")
            : `
              <tr>
                <td>${booking.service || "Service"}</td>
                <td>${booking.frequency || "One-Time"} • ${booking.duration || 0} hours</td>
                <td style="text-align:right;">$${total.toFixed(2)}</td>
              </tr>
            `
        }
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><strong>$${subtotal.toFixed(2)}</strong></div>
      <div class="totals-row"><span>${company.taxLabel || booking.taxLabel || "Tax"}</span><strong>$${tax.toFixed(2)}</strong></div>
      <div class="totals-row"><span>Discount</span><strong>-$${discount.toFixed(2)}</strong></div>
      <div class="totals-row total"><span>Total</span><strong>$${total.toFixed(2)}</strong></div>
    </div>

    <div class="footer">
      <p>This ${documentLabel.toLowerCase()} was generated by SmarTouch Clean.</p>
    </div>
  </div>
</body>
</html>`;
}
