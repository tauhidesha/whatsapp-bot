const { extractMemory } = require('../../memory/extractor');
const { getRelevantKnowledge } = require('../../knowledge');

/**
 * Memory Node for Zoya V2
 * Delegates all state management to the LLM-as-State-Manager in extractor.js.
 * Safely handles errors — if extraction fails, existing state is preserved.
 */
async function memoryNode(state) {
    console.log('[Memory Node] Updating persistent memory...');

    let updates = {};
    try {
        updates = await extractMemory(state) || {};
    } catch (err) {
        // Non-fatal: log and continue with empty update
        // LangGraph will keep existing state untouched
        console.error('[Memory Node] extractMemory failed, state preserved:', err.message);
    }

    // ── Cart Invalidation ─────────────────────────────────────────────────────
    // If LLM changed requestedServices, evict any cart items that no longer
    // correspond to an active service. This prevents the Composer from showing
    // stale prices for services the user already cancelled.
    const freshServices = updates.consultation?.requestedServices
        ?? state.consultation?.requestedServices
        ?? [];

    const prevServices = state.consultation?.requestedServices ?? [];
    const servicesChanged = JSON.stringify([...freshServices].sort()) !== JSON.stringify([...prevServices].sort());

    if (servicesChanged && Object.keys(state.cart?.items || {}).length > 0) {
        console.log('[Memory Node] requestedServices changed — invalidating stale cart items.');
        const freshServiceKeys = freshServices.map(s => s.toLowerCase());
        const staleItems = {};
        Object.keys(state.cart.items).forEach(cartKey => {
            // null = signal to state reducer to delete this key
            const isStillActive = freshServiceKeys.some(s => s.includes(cartKey.toLowerCase()) || cartKey.toLowerCase().includes(s));
            if (!isStillActive) {
                staleItems[cartKey] = null;
                console.log(`[Memory Node] Cart item evicted: "${cartKey}"`);
            }
        });
        if (Object.keys(staleItems).length > 0) {
            updates.cart = { items: staleItems };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Load knowledge AFTER extraction so we use the freshest requestedServices
    const recommendedServices = state.consultation?.recommendedServices ?? [];
    const activeServices = [...freshServices, ...recommendedServices];

    const knowledgeText = getRelevantKnowledge(activeServices);
    updates.knowledge = { raw: knowledgeText };

    console.log('[Memory Node] Services for knowledge:', activeServices);
    return updates;
}

module.exports = { memoryNode };
