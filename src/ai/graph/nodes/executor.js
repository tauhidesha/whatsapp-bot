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
            if (context.serviceTypes?.length > 0 && context.vehicleType) {
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
                            // Calculate total from results
                            const results = toolResult?.results || [];
                            let totalPrice = 0;
                            for (const r of results) {
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
