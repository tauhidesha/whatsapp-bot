const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const { toolsByName, zoyaTools } = require('../tools');
const { getActivePromo } = require('../../utils/promoConfig');

/**
 * Node: adminNode
 * Brain asisten pribadi untuk Admin (Persona: Business Partner).
 */
async function adminNode(state) {
    console.log('👑 --- [ADMIN_NODE] Starting ---');
    const { messages, customer, metadata, isAdmin } = state;

    if (!isAdmin) {
        console.error('[ADMIN_NODE] Unauthorized access attempt.');
        return { messages: [new AIMessage('Maaf, sesi ini terbatas untuk Admin.')] };
    }

    // Identifikasi alat yang relevan untuk Admin
    const adminToolNames = [
        'crmManagementTool',
        'financeManagementTool',
        'createBookingTool',
        'updateBookingTool',
        'checkBookingAvailabilityTool',
        'readDirectMessagesTool',
        'sendMessageTool',
        'updateCustomerLabelTool',
        'updateCustomerContextTool',
        'getServiceDetailsTool',
        'getStudioInfoTool'
    ];

    // Filter tool definition untuk binding ke LLM
    const toolDefinitions = zoyaTools
        .filter(t => adminToolNames.includes(t.toolDefinition.function.name))
        .map(t => t.toolDefinition);

    const model = new ChatGoogleGenerativeAI({
        model: process.env.AI_MODEL || 'gemini-1.5-flash',
        maxOutputTokens: 1024,
        temperature: 0.2
    }).bind({
        tools: toolDefinitions
    });

    const currentDateTime = metadata.currentDateTime?.formatted || 'Now';
    const systemPrompt = `You are Zoya, the AI Business Partner for the owner of BosMat Studio.
Current Admin: ${customer.name || 'Admin'}
Phone: ${customer.phone || 'N/A'}
Time: ${currentDateTime}

YOUR ROLE:
- You are a proactive, loyal, and smart business assistant.
- You speak casually (Indonesian slang / friendly) but remain efficient.
- Use "Gue/Elo" or "Saya/Anda" naturally but focus on getting things done.
- You help with: Booking (add/edit), CRM (customer info), Finance (income reports), and Chat Management.
- If admin says "tolong balasin", check who is waiting with readDirectMessagesTool.
- If admin says "JEDENG!", analyze last chat activity or plate number to perform a quick task.

CRITICAL:
1. Call tools whenever needed.
2. Be the brain that helps the owner manage everything.
3. Don't repeat what the admin knows. Provide value.

Current Context:
- Studio: Tapos, Depok.
- Service: Repaint & Detailing Motorcycles.`;

    const response = await model.invoke([
        new SystemMessage(systemPrompt),
        ...messages
    ]);

    // Check if tool calls exist
    const isReadyForTools = response.tool_calls && response.tool_calls.length > 0;

    return {
        messages: [response],
        context: {
            ...state.context,
            isReadyForTools: isReadyForTools
        }
    };
}

/**
 * Node: adminExecutorNode
 * Tool handler for Admin Mode.
 */
async function adminExecutorNode(state) {
    console.log('🛠️ --- [ADMIN_EXECUTOR_NODE] Executing Tools ---');
    const lastMessage = state.messages[state.messages.length - 1];
    
    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
        return state;
    }

    const toolOutputs = [];
    for (const toolCall of lastMessage.tool_calls) {
        const toolImplementation = toolsByName[toolCall.name];
        if (toolImplementation) {
            console.log(`[adminExecutor] Running ${toolCall.name}...`);
            try {
                const output = await toolImplementation(toolCall.args);
                toolOutputs.push(new ToolMessage({
                    content: typeof output === 'string' ? output : JSON.stringify(output),
                    tool_call_id: toolCall.id,
                    name: toolCall.name
                }));
            } catch (err) {
                console.error(`[adminExecutor] Error in ${toolCall.name}:`, err);
                toolOutputs.push(new ToolMessage({
                    content: `Error: ${err.message}`,
                    tool_call_id: toolCall.id,
                    name: toolCall.name
                }));
            }
        }
    }

    return {
        messages: toolOutputs,
        context: {
            ...state.context,
            isReadyForTools: false 
        }
    };
}

module.exports = { adminNode, adminExecutorNode };
