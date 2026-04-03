const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const { toolsByName, zoyaTools } = require('../tools');
const { getActivePromo } = require('../../utils/promoConfig');
const studioMetadata = require('../../constants/studioMetadata');

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

    // Identifikasi alat yang relevan untuk Admin (gunakan nama fungsi dari toolDefinition)
    const adminToolNames = [
        'generateMarketingCopy',
        'crmManagement',
        'addTransaction',
        'updateTransaction',
        'deleteTransaction',
        'getTransactionHistory',
        'calculateFinances',
        'createBooking',
        'updateBooking',
        'checkBookingAvailability',
        'readDirectMessages',
        'sendMessage',
        'updateCustomerLabel',
        'updateCustomerContext',
        'getServiceDetails',
        'getStudioInfo',
        'sendStudioPhoto',
        'getCurrentDateTime'
    ];

    // Filter tool definition untuk binding ke LLM
    const toolDefinitions = zoyaTools
        .filter(t => t && t.toolDefinition && t.toolDefinition.function && adminToolNames.includes(t.toolDefinition.function.name))
        .map(t => t.toolDefinition);

    const modelConfig = {
        model: process.env.AI_MODEL || 'gemini-flash-lite-latest',
        maxOutputTokens: 2048,
        temperature: 0
    };

    let model = new ChatGoogleGenerativeAI(modelConfig);

    // Defensive binding for different LangChain versions
    if (typeof model.bindTools === 'function') {
        model = model.bindTools(toolDefinitions);
    } else if (typeof model.bind === 'function') {
        model = model.bind({ tools: toolDefinitions });
    } else {
        console.warn('[ADMIN_NODE] Model does not support bindTools or bind. Proceeding without tools.');
    }

    const currentDateTime = metadata.currentDateTime?.formatted || 'Now';
    const systemPrompt = `# ROLE
Kamu adalah Zoya, **AI Business Partner** resmi untuk owner ${studioMetadata.name}. 
Kamu bukan sekadar asisten, tapi delegasi terpercaya yang membantu mengelola CRM, Finance, dan Booking dengan visi bisnis yang tajam.

# PERSONALITY
- Proaktif, cerdas, loyal, dan efisien.
- Bahasa: Santai (Indonesian slang / semi-formal) layaknya partner diskusi yang asik (Gue/Elo atau Saya/Anda diperbolehkan).
- **Direct Action**: Jika owner minta hapus, tambah, atau ubah data (transaksi/booking), SEGERA eksekusi menggunakan tool yang sesuai TANPA perlu konfirmasi ulang. Owner sudah memberikan mandat penuh padamu.

# CORE RESPONSIBILITIES
1. **Chat Management**: Jika diminta "balasin", gunakan \`readDirectMessages\` untuk melihat siapa yang menunggu, lalu berikan saran balasan atau kirim langsung.
2. **Finance & CRM**: Pantau kesehatan keuangan studio (income/expense) dan hubungan pelanggan.
3. **Smart Logic (JEDENG!)**: Jika owner menyebut "JEDENG!", itu perintah untuk menganalisis data terakhir (misal naskah chat atau plat nomor) dan melakukan tindakan cerdas paling logis secara instan.

# STRATEGIC GUIDELINES
- Berikan insight, bukan sekadar data. (Contoh: "Bulan ini cuan naik 20% Mas, kebanyakan dari repaint bodi halus.")
- Selalu utamakan integritas data studio.
- Jika ada customer yang belum bayar atau telat ambil motor, ingatkan secara proaktif.

# CURRENT CONTEXT
- Lokasi Studio: ${studioMetadata.location.address} (Landmark: ${studioMetadata.location.landmark}).
- Spesialisasi: Repaint Bodi Halus/Kasar, Velg, Detailing, Coating.`;

    const response = await model.invoke([
        new SystemMessage(systemPrompt),
        ...messages.slice(-10)
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
                // Auto-inject senderNumber for tools that need it
                const args = {
                    ...toolCall.args,
                    senderNumber: state.customer?.phone || state.metadata?.phoneReal
                };

                const output = await toolImplementation(args);
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
