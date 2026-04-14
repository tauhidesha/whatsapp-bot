const { AIMessage } = require('@langchain/core/messages');

/**
 * Extracts the message type reliably, handling both LangChain class instances
 * and plain objects restored from persistence.
 *
 * @param {Object} msg - The message object.
 * @returns {string|null} - 'human', 'ai', 'tool', or null if unknown.
 */
function getMessageType(msg) {
    if (!msg) return null;
    
    // 1. LangChain Class Method
    if (typeof msg._getType === 'function') return msg._getType();
    
    // 2. Persistence Fallback (LangChain ID array structure)
    // [ "langchain_core", "messages", "HumanMessage" ]
    if (msg.id && Array.isArray(msg.id) && msg.id.length >= 3) {
        const className = msg.id[2];
        if (className === 'HumanMessage') return 'human';
        if (className === 'AIMessage') return 'ai';
        if (className === 'ToolMessage') return 'tool';
        if (className === 'SystemMessage') return 'system';
    }
    
    // 3. Explicit type field (Standard fallback, ignore serialization metadata)
    if (msg.type && msg.type !== 'constructor') {
        if (msg.type === 'user') return 'human';
        return msg.type;
    }
    
    // 4. Structural detection
    if (msg.tool_calls && msg.tool_calls.length > 0) return 'ai';
    if (msg.tool_call_id) return 'tool';
    
    return null;
}

/**
 * Sanitize message history for Gemini API compliance.
 *
 * Gemini enforces strict turn ordering:
 *   1. Must start with HumanMessage (not ToolMessage or orphan AIMessage).
 *   2. Every AIMessage with tool_calls must be IMMEDIATELY followed by
 *      a ToolMessage for EACH tool_call_id (no gaps, no extra messages).
 *   3. No orphaned ToolMessages (without a preceding AIMessage with tool_calls).
 *   4. Strip 'thinking' blocks from content (leaked from Gemini 2.5 thinking response).
 *
 * Strategy:
 *   - Map and filter blocks before sequence validation.
 *   - Trim from the front until we hit a HumanMessage.
 *   - Do a forward-pass to find and remove any broken tool_call ↔ ToolMessage pairs.
 *   - Trim trailing AIMessage(tool_calls) with no following ToolMessages.
 */
function sanitizeMessagesForGemini(messages) {
    if (!messages || !Array.isArray(messages)) return [];

    // Batasi HANYA maksimal 10 pesan terakhir agar context lebih spesifik (Request Mas)
    const recentMessages = messages.slice(-10);

    // --- Step 0: Normalize serialized LangChain messages & Strip 'thinking' blocks ---
    let sanitized = recentMessages.map(msg => {
        // Fix for LangChain serialized messages (e.g. from MemorySaver/Database) lacking direct .content
        let safeMsg = msg;
        if (safeMsg && safeMsg.kwargs && safeMsg.content === undefined) {
            safeMsg = { 
                ...safeMsg, 
                content: safeMsg.kwargs.content,
                tool_calls: safeMsg.tool_calls || safeMsg.kwargs.tool_calls,
                tool_call_id: safeMsg.tool_call_id || safeMsg.kwargs.tool_call_id,
                name: safeMsg.name || safeMsg.kwargs.name
            };
        }

        const isAI = getMessageType(safeMsg) === 'ai';
        if (isAI && Array.isArray(safeMsg.content)) {
            const filtered = msg.content.filter(c => c.type !== 'thinking');
            if (filtered.length !== msg.content.length) {
                // Return a new instance with the same class but cleaned content
                return msg.constructor !== Object 
                    ? msg.lc_kwargs 
                        ? new msg.constructor({ ...msg.lc_kwargs, content: filtered })
                        : new AIMessage({ ...msg, content: filtered })
                    : { ...msg, content: filtered };
            }
        }
        return msg;
    });

    // --- Step 1: Trim from front until first HumanMessage ---
    while (sanitized.length > 0) {
        const first = sanitized[0];
        const type = getMessageType(first);
        if (type === 'human') break;
        // Exception: allow AI message if it's NOT a tool call (just text)
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
                // Remove broken pair
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
 * Extracts text content from a message, handling both string and block-based formats.
 * Automatically filters out non-textual blocks such as 'thinking' and 'tool_use'.
 *
 * @param {string|Array} content - The message content to extract text from.
 * @param {string} joiner - String to join multiple text blocks.
 * @returns {string} - The extracted text content.
 */
function extractTextFromContent(content, joiner = '\n') {
    if (!content) return '';
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
        return content
            .filter(item => item && item.type === 'text')
            .map(item => item.text || '')
            .filter(text => text !== '')
            .join(joiner);
    }
    
    // Handle cases where content might be a non-standard object (e.g. from ToolMessage)
    if (typeof content === 'object') {
        return content.text || JSON.stringify(content);
    }
    
    return String(content);
}

module.exports = { 
    sanitizeMessagesForGemini,
    extractTextFromContent,
    getMessageType
};
