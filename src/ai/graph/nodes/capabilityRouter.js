const toolRegistry = require('../../tools/v2/registry');

/**
 * Capability Router Node for Zoya V2
 * Routes the planner's capability request to the appropriate tool, then
 * updates state.cart with the pricing results for accumulated total tracking.
 */

// Services eligible for combo discount (only Repaint Bodi Halus)
const DISCOUNT_ELIGIBLE_SERVICES = ['repaint bodi halus'];

function isDiscountEligible(serviceName) {
    if (!serviceName) return false;
    return DISCOUNT_ELIGIBLE_SERVICES.some(key => serviceName.toLowerCase().includes(key));
}

function extractCartItems(toolResult, plannerParameters) {
    if (!toolResult || toolResult.error) return null;
    const cartItems = {};

    const parseServiceBlock = (block) => {
        // Normalize service name: prefer explicit name, fallback to category with underscore-to-space conversion
        const rawName = block.service_name || block.name || block.category || 'Unknown';
        const serviceName = rawName.includes('_')
            ? rawName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : rawName;

        if (block.multiple_candidates && Array.isArray(block.candidates) && block.candidates.length > 0) {
            const candidates = block.candidates
                .filter(c => c.price > 0)
                .map(c => ({ name: c.name, price: c.price }));

            if (candidates.length > 0) {
                const selectedPkg = plannerParameters?.packageName || plannerParameters?.package_name || null;
                const matchedPkg = selectedPkg
                    ? candidates.find(c => c.name.toLowerCase().includes(selectedPkg.toLowerCase()))
                    : null;

                cartItems[serviceName] = {
                    type: 'multi-package',
                    candidates,
                    selectedPackage: matchedPkg ? matchedPkg.name : null,
                    isDiscountEligible: isDiscountEligible(serviceName)
                };
            }
        } else if (block.price && block.price > 0) {
            cartItems[serviceName] = {
                type: 'fixed',
                price: block.price,
                isDiscountEligible: isDiscountEligible(serviceName)
            };
        }
    };

    // PricingTool wraps actual pricing data inside rawText field.
    // Always unwrap it before dispatching to parse blocks.
    let actualData = toolResult.rawText || toolResult;

    // getServiceDetailsTool wraps result in { success, data: {pricing_data}, metadata, ... }
    // Unwrap one more level if actual pricing keys are not at top level
    const hasPricingKeys = actualData.candidates || actualData.price || actualData.multiple_candidates || actualData.multiple_services_requested;
    if (!hasPricingKeys && actualData.data) {
        console.log('[extractCartItems] Unwrapping actualData.data layer');
        actualData = actualData.data;
    }

    if (actualData.multiple_services_requested && Array.isArray(actualData.results)) {
        // Multiple services were fetched in one call
        actualData.results.forEach(res => parseServiceBlock(res));
    } else {
        // Single service response
        parseServiceBlock(actualData);
    }

    const parsed = Object.keys(cartItems);
    if (parsed.length > 0) {
        console.log('[extractCartItems] Parsed services into cart:', parsed);
    } else {
        console.warn('[extractCartItems] No cart items extracted. actualData keys:', Object.keys(actualData || {}));
    }

    return parsed.length > 0 ? cartItems : null;
}

async function capabilityRouterNode(state) {
    console.log('[Capability Router Node] Routing Capability...');
    
    const toolIntent = state.planner?.execution?.toolIntent;
    
    if (!toolIntent || toolIntent === 'NONE') {
        console.log(`[Capability Router Node] No tool requested (intent: ${toolIntent}). Skipping.`);
        return {};
    }

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
    let cartUpdate = null;

    if (tool) {
        console.log(`[Capability Router Node] Executing Tool: ${tool.name} for intent: ${toolIntent}`);
        
        const toolInput = {
            conversationId: state.metadata?.thread_id || 'unknown',
            customerId: state.metadata?.phoneReal || 'unknown',
            conversationState: state,
            parameters: state.planner?.execution?.parameters || {},
            metadata: { source: 'capabilityRouter' }
        };

        const { traceable } = require('langsmith/traceable');
        const tracedToolExecution = traceable(async (input) => {
            return await tool.execute(input);
        }, { name: tool.name, run_type: 'tool', tags: ['capability', capability] });

        const response = await tracedToolExecution(toolInput);
        resultData = response;

        if (capability === 'pricing') {
            // PricingTool returns { rawText: actualData, formattedText, service }
            // Pass response directly — extractCartItems handles rawText unwrapping internally
            const plannerParams = state.planner?.execution?.parameters || {};
            const newCartItems = extractCartItems(response, plannerParams);
            if (newCartItems) {
                cartUpdate = { items: newCartItems, calculatedAt: new Date().toISOString() };
            }
        }

        toolUpdate = {
            lastCapability: capability,
            lastTool: tool.name,
            lastResult: resultData.data || resultData,
            executionHistory: [...(state.tool?.executionHistory || []), { capability, result: resultData, time: new Date().toISOString() }]
        };
    } else {
        console.warn(`[Capability Router Node] Tool not found for capability: ${capability}`);
        resultData = { success: false, error: { code: 'TOOL_NOT_FOUND', message: `No tool registered for: ${capability}` } };
        toolUpdate = {
            lastCapability: capability,
            lastTool: 'unknown',
            lastResult: state.tool?.lastResult?.error ? resultData : (state.tool?.lastResult || resultData),
            executionHistory: [...(state.tool?.executionHistory || []), { capability, result: resultData, time: new Date().toISOString() }]
        };
    }

    const result = {
        tool: toolUpdate,
        analytics: { toolCalls: (state.analytics?.toolCalls || 0) + 1 }
    };
    if (cartUpdate) result.cart = cartUpdate;

    console.log('[Capability Router Node] Cart update:', JSON.stringify(cartUpdate, null, 2));
    return result;
}

module.exports = { capabilityRouterNode };
