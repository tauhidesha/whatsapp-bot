const toolRegistry = require('../../tools/v2/registry');

/**
 * Capability Router Node for Zoya V2
 * Routes the planner's capability request to the appropriate tool execution logic dynamically.
 */

async function capabilityRouterNode(state) {
    console.log('[Capability Router Node] Routing Capability...');
    
    const capability = state.planner?.capability;
    
    if (!capability) {
        // If no capability is needed, we don't update the tool state
        return {};
    }

    const tool = toolRegistry.getTool(capability);
    
    let resultData = null;
    let toolUpdate = {};

    if (tool) {
        console.log(`[Capability Router Node] Executing Tool: ${tool.name} for capability: ${capability}`);
        
        // Prepare input from state
        const toolInput = {
            conversationId: state.metadata?.thread_id || 'unknown',
            customerId: state.metadata?.phoneReal || 'unknown',
            conversationState: state,
            // We pass the whole state to the tool, but the tool should extract parameters if it uses an LLM.
            // Since we haven't implemented an LLM extractor for tool parameters yet, 
            // for Sprint 4 we will mock the parameter extraction based on state.memory
            parameters: {
                service_name: ['Repaint Bodi Halus'], // Mock for now to test pricing
                motor_model: state.memory?.identity?.motor || 'NMax',
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

    return {
        tool: toolUpdate,
        analytics: {
            toolCalls: (state.analytics?.toolCalls || 0) + 1
        }
    };
}

module.exports = {
    capabilityRouterNode
};
