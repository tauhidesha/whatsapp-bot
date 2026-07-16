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
        'GET_PRICE': 'getRepaintPricing',
        'CREATE_BOOKING': 'createBooking',
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
            // Since we haven't implemented an LLM extractor for tool parameters yet, 
            // for Sprint 4 we will extract the parameter based on state.consultation
            parameters: {
                service_name: state.consultation?.requestedServices?.length > 0 
                    ? state.consultation.requestedServices 
                    : ['Repaint Bodi Halus'], // Fallback if empty
                motor_model: state.vehicle?.model || state.memory?.identity?.motor || 'NMax',
                bookingDate: '2026-07-20',
                bookingTime: '10:00',
                estimatedDurationMinutes: 120
            },
            metadata: { source: 'capabilityRouter' }
        };

        const response = await tool.execute(toolInput);
        
        resultData = response;
        
        toolUpdate = {
            lastCapability: capability,
            lastTool: tool.name,
            lastResult: response.data,
            executionHistory: [...(state.tool?.executionHistory || []), { capability, result: response, time: new Date().toISOString() }]
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
            lastResult: resultData,
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
