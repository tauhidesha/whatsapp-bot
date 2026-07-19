/**
 * Information Prioritizer
 * Middle layer that filters and formats raw Tool JSON outputs into concise,
 * prioritized information for the Composer, preventing information overload.
 */

const masterLayanan = require('../../data/masterLayanan');

function prioritizeInformation(state) {
    const toolResult = state.tool?.lastResult;
    let injectedKnowledge = null;

    if (state.intent === 'ASK_SERVICE_DETAILS' && state.planner?.decision?.strategy !== 'CLARIFY_SERVICE' && state.context?.targetService) {
        const svc = masterLayanan.find(s => s.name.toLowerCase() === state.context.targetService.toLowerCase());
        if (svc) {
            injectedKnowledge = svc.description || svc.summary;
            console.log(`[Information Prioritizer] Injecting knowledge for ${state.context.targetService}`);
        }
    }

    if ((!toolResult || !toolResult.success) && !injectedKnowledge) {
        return null;
    }

    let resultData = toolResult?.success ? { ...toolResult } : {};
    if (injectedKnowledge) {
        resultData.injected_knowledge = injectedKnowledge;
    }

    console.log('[Information Prioritizer] Processing tool result/knowledge');

    // 1. Pricing Tool Handling
    if (state.tool.lastCapability === 'pricing') {
        // If there are multiple services requested (e.g., Repaint + Repaint Velg)
        if (toolResult.multiple_services_requested && toolResult.results) {
            let minTotal = 0;
            let maxTotal = 0;
            let items = [];

            toolResult.results.forEach(res => {
                if (res.success && res.candidates) {
                    const prices = res.candidates.map(c => c.price).filter(p => p > 0);
                    if (prices.length > 0) {
                        minTotal += Math.min(...prices);
                        maxTotal += Math.max(...prices);
                    }
                    if (res.category === 'repaint_bodi_halus') items.push('Bodi Halus');
                    else if (res.category === 'repaint') items.push('Repaint Area (termasuk Bodi Kasar/Velg)');
                } else if (res.success && res.price) {
                    minTotal += res.price;
                    maxTotal += res.price;
                    items.push(res.name || 'Layanan Spesifik');
                }
            });

            if (minTotal > 0) {
                const returnObj = {
                    summary: 'Customer meminta beberapa layanan sekaligus (Full Repaint). Berikan estimasi RANGE TOTAL saja.',
                    itemsIncluded: items.join(', '),
                    estimatedTotalRange: minTotal === maxTotal 
                        ? `Rp${minTotal.toLocaleString('id-ID')}` 
                        : `Rp${minTotal.toLocaleString('id-ID')} - Rp${maxTotal.toLocaleString('id-ID')}`,
                    rawResults: toolResult.results // keep raw just in case
                };
                if (injectedKnowledge) returnObj.injected_knowledge = injectedKnowledge;
                return returnObj;
            }
        }

        // Single service with multiple packages (e.g., Repaint Bodi Halus)
        if (toolResult.multiple_candidates && toolResult.candidates) {
            const prices = toolResult.candidates.map(c => c.price).filter(p => p > 0);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const returnObj = {
                    summary: `Ada ${toolResult.candidates.length} pilihan paket untuk ${toolResult.category}. Jangan sebutkan semua detailnya kecuali ditanya.`,
                    estimatedRange: minPrice === maxPrice 
                        ? `Rp${minPrice.toLocaleString('id-ID')}` 
                        : `Rp${minPrice.toLocaleString('id-ID')} - Rp${maxPrice.toLocaleString('id-ID')}`,
                    note: toolResult.promo_active ? 'Ada promo aktif, bisa di-mention jika relevan.' : ''
                };
                if (injectedKnowledge) returnObj.injected_knowledge = injectedKnowledge;
                return returnObj;
            }
        }

        // Just a single exact price
        if (toolResult.price) {
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

    // Default passthrough if we don't have a specific prioritizer logic
    return resultData;
}

module.exports = {
    prioritizeInformation
};
