const { toolsByName } = require('../tools');
const { getActivePromo } = require('../../utils/promoConfig');
const { extractTextFromContent } = require('../utils/sanitizeMessages');

/**
 * Node: toolExecutor
 * Mengeksekusi tool berdasarkan intent dan context yang sudah terkumpul.
 * Mendukung multi-service dengan combo discount tanpa mutasi langsung.
 */
async function toolExecutorNode(state) {
    console.log('--- [EXECUTOR_NODE] Starting ---');
    const { intent, customer } = state;
    const context = state.context || {};
    
    // PERBAIKAN BUG-5: Hindari in-place mutation, buat salinan baru
    const contextUpdate = { ...context };
    
    // PERBAIKAN BUG-2: Selalu inisialisasi sebagai objek kosong agar bentuknya konsisten
    let toolResult = {};
    toolResult.results = [];

    try {
        if (intent === 'GENERAL_INQUIRY' || intent === 'BOOKING_SERVICE' || intent === 'CONSULTATION') {
            const lastMsgForPrice = state.messages[state.messages.length - 1];
            const lastMsgTextForPrice = extractTextFromContent(
                lastMsgForPrice?.content || lastMsgForPrice?.kwargs?.content || ''
            ).toLowerCase();
            const userAskedPrice = /harga|biaya|tarif|berapa|price|cost|estimasi|ongkos|bayar/i.test(lastMsgTextForPrice);
            const shouldLookupPrice = 
                state.metadata?.flow === 'pricing' || 
                intent === 'BOOKING_SERVICE' || 
                intent === 'CONSULTATION' ||
                userAskedPrice;
            
            if (intent === 'BOOKING_SERVICE' && context.bookingDate) {
                console.log(`[executorNode] Executing checkBookingAvailability for date ${context.bookingDate}...`);
                const tool = toolsByName['checkBookingAvailability'];
                if (tool) {
                    try {
                        const bookingResult = await tool({
                            bookingDate: context.bookingDate,
                            bookingTime: context.bookingTime,
                            serviceName: context.serviceTypes?.join(', '),
                            estimatedDurationMinutes: undefined
                        });
                        toolResult = { ...toolResult, ...bookingResult, bookingChecked: true };
                    } catch (err) {
                        console.error('[executorNode] checkBookingAvailability failed:', err.message);
                        toolResult.bookingError = err.message;
                    }
                }
            } else if (shouldLookupPrice && context.serviceTypes?.length > 0 && context.vehicleType) {
                console.log(`[executorNode] Executing getServiceDetails for ${context.vehicleType} and [${context.serviceTypes.join(', ')}]...`);
                const tool = toolsByName['getServiceDetails'];
                
                if (tool) {
                    // PERBAIKAN BUG-4: Bungkus setiap external tool dengan try/catch masing-masing
                    try {
                        const pricingResult = await tool({
                            service_name: context.serviceTypes,
                            motor_model: context.vehicleType,
                            extraContext: {
                                paintType: context.paintType,
                                isBongkarTotal: context.isBongkarTotal,
                                detailingFocus: context.detailingFocus,
                                colorChoice: context.colorChoice,
                                velgColorChoice: context.velgColorChoice,
                                isPreviouslyPainted: context.isPreviouslyPainted
                            }
                        });
                        
                        if (pricingResult && pricingResult.results) {
                            const eligiblePattern = /premium|standar|basic/i;
                            toolResult.results = pricingResult.results.map(item => {
                                const price = item.final_price || item.price || 0;
                                const eligible = eligiblePattern.test(item.name || '');
                                return {
                                    ...item,
                                    original_price: price,
                                    discount_percent: eligible ? 15 : 0,
                                    discount_price: eligible ? Math.round(price * 0.85) : price
                                };
                            });
                        }
                    } catch (err) {
                        console.error('[executorNode] getServiceDetails failed:', err.message);
                        toolResult.pricingError = err.message;
                    }

                    // PERBAIKAN BUG-1: Penghitungan diskon combo yang difilter per item eligible
                    if (context.serviceTypes.length >= 2 && toolResult.results?.length > 0) {
                        const promo = await getActivePromo();
                        if (promo && promo.comboDiscount > 0 && context.serviceTypes.length >= promo.comboMinServices) {
                            
                            // Deduplikasi bodi halus/kasar jika ada double match
                            const seen = new Set();
                            const uniqueResults = toolResult.results.filter(r => {
                                if (r.service_id && seen.has(r.service_id)) return false;
                                if (r.service_id) seen.add(r.service_id);
                                return true;
                            });
                            toolResult.results = uniqueResults;
                            
                            const getPrice = (r) => r.final_price || r.price || r.candidates?.[0]?.price || 0;
                            const eligiblePattern = new RegExp(promo.discountEligiblePattern || 'bodi halus', 'i');
                            
                            let totalBefore = 0;
                            let totalAfter = 0;
                            
                            const breakdown = uniqueResults.map(r => {
                                const price = getPrice(r);
                                totalBefore += price;
                                const isEligible = eligiblePattern.test(r.name || '');
                                const discountAmount = isEligible ? Math.round(price * promo.comboDiscount) : 0;
                                const finalPrice = price - discountAmount;
                                totalAfter += finalPrice;
                                return {
                                    name: r.name,
                                    originalPrice: price,
                                    discountPercent: isEligible ? promo.comboDiscount * 100 : 0,
                                    discountAmount,
                                    finalPrice,
                                };
                            });

                            const anyDiscounted = breakdown.some(b => b.discountAmount > 0);
                            if (anyDiscounted) {
                                toolResult.combo = {
                                    applied: true,
                                    promo_text: promo.promoText,
                                    trigger_reason: `Ambil ${context.serviceTypes.length} layanan sekaligus`,
                                    breakdown,
                                    total_before: totalBefore,
                                    total_before_formatted: `Rp${totalBefore.toLocaleString('id-ID')}`,
                                    total_after: totalAfter,
                                    total_after_formatted: `Rp${totalAfter.toLocaleString('id-ID')}`,
                                };
                                console.log(`[executorNode] Combo discount applied correctly.`);
                            }
                        }
                    }

                    // PERBAIKAN BUG-3: Penentuan pricingMode secara dinamis dari Executor
                    function isChoosingPaketTier(results) {
                        const groups = {};
                        for (const r of results) {
                            const base = (r.name || '').replace(/\s*-\s*Paket\s+(Premium|Standar|Basic|Ekonomis)/i, '').trim();
                            (groups[base] ||= []).push(r);
                        }
                        return Object.values(groups).some(g => g.length > 1);
                    }
                    
                    if (toolResult?.results?.length > 0) {
                        toolResult.pricingMode = isChoosingPaketTier(toolResult.results) ? 'choosing_tier' : 'finalized';
                    }
                }
            }

            // Fallback Auto-handover jika data esensial tidak ditemukan sama sekali
            if (shouldLookupPrice && context.serviceTypes?.length > 0) {
                const results = toolResult?.results || [];
                const hasUsableResult = results.length > 0 && results.some(r => !r.error && r.status !== 'not_found');
                if (!hasUsableResult) {
                    console.log(`[executorNode] ⚠️ No pricing data found. Auto-triggering handover...`);
                    const handoverTool = toolsByName['triggerBosMatTool'];
                    if (handoverTool) {
                        const lastUserMsgRecord = state.messages.slice().reverse().find(m => m.type === 'human' || m.role === 'user');
                        const lastUserMsg = lastUserMsgRecord ? extractTextFromContent(lastUserMsgRecord.content) : 'No text found';
                        const handoffResult = await handoverTool({
                            reason: `Harga layanan [${context.serviceTypes.join(', ')}] untuk ${context.vehicleType} tidak ditemukan.`,
                            customerQuestion: lastUserMsg,
                            senderNumber: state.metadata?.phoneReal || ''
                        });
                        toolResult.handoff = handoffResult;
                        toolResult.autoHandoverReason = 'no_pricing_data';
                    }
                }
            }

            // MOCKUP GENERATION
            const MAX_MOCKUPS = 3;
            const serviceTypes = context.serviceTypes || [];
            const wantsBodi = serviceTypes.some(s => s.toLowerCase().includes('repaint') && s.toLowerCase().includes('halus'));
            const wantsVelg = serviceTypes.some(s => s.toLowerCase().includes('repaint') && s.toLowerCase().includes('velg'));
            const bodiReady = !wantsBodi || !!context.colorChoice;
            const velgReady = !wantsVelg || !!context.velgColorChoice;
            const allColorsReady = (wantsBodi || wantsVelg) && bodiReady && velgReady;
            const mockupCount = typeof context.mockupGenerated === 'number' ? context.mockupGenerated : 0;
            const canGenerate = mockupCount < MAX_MOCKUPS;

            if (allColorsReady && canGenerate && context.vehicleType) {
                const mockupTool = toolsByName['generateColorMockup'];
                if (mockupTool) {
                    try {
                        const mockupResult = await mockupTool({
                            motorModel: context.vehicleType,
                            bodyColor: context.colorChoice || undefined,
                            velgColor: context.velgColorChoice || undefined,
                            senderNumber: state.metadata?.phoneReal || '',
                        });
                        toolResult.mockup = mockupResult;
                        if (mockupResult.success) {
                            contextUpdate.mockupGenerated = mockupCount + 1;
                        }
                    } catch (mockupErr) {
                        console.error(`[executorNode] Mockup failed:`, mockupErr.message);
                    }
                }
            } else if (allColorsReady && !canGenerate && context.vehicleType) {
                toolResult.mockup = { success: false, limit_reached: true, count: mockupCount, max: MAX_MOCKUPS };
            }

            // Booking Availability
            if (context.bookingDate) {
                const tool = toolsByName['checkBookingAvailability'];
                if (tool) {
                    try {
                        toolResult.availability = await tool({
                            bookingDate: context.bookingDate,
                            bookingTime: context.bookingTime || '',
                            serviceName: context.serviceTypes?.join(', ') || 'Layanan Umum',
                            estimatedDurationMinutes: context.serviceTypes?.length > 1 ? 240 : 120
                        });
                    } catch (err) {
                        console.error('[executorNode] checkBookingAvailability failed:', err.message);
                    }
                }
            }

            // Studio Info & Photo Sending
            const studioKeywords = /lokasi|alamat|dimana|buka|tutup|jam berapa|map|maps/i.test(lastMsgTextForPrice);
            if (intent === 'GENERAL_INQUIRY' || studioKeywords) {
                const tool = toolsByName['getStudioInfo'];
                if (tool) {
                    try {
                        toolResult.studioInfo = await tool({});
                    } catch (err) {
                        console.error('[executorNode] getStudioInfo failed:', err.message);
                    }
                }

                const locationConfusionKeywords = /bingung|nyasar|depan|dimananya|patokan/i.test(lastMsgTextForPrice);
                if (locationConfusionKeywords) {
                    const photoTool = toolsByName['sendStudioPhoto'];
                    if (photoTool) {
                        try {
                            toolResult.studioPhoto = await photoTool({ senderNumber: state.metadata?.phoneReal || '' });
                        } catch (err) {
                            console.error('[executorNode] sendStudioPhoto failed:', err.message);
                        }
                    }
                }
            }
        }

        // Standalone Human Handover
        const isCar = context.vehicleType === 'Mobil';
        if ((intent === 'HUMAN_HANDOVER' || isCar) && !toolResult?.handoff) {
            const handoverTool = toolsByName['triggerBosMatTool'];
            if (handoverTool) {
                const lastUserMsgRecord = state.messages.slice().reverse().find(m => m.type === 'human' || m.role === 'user');
                const lastUserMsg = lastUserMsgRecord ? extractTextFromContent(lastUserMsgRecord.content) : 'No text found';
                toolResult.handoff = await handoverTool({
                    reason: isCar ? 'Tanya servis Mobil (luar scope utama)' : 'User request handover',
                    customerQuestion: lastUserMsg,
                    senderNumber: state.metadata?.phoneReal || ''
                });
            }
        }

        const activePromo = await getActivePromo();
        const comboPromo = (context.serviceTypes?.length === 1 && !context.comboOffered) ? activePromo : null;

        return {
            context: contextUpdate,
            metadata: {
                ...state.metadata,
                toolResult: toolResult,
                activePromo: activePromo,
                comboPromo: comboPromo
            }
        };

    } catch (error) {
        console.error('[toolExecutorNode] Critical Error:', error);
        // PERBAIKAN BUG-4: Selalu return context lama dan jangan mereset state saat error besar terjadi
        return {
            context: context,
            metadata: {
                ...state.metadata,
                toolError: error.message
            }
        };
    }
}

module.exports = { toolExecutorNode };
