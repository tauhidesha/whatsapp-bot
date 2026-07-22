/**
 * Cart Calculator — Pure Utility for Server-Side Price Calculation
 * 
 * RULE: Combo discount 15% ONLY applies to "Repaint Bodi Halus".
 * All other services (Bodi Kasar, Velg, Cuci Komplit, etc.) priced at normal rate.
 * 
 * Formula: Total = (BodiHalusPrice * 0.85) + sum(all other service prices)
 */

const formatRp = (num) => 'Rp' + num.toLocaleString('id-ID');

/**
 * Calculate total from cart items object.
 *
 * Returns one of two result types:
 *   A) "multi-package-simulation" — Bodi Halus has no selectedPackage yet.
 *      Shows what each package would total combined with fixed services.
 *   B) "fixed-cart" — all services have a fixed price.
 *      Shows final line items and grand total.
 *
 * @param {Object} cartItems - state.cart.items
 * @param {number} comboDiscountPct - e.g. 0.10 for 10%
 * @returns {object} Total Calculation { items, subTotal, discount, grandTotal }
 */
function calculateCartTotal(cartItems = {}, comboDiscountPct = 0.10) {
    const entries = Object.entries(cartItems);
    if (entries.length === 0) return null;

    // Separate: multi-package (not chosen), fixed, multi-package (chosen)
    const multiPackageEntry = entries.find(
        ([, item]) => item.type === 'multi-package' && item.selectedPackage === null
    );
    const fixedEntries = entries.filter(([, item]) => item.type === 'fixed');
    const selectedMultiEntries = entries.filter(
        ([, item]) => item.type === 'multi-package' && item.selectedPackage !== null
    );

    // Fixed-price services total (never discounted)
    const fixedTotal = fixedEntries.reduce((sum, [, item]) => sum + (item.price || 0), 0);

    // Already-selected multi-package items (apply discount if eligible + combo qualifies)
    let selectedMultiTotal = 0;
    const selectedMultiLineItems = selectedMultiEntries.map(([name, item]) => {
        const candidate = item.candidates?.find(c => c.name === item.selectedPackage);
        const basePrice = candidate?.price || 0;
        const hasOtherServices = fixedEntries.length > 0 || selectedMultiEntries.length > 1;
        const applyDiscount = item.isDiscountEligible && comboDiscountPct > 0 && hasOtherServices;
        const finalPrice = applyDiscount ? Math.round(basePrice * (1 - comboDiscountPct)) : basePrice;
        selectedMultiTotal += finalPrice;
        return {
            name: `${name} ${item.selectedPackage}`,
            basePrice,
            finalPrice,
            note: applyDiscount ? `Diskon ${Math.round(comboDiscountPct * 100)}% (sudah diterapkan)` : 'Harga normal',
            basePriceFormatted: formatRp(basePrice),
            finalPriceFormatted: formatRp(finalPrice)
        };
    });

    // ── SCENARIO A: Multi-package item not yet selected ──────────────
    if (multiPackageEntry) {
        const [serviceName, item] = multiPackageEntry;
        const candidates = item.candidates || [];
        const hasOtherServices = fixedEntries.length > 0 || selectedMultiEntries.length > 0;
        const applyDiscount = item.isDiscountEligible && comboDiscountPct > 0 && hasOtherServices;

        const simulations = candidates.map(c => {
            const basePrice = c.price || 0;
            const discountedPrice = applyDiscount ? Math.round(basePrice * (1 - comboDiscountPct)) : basePrice;
            const total = discountedPrice + fixedTotal + selectedMultiTotal;
            return {
                packageName: c.name,
                description: c.description,
                basePrice,
                discountedPrice,
                total,
                basePriceFormatted: formatRp(basePrice),
                discountedPriceFormatted: formatRp(discountedPrice),
                totalFormatted: formatRp(total),
                hasDiscount: applyDiscount
            };
        }).sort((a, b) => b.basePrice - a.basePrice); // Urutkan dari MAHAL ke MURAH (Premium -> Standar -> Basic -> Ekonomis)

        const fixedLineItems = fixedEntries.map(([name, itm]) => ({
            name,
            price: itm.price,
            priceFormatted: formatRp(itm.price)
        }));

        return {
            type: 'multi-package-simulation',
            serviceName,
            hasComboDiscount: applyDiscount,
            comboDiscountPct: Math.round(comboDiscountPct * 100),
            simulations,
            fixedLineItems,
            fixedTotal,
            fixedTotalFormatted: fixedTotal > 0 ? formatRp(fixedTotal) : null
        };
    }

    // ── SCENARIO B/C: All services have fixed prices ─────────────────
    const fixedLineItems = fixedEntries.map(([name, itm]) => ({
        name,
        basePrice: itm.price,
        finalPrice: itm.price,
        note: 'Harga normal',
        basePriceFormatted: formatRp(itm.price),
        finalPriceFormatted: formatRp(itm.price)
    }));

    const allLineItems = [...selectedMultiLineItems, ...fixedLineItems];
    const grandTotal = selectedMultiTotal + fixedTotal;

    return {
        type: 'fixed-cart',
        hasComboDiscount: selectedMultiEntries.some(([, itm]) => itm.isDiscountEligible) && comboDiscountPct > 0,
        comboDiscountPct: Math.round(comboDiscountPct * 100),
        lineItems: allLineItems,
        grandTotal,
        grandTotalFormatted: formatRp(grandTotal)
    };
}

module.exports = { calculateCartTotal, formatRp };
