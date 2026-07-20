const toolRegistry = require('../../tools/v2/registry');

/**
 * Capability Router Node for Zoya V2
 * Routes the planner's capability request to the appropriate tool execution logic dynamically.
 */

async function capabilityRouterNode(state) {
    console.log('[Capability Router Node] Routing Capability...');
    
    const toolIntent = state.planner?.execution?.toolIntent;
    
    if (!toolIntent || toolIntent === 'NONE') {
        console.log(`[Capability Router Node] No tool requested (intent: ${toolIntent}). Skipping tool execution.`);
        // If no capability is needed, we don't update the tool state
        return {};
    }

    // Map generic intent to specific tool implementation
    const intentToToolMap = {
        'GET_PRICE': 'pricing',
        'CREATE_BOOKING': 'create_booking',
        'CHECK_AVAILABILITY': 'booking_availability',
        'SEND_NOTIFICATION': 'notification',
        'ANSWER_FAQ': 'studio_info',
        'ESCALATE_HUMAN': 'escalate_human'
    };

    const capability = intentToToolMap[toolIntent];
    const tool = toolRegistry.getTool(capability);
    
    let resultData = null;
    let toolUpdate = {};

    if (tool) {
        console.log(`[Capability Router Node] Executing Tool: ${tool.name} for intent: ${toolIntent} (mapped to ${capability})`);
        
        // Prepare input from state
        const toolInput = {
            conversationId: state.metadata?.thread_id || 'unknown',
            customerId: state.metadata?.phoneReal || 'unknown',
            conversationState: state,
            // Planner is now responsible for providing the required parameters
            parameters: state.planner?.execution?.parameters || {},
            metadata: { source: 'capabilityRouter' }
        };

        // Import traceable from langsmith/traceable dynamically
        const { traceable } = require('langsmith/traceable');
        
        // Wrap execution to show up nicely as a 'tool' in LangSmith
        const tracedToolExecution = traceable(async (input) => {
            return await tool.execute(input);
        }, {
            name: tool.name,
            run_type: "tool",
            tags: ["capability", capability]
        });

        const response = await tracedToolExecution(toolInput);
        
        resultData = response;
        
        // FORMATTER UNTUK PRICING (Sesuai instruksi User)
        if (capability === 'pricing' && response.data && Array.isArray(response.data)) {
            const prices = response.data.map(p => p.price || 0).filter(p => p > 0);
            if (prices.length > 0) {
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                
                const formatRp = (num) => 'Rp ' + num.toLocaleString('id-ID');
                const hargaStr = min === max ? formatRp(min) : `${formatRp(min)} - ${formatRp(max)} (Tergantung Paket)`;
                
                resultData = {
                    data: {
                        hargaEstimasi: hargaStr
                    }
                };
            }
        }
        
        toolUpdate = {
            lastCapability: capability,
            lastTool: tool.name,
            lastResult: resultData.data || resultData,
            executionHistory: [...(state.tool?.executionHistory || []), { capability, result: resultData, time: new Date().toISOString() }]
        };

    } else {
        console.warn(`[Capability Router Node] Tool for capability '${capability}' not found in registry.`);
        resultData = {
            success: false,
            error: { code: 'TOOL_NOT_FOUND', message: `No tool registered for capability: ${capability}` }
        };
        toolUpdate = {
            lastCapability: capability,
            lastTool: 'unknown',
            // Preserve previous successful result if the current tool is not found
            lastResult: state.tool?.lastResult?.error ? resultData : (state.tool?.lastResult || resultData),
            executionHistory: [...(state.tool?.executionHistory || []), { capability, result: resultData, time: new Date().toISOString() }]
        };
    }

    const result = {
        tool: toolUpdate,
        analytics: {
            toolCalls: (state.analytics?.toolCalls || 0) + 1
        }
    };
    console.log('[Capability Router Node] Output:', JSON.stringify(result, null, 2));
    return result;
}

module.exports = {
    capabilityRouterNode
};
