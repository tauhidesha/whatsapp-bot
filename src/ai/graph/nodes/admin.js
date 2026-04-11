const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const { toolsByName, zoyaTools } = require('../tools');
const { getActivePromo } = require('../../utils/promoConfig');
const studioMetadata = require('../../constants/studioMetadata');

/**
 * Sanitize message history for Gemini API compliance.
 *
 * Gemini enforces strict turn ordering:
 *   1. Must start with HumanMessage (not ToolMessage or orphan AIMessage).
 *   2. Every AIMessage with tool_calls must be IMMEDIATELY followed by
 *      a ToolMessage for EACH tool_call_id (no gaps, no extra messages).
 *   3. No orphaned ToolMessages (without a preceding AIMessage with tool_calls).
 *
 * Strategy:
 *   - Trim from the front until we hit a HumanMessage.
 *   - Do a forward-pass to find and remove any broken tool_call ↔ ToolMessage pairs.
 *   - Trim trailing AIMessage(tool_calls) with no following ToolMessages.
 */
function sanitizeMessagesForGemini(messages) {
    let sanitized = [...messages];

    // Helper to get message type reliably (handles plain JSON or LangChain objects)
    const getMessageType = (msg) => {
        if (typeof msg._getType === 'function') return msg._getType();
        if (msg.type) return msg.type;
        if (msg.tool_calls && msg.tool_calls.length > 0) return 'ai';
        if (msg.tool_call_id) return 'tool';
        return 'human';
    };

    // --- Step 1: Trim from front until first HumanMessage ---
    while (sanitized.length > 0) {
        const first = sanitized[0];
        const type = getMessageType(first);
        if (type === 'human') break;
        if (type === 'ai' && (!first.tool_calls || first.tool_calls.length === 0)) break;
        sanitized.shift();
    }

    // --- Step 2: Forward-pass — validate tool_call ↔ ToolMessage pairing ---
    let i = 0;
    while (i < sanitized.length) {
        const msg = sanitized[i];
        const type = getMessageType(msg);
        
        if (type === 'ai' && msg.tool_calls?.length > 0) {
            const expectedIds = new Set(msg.tool_calls.map(tc => tc.id));
            const foundIds = new Set();

            // Collect consecutive ToolMessages immediately after this AIMessage
            let j = i + 1;
            while (j < sanitized.length && getMessageType(sanitized[j]) === 'tool') {
                foundIds.add(sanitized[j].tool_call_id);
                j++;
            }

            // If all tool_call_ids are matched → valid, skip over them
            const allMatched = [...expectedIds].every(id => foundIds.has(id));
            if (allMatched) {
                i = j;
            } else {
                sanitized.splice(i, j - i);
            }
        } else {
            i++;
        }
    }

    // --- Step 3: Trailing guard — remove trailing AIMessage(tool_calls) with no ToolMessages ---
    while (sanitized.length > 0) {
        const last = sanitized[sanitized.length - 1];
        const type = getMessageType(last);
        if (type === 'ai' && last.tool_calls?.length > 0) {
            sanitized.pop();
        } else {
            break;
        }
    }

    return sanitized;
}

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

# PENTING — KONTEKS SESI INI
Kamu sedang berbicara LANGSUNG dengan Owner/Admin BosMat Studio.
BUKAN customer. JANGAN tanya nomor WA, JANGAN jalankan flow CS customer.
Langsung jawab pertanyaan bisnis/teknis secara to the point.

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

    const rawHistory = messages.slice(-10);
    const safeHistory = sanitizeMessagesForGemini(rawHistory);
    console.log(`[ADMIN_NODE] History: ${messages.length} total → last 10 → ${safeHistory.length} after sanitize`);

    const response = await model.invoke([
        new SystemMessage(systemPrompt),
        ...safeHistory
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
