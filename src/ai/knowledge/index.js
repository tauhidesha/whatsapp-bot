const { repaintKnowledge } = require('./repaint');
const { detailingKnowledge } = require('./detailing');

/**
 * Knowledge Base Registry
 * Retrieves knowledge specific to the requested services to keep context token-light.
 */

const KNOWLEDGE_REGISTRY = {
    'repaint': repaintKnowledge,
    'detailing': detailingKnowledge,
    // 'coating': coatingKnowledge,
    // 'wash': washKnowledge,
};

function getRelevantKnowledge(requestedServices = []) {
    console.log(`[Knowledge Engine] Loading context for: ${requestedServices.join(', ') || 'General'}`);
    
    if (!requestedServices || requestedServices.length === 0) {
        // Return general knowledge if no service specified yet
        return {
            general: "Bosmat Motor Spesialis Repaint dan Perawatan Motor. Tanyakan apa yang mereka butuhkan."
        };
    }

    const context = {};
    for (const service of requestedServices) {
        const key = service.toLowerCase();
        if (KNOWLEDGE_REGISTRY[key]) {
            context[key] = KNOWLEDGE_REGISTRY[key];
        }
    }

    return context;
}

module.exports = {
    getRelevantKnowledge
};
