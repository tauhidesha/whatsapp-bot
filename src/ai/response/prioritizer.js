/**
 * Information Prioritizer
 * Middle layer that:
 * 1. Filters and formats raw Tool JSON outputs for the Composer.
 * 2. Calls calculateCartTotal() server-side — so the Composer NEVER calculates prices.
 */

const masterLayanan = require('../../data/masterLayanan');
const { calculateCartTotal } = require('../utils/cartCalculator');
const { getActivePromo } = require('../utils/promoConfig');

async function prioritizeInformation(state) {
    const toolResult = state.tool?.lastResult;
    let injectedKnowledge = null;

    if (state.intent === 'ASK_SERVICE_DETAILS' && state.planner?.decision?.strategy !== 'CLARIFY_SERVICE' && state.context?.targetService) {
        const svc = masterLayanan.find(s => s.name.toLowerCase() === state.context.targetService.toLowerCase());
        if (svc) {
            injectedKnowledge = svc.description || svc.summary;
            console.log(`[Information Prioritizer] Injecting knowledge for ${state.context.targetService}`);
        }
    }

    const isSuccess = toolResult && !toolResult.error;

    if (!isSuccess && !injectedKnowledge) {
        return null;
    }

    let resultData = isSuccess ? { ...toolResult } : {};
    if (injectedKnowledge) {
        resultData.injected_knowledge = injectedKnowledge;
    }

    console.log('[Information Prioritizer] Processing tool result/knowledge');

    // ── Cart Calculation (server-side, always) ──────────────────────
    // Read from state.cart (updated by capabilityRouter after tool call)
    const cartItems = state.cart?.items || {};
    const hasCartItems = Object.keys(cartItems).length > 0;

    if (hasCartItems) {
        try {
            const promoInfo = await getActivePromo();
            const comboDiscountPct = (promoInfo?.comboDiscount) || 0.15;
            const cartCalc = calculateCartTotal(cartItems, comboDiscountPct);
            if (cartCalc) {
                resultData.cartCalculation = cartCalc;
                console.log(`[Information Prioritizer] Cart calculation type: ${cartCalc.type}, items: ${Object.keys(cartItems).length}`);
            }
        } catch (err) {
            console.warn('[Information Prioritizer] Cart calculation failed:', err.message);
        }
    }

    // ── Pricing Tool Handling (for non-cart legacy display) ─────────
    if (state.tool?.lastCapability === 'pricing') {
        let rawData = toolResult?.rawText || toolResult;

        // getServiceDetailsTool wraps pricing data in { success, data: {actual}, metadata, ... }
        // Unwrap if pricing keys are not at the top level
        const hasPricingKeys = rawData?.candidates || rawData?.price || rawData?.multiple_candidates || rawData?.multiple_services_requested;
        if (!hasPricingKeys && rawData?.data) {
            rawData = rawData.data;
        }

        // If cart calculation is available, it takes priority — skip legacy format
        if (resultData.cartCalculation) {
            if (injectedKnowledge) resultData.injected_knowledge = injectedKnowledge;
            return resultData;
        }

        // Legacy: multiple services requested (e.g., Repaint + Repaint Velg)
        if (rawData?.multiple_services_requested && rawData.results) {
            let minTotal = 0;
            let maxTotal = 0;
            let items = [];

            rawData.results.forEach(res => {
                if (res.success && res.candidates) {
                    const prices = res.candidates.map(c => c.price).filter(p => p > 0);
                    if (prices.length > 0) {
                        minTotal += Math.min(...prices);
                        maxTotal += Math.max(...prices);
                    }
                    if (res.category === 'repaint_bodi_halus') items.push('Bodi Halus');
                    else if (res.category === 'repaint') items.push('Repaint Area');
                } else if (res.success && res.price) {
                    minTotal += res.price;
                    maxTotal += res.price;
                    items.push(res.name || 'Layanan Spesifik');
                }
            });

            if (minTotal > 0) {
                const returnObj = {
                    summary: 'Customer meminta beberapa layanan sekaligus. Berikan estimasi RANGE TOTAL saja.',
                    itemsIncluded: items.join(', '),
                    estimatedTotalRange: minTotal === maxTotal
                        ? `Rp${minTotal.toLocaleString('id-ID')}`
                        : `Rp${minTotal.toLocaleString('id-ID')} - Rp${maxTotal.toLocaleString('id-ID')}`,
                    rawResults: rawData.results
                };
                if (injectedKnowledge) returnObj.injected_knowledge = injectedKnowledge;
                return returnObj;
            }
        }

        // Legacy: single service with multiple packages (Repaint Bodi Halus)
        if (rawData?.multiple_candidates && rawData.candidates) {
            const prices = rawData.candidates.map(c => c.price).filter(p => p > 0);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const returnObj = {
                    summary: `Ada ${rawData.candidates.length} pilihan paket. Jangan sebutkan semua detailnya kecuali ditanya.`,
                    estimatedRange: minPrice === maxPrice
                        ? `Rp${minPrice.toLocaleString('id-ID')}`
                        : `Rp${minPrice.toLocaleString('id-ID')} - Rp${maxPrice.toLocaleString('id-ID')}`,
                    candidates: rawData.candidates,
                    note: rawData.promo_active ? 'Ada promo aktif, bisa di-mention jika relevan.' : ''
                };
                if (injectedKnowledge) returnObj.injected_knowledge = injectedKnowledge;
                return returnObj;
            }
        }

        // Legacy: single exact price
        if (rawData?.price) {
            const returnObj = {
                service: toolResult.service_name,
                description: toolResult.description,
                price: toolResult.price_formatted,
                duration: toolResult.estimated_duration,
                promo_active: toolResult.promo_active
            };
            if (injectedKnowledge) returnObj.injected_knowledge = injectedKnowledge;
            return returnObj;
        }
    }

    // Default passthrough
    return resultData;
}

module.exports = {
    prioritizeInformation
};



