const { extractMemory } = require('../../memory/extractor');
const { getRelevantKnowledge } = require('../../knowledge');

/**
 * Memory Node for Zoya V2
 * Runs asynchronously or at the end of the graph to persist insights.
 */
async function memoryNode(state) {
    console.log('[Memory Node] Updating persistent memory...');

    const updates = await extractMemory(state);
    
    // Load knowledge here so it's loaded only once and available to Rule Engine, Planner, and Composer
    const activeServices = [...(state.consultation?.requestedServices || []), ...(state.consultation?.recommendedServices || [])];
    const knowledgeText = getRelevantKnowledge(activeServices);
    
    updates.knowledge = { raw: knowledgeText };
    
    console.log('[Memory Node] Output:', JSON.stringify(updates, null, 2));

    return updates;
}

module.exports = {
    memoryNode
};
