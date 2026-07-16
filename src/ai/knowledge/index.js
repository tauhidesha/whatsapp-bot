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
        const lowerService = service.toLowerCase();
        
        // Cek semua key di registry, jika service dari user mengandung kata tersebut (misal: 'repaint bodi halus' includes 'repaint')
        for (const [key, knowledge] of Object.entries(KNOWLEDGE_REGISTRY)) {
            if (lowerService.includes(key) && !context[key]) {
                context[key] = knowledge;
            }
        }
    }

    return context;
}

module.exports = {
    getRelevantKnowledge
};
