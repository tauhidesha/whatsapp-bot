/**
 * Memory Extractor for Zoya V2
 * Simulates extracting Identity, Relationship, and Sales memory from messages.
 */

function extractMemory(state) {
    console.log('[Memory Extractor] Extracting memory features...');
    
    // In full implementation, this calls an LLM to summarize/extract info
    // For Sprint 3, we use a simple heuristic mock
    
    const messages = state.messages || [];
    const lastUserMessage = messages.findLast(m => m.role === 'user')?.content?.toLowerCase() || '';

    const newSalesMemory = {};
    const newIdentityMemory = {};

    // Mock extraction: Catching "belum gajian" as an objection
    if (lastUserMessage.includes('belum gajian') || lastUserMessage.includes('mahal') || lastUserMessage.includes('jauh')) {
        newSalesMemory.common_objection = lastUserMessage;
    }

    if (lastUserMessage.includes('beat') || lastUserMessage.includes('vario')) {
        newIdentityMemory.motor = lastUserMessage.includes('beat') ? 'Beat' : 'Vario';
    }

    // Merge with existing state memory
    return {
        identity: {
            ...state.memory?.identity,
            ...newIdentityMemory
        },
        salesMemory: {
            ...state.memory?.salesMemory,
            ...newSalesMemory
        },
        relationship: state.memory?.relationship || {}
    };
}

module.exports = {
    extractMemory
};
