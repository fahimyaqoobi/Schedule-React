import { applyPromotion, ensurePromotionList } from "./promotions";

export { applyPromotion, ensurePromotionList };

/**
 * Full price breakdown — promo applied BEFORE tax.
 * Returns { subtotal, discount, taxableAmount, tax, total }.
 */
export function calcTotals(subtotal, taxRate, promoDiscount = 0) {
    const sub = Math.max(0, Number(subtotal) || 0);
    const discount = Math.min(parseFloat((Number(promoDiscount) || 0).toFixed(2)), sub);
    const taxable = parseFloat((sub - discount).toFixed(2));
    const tax = parseFloat((taxable * (Number(taxRate) || 0)).toFixed(2));
    const total = parseFloat((taxable + tax).toFixed(2));
    return { subtotal: sub, discount, taxableAmount: taxable, tax, total };
}
