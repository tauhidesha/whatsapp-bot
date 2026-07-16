const { extractMemory } = require('../../memory/extractor');

/**
 * Memory Node for Zoya V2
 * Runs asynchronously or at the end of the graph to persist insights.
 */
async function memoryNode(state) {
    console.log('[Memory Node] Updating persistent memory...');

    const updates = await extractMemory(state);
    
    console.log('[Memory Node] Output:', JSON.stringify(updates, null, 2));

    return updates;
}

module.exports = {
    memoryNode
};
