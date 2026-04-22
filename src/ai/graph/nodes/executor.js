const { toolsByName } = require('../tools');
const { getActivePromo } = require('../../utils/promoConfig');
const { extractTextFromContent } = require('../utils/sanitizeMessages');

// extractTextMessage removed - now using extractTextFromContent from shared utility

/**
 * Node: toolExecutor
 * Mengeksekusi tool berdasarkan intent dan context yang sudah terkumpul.
 * Mendukung multi-service dengan combo discount.
 */
async function toolExecutorNode(state) {
    console.log('--- [EXECUTOR_NODE] Starting ---');
    const { intent, context, customer } = state;
    
    let toolResult = null;

    try {
        if (intent === 'GENERAL_INQUIRY' || intent === 'BOOKING_SERVICE') {
            // Cek harga jika sudah ada layanan & motor
            // GUARD: Pada GENERAL_INQUIRY, jangan lookup harga kecuali user eksplisit tanya harga
            // Ini mencegah Zoya kasih harga saat user cuma tanya lokasi/jam buka
            const lastMsgForPrice = state.messages[state.messages.length - 1];
            const lastMsgTextForPrice = extractTextFromContent(
                lastMsgForPrice?.content || lastMsgForPrice?.kwargs?.content || ''
            ).toLowerCase();
            const userAskedPrice = /harga|biaya|tarif|berapa|price|cost|estimasi|ongkos|bayar/i.test(lastMsgTextForPrice);
            const shouldLookupPrice = intent === 'BOOKING_SERVICE' || userAskedPrice;
            
            if (shouldLookupPrice && context.serviceTypes?.length > 0 && context.vehicleType) {
                console.log(`[executorNode] Executing getServiceDetails for ${context.vehicleType} and [${context.serviceTypes.join(', ')}]...`);
                const tool = toolsByName['getServiceDetails'];
                if (tool) {
                    toolResult = await tool({
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

                    // Fetch & apply combo discount if multiple services
                    if (context.serviceTypes.length >= 2) {
                        const promo = await getActivePromo();
                        if (promo && promo.comboDiscount > 0 && context.serviceTypes.length >= promo.comboMinServices) {
                            // Deduplicate results by service_id to prevent double-counting
                            // (e.g. "Detailing Bodi Halus,Bodi Kasar" can match "Repaint Bodi Halus" again)
                            const results = toolResult?.results || [];
                            const seen = new Set();
                            const uniqueResults = results.filter(r => {
                                if (r.service_id && seen.has(r.service_id)) return false;
                                if (r.service_id) seen.add(r.service_id);
                                return true;
                            });
                            // Replace results array with deduplicated version
                            toolResult.results = uniqueResults;
                            
                            let totalPrice = 0;
                            for (const r of uniqueResults) {
                                if (r.final_price) totalPrice += r.final_price;
                                else if (r.price) totalPrice += r.price;
                                // For multiple_candidates (generic category), sum the first candidate
                                else if (r.candidates?.length > 0 && r.candidates[0].price) {
                                    totalPrice += r.candidates[0].price;
                                }
                            }

                            if (totalPrice > 0) {
                                const discountAmount = Math.round(totalPrice * promo.comboDiscount);
                                toolResult.combo = {
                                    applied: true,
                                    discount_percent: promo.comboDiscount * 100,
                                    discount_amount: discountAmount,
                                    discount_formatted: `Rp${discountAmount.toLocaleString('id-ID')}`,
                                    total_before: totalPrice,
                                    total_before_formatted: `Rp${totalPrice.toLocaleString('id-ID')}`,
                                    total_after: totalPrice - discountAmount,
                                    total_after_formatted: `Rp${(totalPrice - discountAmount).toLocaleString('id-ID')}`,
                                    promo_text: promo.promoText,
                                };
                                console.log(`[executorNode] Combo discount applied: ${promo.comboDiscount * 100}% off Rp${totalPrice.toLocaleString('id-ID')} = Rp${(totalPrice - discountAmount).toLocaleString('id-ID')}`);
                            }
                        }
                    }

                    console.log(`[executorNode] Tool Result Success: ${toolResult ? 'Yes' : 'No'}`);
                }
            }

            // --- COLOR MOCKUP GENERATION ---
            // Generate AI mockup only when ALL required colors are filled (max 3 per session)
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
                console.log(`[executorNode] 🎨 All colors ready! Generating mockup (${mockupCount + 1}/${MAX_MOCKUPS})...`);
                console.log(`[executorNode]   Motor: ${context.vehicleType} | Body: ${context.colorChoice || '-'} | Velg: ${context.velgColorChoice || '-'}`);
                const mockupTool = toolsByName['generateColorMockup'];
                if (mockupTool) {
                    try {
                        const mockupResult = await mockupTool({
                            motorModel: context.vehicleType,
                            bodyColor: context.colorChoice || undefined,
                            velgColor: context.velgColorChoice || undefined,
                            senderNumber: state.metadata?.phoneReal || '',
                        });

                        if (!toolResult) toolResult = { mockup: mockupResult };
                        else toolResult.mockup = mockupResult;

                        // Increment counter on success
                        if (mockupResult.success) {
                            context.mockupGenerated = mockupCount + 1;
                        }
                        console.log(`[executorNode] 🎨 Mockup result: ${mockupResult.success ? '✅' : '❌'} (${context.mockupGenerated}/${MAX_MOCKUPS})`);
                    } catch (mockupErr) {
                        console.error(`[executorNode] 🎨 Mockup generation failed:`, mockupErr.message);
                        // Non-fatal — don't break the flow, just skip mockup
                    }
                }
            } else if (allColorsReady && !canGenerate && context.vehicleType) {
                // Limit reached — inform formatter
                console.log(`[executorNode] 🎨 Mockup limit reached (${mockupCount}/${MAX_MOCKUPS}). Skipping.`);
                if (!toolResult) toolResult = { mockup: { success: false, limit_reached: true, count: mockupCount, max: MAX_MOCKUPS } };
                else toolResult.mockup = { success: false, limit_reached: true, count: mockupCount, max: MAX_MOCKUPS };
            }
            
            // --- AUTOMATED HUMAN HANDOVER / BOSMAT TRIGGER ---
            const isCar = context.vehicleType === 'Mobil';
            if (intent === 'HUMAN_HANDOVER' || isCar) {
                console.log(`[executorNode] Triggering HUMAN HANDOVER (Reason: ${isCar ? 'Car Inquiry' : 'User Request'})...`);
                const tool = toolsByName['triggerBosMatTool'];
                if (tool) {
                    const lastUserMsgRecord = state.messages.slice().reverse().find(m => m.type === 'human' || m.role === 'user');
                    const lastUserMsg = lastUserMsgRecord ? extractTextFromContent(lastUserMsgRecord.content) : 'No text found';
                    
                    const handoffResult = await tool({
                        reason: isCar ? 'Tanya repaint/detailing Mobil (perlu konfirmasi bos)' : 'User minta bantuan admin/human handover',
                        customerQuestion: lastUserMsg,
                        senderNumber: state.metadata?.phoneReal || ''
                    });

                    // Merge into toolResult
                    if (!toolResult) {
                        toolResult = { handoff: handoffResult };
                    } else {
                        toolResult.handoff = handoffResult;
                    }
                    console.log(`[executorNode] Handover Success: ${handoffResult.success}`);
                }
            }

            // Cek Booking Availability jika ada tanggal/jam
            if (context.bookingDate) {
                console.log(`[executorNode] Checking availability for ${context.bookingDate} at ${context.bookingTime || 'anytime'}...`);
                const tool = toolsByName['checkBookingAvailability'];
                if (tool) {
                    const availResult = await tool({
                        bookingDate: context.bookingDate,
                        bookingTime: context.bookingTime || '',
                        serviceName: context.serviceTypes?.join(', ') || 'Layanan Umum',
                        estimatedDurationMinutes: context.serviceTypes?.length > 1 ? 240 : 120 // 4h for multi, 2h for single
                    });

                    // Merge into toolResult or set if toolResult was null
                    if (!toolResult) {
                        toolResult = availResult;
                    } else {
                        toolResult.availability = availResult;
                    }
                }
            }

            // Cek Jam Buka/Studio Info (Selalu panggil jika intent GENERAL_INQUIRY atau ada keyword studio)
            const lastMsgNode = state.messages[state.messages.length - 1];
            const lastMsgRaw = lastMsgNode.content || (lastMsgNode.kwargs && lastMsgNode.kwargs.content) || lastMsgNode;
            const lastMsgContent = extractTextFromContent(lastMsgRaw).toLowerCase();
            const studioKeywords = /lokasi|alamat|dimana|buka|tutup|istirahat|jam berapa|kontak|wa|map|maps|koordinat/i.test(lastMsgContent);
            
            if (intent === 'GENERAL_INQUIRY' || studioKeywords) {
                const tool = toolsByName['getStudioInfo'];
                if (tool) {
                    const studioResult = await tool({});
                    if (!toolResult) {
                        toolResult = studioResult;
                    } else {
                        // Merge if both exist
                        if (typeof toolResult === 'object') {
                            toolResult.studioInfo = studioResult;
                        }
                    }
                }

                // --- PHOTO SENDING LOGIC (Nearby/Confused) ---
                const locationConfusionKeywords = /bingung|nyasar|depan|dimananya|liat tempatnya|foto|sebelah|patokan|pintu/i.test(lastMsgContent);
                if (locationConfusionKeywords) {
                    console.log(`[executorNode] Location confusion detected. Triggering sendStudioPhoto...`);
                    const photoTool = toolsByName['sendStudioPhoto'];
                    if (photoTool) {
                        const photoResult = await photoTool({
                            senderNumber: state.metadata?.phoneReal || ''
                        });
                        
                        if (!toolResult) toolResult = { studioPhoto: photoResult };
                        else toolResult.studioPhoto = photoResult;
                    }
                }
            }
        }

        // Fetch combo promo info for single-service (for formatter to offer)
        let comboPromo = null;
        if (context.serviceTypes?.length === 1 && !context.comboOffered) {
            comboPromo = await getActivePromo();
        }

        return {
            context: context,
            metadata: {
                ...state.metadata,
                toolResult: toolResult,
                comboPromo: comboPromo // Pass to formatter for proactive offer
            }
        };

    } catch (error) {
        console.error('[toolExecutorNode] Error:', error);
        return {
            metadata: {
                ...state.metadata,
                toolError: error.message
            }
        };
    }
}

module.exports = { toolExecutorNode };
