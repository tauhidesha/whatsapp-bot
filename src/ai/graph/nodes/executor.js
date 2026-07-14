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
    let newIntent = intent;

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
                            bookingTime: context.bookingTime || undefined,
                            serviceName: context.serviceTypes?.join(', '),
                            estimatedDurationMinutes: undefined
                        });
                        toolResult.availability = bookingResult;
                        toolResult.bookingChecked = true;
                    } catch (err) {
                        console.error('[executorNode] checkBookingAvailability failed:', err.message);
                        toolResult.bookingError = err.message;
                    }
                }
            } else if (shouldLookupPrice && context.serviceTypes?.length > 0 && context.vehicleType && context.toolExecutionMode !== 'none') {
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
                                if (Array.isArray(item.candidates)) {
                                    // Response bertingkat (repaint dengan pilihan paket)
                                    const candidates = item.candidates.map(c => {
                                        const price = c.final_price || c.price || 0;
                                        const cName = c.name || c.service_name || '';
                                        const eligible = eligiblePattern.test(cName);
                                        return {
                                            ...c,
                                            original_price: price,
                                            discount_percent: eligible ? 15 : 0,
                                            discount_price: eligible ? Math.round(price * 0.85) : price
                                        };
                                    });
                                    return { ...item, candidates };
                                }
                                // Response flat (satu harga langsung)
                                const price = item.final_price || item.price || 0;
                                const iName = item.name || item.service_name || '';
                                const eligible = eligiblePattern.test(iName);
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
                            const eligiblePattern = new RegExp(promo.discountEligiblePattern || 'repaint bodi halus', 'i');

                            let totalBefore = 0;
                            let totalAfter = 0;
                            console.log(`[executorNode] Checking Combo Promo. Pattern: ${promo.discountEligiblePattern || 'repaint bodi halus'}`);

                            const breakdown = uniqueResults.map(r => {
                                const price = getPrice(r);
                                totalBefore += price;
                                const rName = r.name || r.service_name || '';
                                const isEligible = eligiblePattern.test(rName);
                                const discountAmount = isEligible ? Math.round(price * promo.comboDiscount) : 0;
                                console.log(`[executorNode] Item: "${rName}", Price: ${price}, isEligible: ${isEligible}, Discount: ${discountAmount}`);
                                const finalPrice = price - discountAmount;
                                totalAfter += finalPrice;
                                return {
                                    name: rName,
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
                            const rName = r.name || r.service_name || '';
                            const base = rName.replace(/\s*-\s*Paket\s+(Premium|Standar|Basic|Ekonomis)/i, '').trim();
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
            if (shouldLookupPrice && context.serviceTypes?.length > 0 && context.toolExecutionMode !== 'none') {
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
                        toolResult.needBosmat = true;
                        newIntent = 'HUMAN_HANDOVER';
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

            // Booking Creation
            if (intent === 'BOOKING_SERVICE' && toolResult.bookingChecked && toolResult.availability?.available === true) {
                console.log(`[executorNode] Slot available. Executing createBooking...`);
                const createTool = toolsByName['createBooking'];
                if (createTool) {
                    try {
                        const notesArr = [];
                        if (context.colorChoice) notesArr.push(`Warna Bodi: ${context.colorChoice}`);
                        if (context.velgColorChoice) notesArr.push(`Warna Velg: ${context.velgColorChoice}`);
                        if (context.detailingFocus) notesArr.push(`Paket: ${context.detailingFocus}`);

                        toolResult.booking = await createTool({
                            customerName: customer?.name || 'Customer',
                            customerPhone: state.metadata?.phoneReal || '',
                            realPhone: state.metadata?.phoneReal || '',
                            bookingDate: context.bookingDate,
                            bookingTime: context.bookingTime || toolResult.availability?.recommendedTime || '09:00',
                            motorModel: context.vehicleType || 'Unknown',
                            serviceName: context.serviceTypes?.join(', ') || 'Layanan Umum',
                            notes: notesArr.join(', ')
                        });
                    } catch (err) {
                        console.error('[executorNode] createBooking failed:', err.message);
                        toolResult.bookingCreationError = err.message;
                    }
                }
            }

            // Studio Info & Photo Sending
            const studioKeywords = /lokasi|alamat|dimana|buka|tutup|jam berapa|map|maps|shareloc|bosmat/i.test(lastMsgTextForPrice);
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
                
                // Trigger sending photo & notify admin if user is confused OR explicitly confirming they will visit
                if (locationConfusionKeywords || context.isConfirmingVisit) {
                    const photoTool = toolsByName['sendStudioPhoto'];
                    const notifyTool = toolsByName['notifyVisitIntent'];
                    
                    if (photoTool) {
                        try {
                            toolResult.studioPhoto = await photoTool({ senderNumber: state.metadata?.phoneReal || '' });
                        } catch (err) {
                            console.error('[executorNode] sendStudioPhoto failed:', err.message);
                        }
                    }
                    
                    if (notifyTool && context.isConfirmingVisit) {
                        try {
                            toolResult.visitIntentNotified = await notifyTool({
                                senderNumber: state.metadata?.phoneReal || '',
                                senderName: customer?.name || 'Customer',
                                purpose: context.serviceTypes?.join(', ') || 'Konsultasi/Booking',
                                additionalNotes: lastMsgTextForPrice
                            });
                        } catch (err) {
                            console.error('[executorNode] notifyVisitIntent failed:', err.message);
                        }
                    }
                }
            }
        }

        // Standalone Human Handover
        const isCar = context.vehicleType === 'Mobil';
        
        // Deteksi pertanyaan konsultasi warna / minta contoh warna
        const lastUserMsgRecord = state.messages.slice().reverse().find(m => m.type === 'human' || m.role === 'user');
        const lastUserMsg = lastUserMsgRecord ? extractTextFromContent(lastUserMsgRecord.content) : '';
        const lastUserMsgLower = lastUserMsg.toLowerCase();
        const askColorConsultation = /warna apa|saran warna|cocok warna|contoh warna|lihat warna|warna yang bagus|rekomendasi warna|bingung warna|minta foto warna/i.test(lastUserMsgLower);

        if ((intent === 'HUMAN_HANDOVER' || isCar || askColorConsultation) && !toolResult?.handoff) {
            const handoverTool = toolsByName['triggerBosMatTool'];
            if (handoverTool) {
                let reason = 'User request handover';
                if (isCar) reason = 'Tanya servis Mobil (luar scope utama)';
                else if (askColorConsultation) reason = 'Konsultasi / Minta contoh warna';
                
                toolResult.handoff = await handoverTool({
                    reason: reason,
                    customerQuestion: lastUserMsg || 'No text found',
                    senderNumber: state.metadata?.phoneReal || ''
                });
                toolResult.needBosmat = true;
                newIntent = 'HUMAN_HANDOVER';
            }
        }

        const activePromo = await getActivePromo();
        const comboPromo = (context.serviceTypes?.length === 1 && !context.comboOffered) ? activePromo : null;

        return {
            intent: newIntent,
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