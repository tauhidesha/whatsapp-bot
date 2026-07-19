/**
 * Information Prioritizer
 * Middle layer that filters and formats raw Tool JSON outputs into concise,
 * prioritized information for the Composer, preventing information overload.
 */

function prioritizeInformation(state) {
    const toolResult = state.tool?.lastResult;
    if (!toolResult || !toolResult.success) {
        return null;
    }

    console.log('[Information Prioritizer] Processing tool result for capability:', state.tool.lastCapability);

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
                return {
                    summary: 'Customer meminta beberapa layanan sekaligus (Full Repaint). Berikan estimasi RANGE TOTAL saja.',
                    itemsIncluded: items.join(', '),
                    estimatedTotalRange: minTotal === maxTotal 
                        ? `Rp${minTotal.toLocaleString('id-ID')}` 
                        : `Rp${minTotal.toLocaleString('id-ID')} - Rp${maxTotal.toLocaleString('id-ID')}`,
                    rawResults: toolResult.results // keep raw just in case
                };
            }
        }

        // Single service with multiple packages (e.g., Repaint Bodi Halus)
        if (toolResult.multiple_candidates && toolResult.candidates) {
            const prices = toolResult.candidates.map(c => c.price).filter(p => p > 0);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                return {
                    summary: `Ada ${toolResult.candidates.length} pilihan paket untuk ${toolResult.category}. Jangan sebutkan semua detailnya kecuali ditanya.`,
                    estimatedRange: minPrice === maxPrice 
                        ? `Rp${minPrice.toLocaleString('id-ID')}` 
                        : `Rp${minPrice.toLocaleString('id-ID')} - Rp${maxPrice.toLocaleString('id-ID')}`,
                    note: toolResult.promo_active ? 'Ada promo aktif, bisa di-mention jika relevan.' : ''
                };
            }
        }

        // Just a single exact price
        if (toolResult.price) {
            return {
                service: toolResult.service_name,
                description: toolResult.description,
                price: toolResult.price_formatted,
                duration: toolResult.estimated_duration,
                promo_active: toolResult.promo_active
            };
        }
    }

    // Default passthrough if we don't have a specific prioritizer logic
    return toolResult;
}

module.exports = {
    prioritizeInformation
};
