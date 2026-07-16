const { serviceKnowledge } = require('./knowledgeData');

/**
 * Knowledge Base Registry
 * Retrieves knowledge specific to the requested services to keep context token-light.
 */

function getRelevantKnowledge(requestedServices = []) {
    console.log(`[Knowledge Engine] Loading context for: ${requestedServices.join(', ') || 'General'}`);
    
    // Base knowledge that is always returned
    const context = {
        general: serviceKnowledge.general,
        faq: serviceKnowledge.faq
    };
    
    if (!requestedServices || requestedServices.length === 0) {
        return context;
    }

    context.services = {};
    
    for (const service of requestedServices) {
        const lowerService = service.toLowerCase();
        
        // Match services dynamically from knowledgeData
        if (serviceKnowledge.services) {
            for (const [key, knowledge] of Object.entries(serviceKnowledge.services)) {
                if (lowerService.includes(key) && !context.services[key]) {
                    context.services[key] = knowledge;
                }
            }
        }
    }

    return context;
}

module.exports = {
    getRelevantKnowledge
};
