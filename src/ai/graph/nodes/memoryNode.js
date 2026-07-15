const { extractMemory } = require('../../memory/extractor');

/**
 * Memory Node for Zoya V2
 * Runs asynchronously or at the end of the graph to persist insights.
 */
async function memoryNode(state) {
    console.log('[Memory Node] Updating persistent memory...');

    const newMemory = extractMemory(state);

    return {
        memory: newMemory
    };
}

module.exports = {
    memoryNode
};
