const { toolsByName } = require('../tools');

/**
 * Node: toolExecutor
 * Mengeksekusi tool berdasarkan intent dan context yang sudah terkumpul.
 */
async function toolExecutorNode(state) {
    const { intent, context, customer } = state;
    
    // Hasil eksekusi tool akan disimpan di metadata atau field baru
    let toolResult = null;

    try {
        if (intent === 'GENERAL_INQUIRY' || intent === 'BOOKING_SERVICE') {
            // Contoh 1: Cek harga jika sudah ada layanan & motor
            if (context.serviceType && context.vehicleType) {
                console.log(`[executorNode] Executing getServiceDetails for ${context.vehicleType} and ${context.serviceType}...`);
                const tool = toolsByName['getServiceDetails'];
                if (tool) {
                    // tool expect service_name as array + extraContext for surcharges
                    toolResult = await tool({
                        service_name: [context.serviceType],
                        motor_model: context.vehicleType,
                        extraContext: {
                            paintType: context.paintType,
                            isBongkarTotal: context.isBongkarTotal,
                            detailingFocus: context.detailingFocus,
                            colorChoice: context.colorChoice,
                            isPreviouslyPainted: context.isPreviouslyPainted
                        }
                    });
                    console.log(`[executorNode] Tool Result Success: ${toolResult ? 'Yes' : 'No'}`);
                }
            }
            
            // Contoh 2: Cek Jam Buka/Studio Info
            if (intent === 'GENERAL_INQUIRY' && !toolResult) {
                const tool = toolsByName['getStudioInfo'];
                if (tool) {
                    toolResult = await tool({});
                }
            }
        }

        return {
            metadata: {
                ...state.metadata,
                toolResult: toolResult
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
