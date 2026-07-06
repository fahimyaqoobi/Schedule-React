// Single source of truth for turning a subtotal + discounts into a final
// tax/total. Every surface that shows or saves a booking's price — checkout,
// edit booking, the bookings table, PDFs, emails — must call this same
// function so the numbers agree everywhere. Do not reimplement this math
// anywhere else.
//
// Order of operations: manual discounts (fixed $ + %) and the promo discount
// all reduce the subtotal FIRST, then tax is calculated on what's left. This
// is the correct order for HST/GST (tax is owed on the amount actually paid,
// not the pre-discount list price) and matches how invoices/receipts must
// read to a customer.
export function computeBookingPricing({
    subtotal = 0,
    customDiscountAmount = 0,
    customDiscountPercent = 0,
    promoDiscount = 0,
    taxRate = 0
} = {}) {
    const sub = Math.max(0, Number(subtotal) || 0);
    const fixedDiscount = Math.max(0, Number(customDiscountAmount) || 0);
    const percentDiscountValue = sub * (Math.max(0, Number(customDiscountPercent) || 0) / 100);
    const manualDiscount = Math.min(sub, fixedDiscount + percentDiscountValue);
    const promo = Math.max(0, Number(promoDiscount) || 0);
    const totalDiscount = Math.min(sub, manualDiscount + promo);
    const subtotalAfterDiscounts = Math.max(0, sub - totalDiscount);
    const rate = Math.max(0, Number(taxRate) || 0);
    const taxAmount = subtotalAfterDiscounts * rate;
    const total = subtotalAfterDiscounts + taxAmount;

    return {
        subtotal: sub,
        fixedDiscount,
        percentDiscountValue,
        manualDiscount,
        promoDiscount: promo,
        totalDiscount,
        subtotalAfterDiscounts,
        taxAmount,
        total
    };
}
