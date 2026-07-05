const fs = require('fs');
const path = './src/ai/tools/getServiceDetailsTool.js';
let content = fs.readFileSync(path, 'utf8');

// Find where specific query starts
const searchStr = `    // 2. Specific Service Query`;
const interceptStr = `    // Intercept Repaint Bodi Halus
    if (queryLower.includes('repaint bodi halus') || queryLower.includes('repaint body halus') || queryLower === 'bodi halus' || queryLower === 'body halus') {
        const { finalSize } = await resolveSizeForService({ service: { category: 'repaint' }, sizeArg: sizeFromArgs, motorModel });
        
        // Fetch all 4 packages
        const bodiHalusPkgs = await prisma.service.findMany({
            where: { name: { contains: 'Repaint Bodi Halus - Paket' } },
            include: { prices: true }
        });
        
        if (bodiHalusPkgs.length > 0) {
            const results = [];
            for (const s of bodiHalusPkgs) {
                let basePrice = 0;
                if (s.usesModelPricing && motorModel) {
                    const motorData = await lookupMotorSizeFromData(motorModel);
                    if (motorData) {
                        const pEntry = await prisma.servicePrice.findFirst({
                            where: { serviceId: s.id, vehicleModelId: motorData.id }
                        });
                        if (pEntry) basePrice = pEntry.price;
                    }
                } else {
                    const pEntry = s.prices.find(p => p.size === finalSize) || s.prices.find(p => !p.size && !p.vehicleModelId);
                    if (pEntry) basePrice = pEntry.price;
                }
                
                if (basePrice > 0) {
                    const { finalPrice, breakdownText } = await applyAllSurcharges(basePrice, s.name, finalSize, motorModel, extraContext);
                    results.push({
                        name: s.name,
                        summary: s.summary,
                        price: finalPrice,
                        price_formatted: \`Rp\${finalPrice.toLocaleString('id-ID')}\${breakdownText}\`,
                        estimated_duration: formatDuration(s.estimatedDuration)
                    });
                }
            }
            
            // Sort by price descending
            results.sort((a, b) => b.price - a.price);
            
            return {
                success: true,
                multiple_candidates: true,
                category: 'repaint_bodi_halus',
                motor_model: motorModel,
                motor_size: finalSize,
                candidates: results,
                promo_active: !!promoText,
                message: \`Berikut 4 pilihan paket Repaint Bodi Halus untuk motor \${motorModel}.\`
            };
        }
    }

`;

content = content.replace(searchStr, interceptStr + searchStr);
fs.writeFileSync(path, content, 'utf8');
console.log('Patched getServiceDetailsTool.js');
