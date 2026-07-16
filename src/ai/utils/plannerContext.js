/**
 * Deterministic Planner Context Derivation
 * 
 * Calculates the current macro state of the conversation deterministically
 * to reduce LLM overhead and hallucination.
 */

function derivePlannerContext(state) {
    const context = {
        service: null,
        flow: null,
        currentStep: null
    };

    const requested = state.consultation?.requestedServices || [];
    
    // Determine Service and Flow
    if (requested.some(s => s.toLowerCase().includes('repaint'))) {
        context.service = 'REPAINT';
        if (requested.some(s => s.toLowerCase().includes('full bodi') && !s.toLowerCase().includes('halus'))) {
            context.flow = 'FULL_BODY';
        } else if (requested.some(s => s.toLowerCase().includes('bodi halus'))) {
            context.flow = 'BODY_HALUS';
        } else if (requested.some(s => s.toLowerCase().includes('velg'))) {
            context.flow = 'VELG';
        } else if (requested.some(s => s.toLowerCase().includes('bodi kasar'))) {
            context.flow = 'BODY_KASAR';
        }
    }

    // Determine Current Step deterministically
    const goal = state.planner?.decision?.goal || state.consultation?.stage;
    const action = state.planner?.execution?.nextAction?.type;

    if (goal === 'COLLECT_INFO' && action === 'ASK') {
        const target = state.planner?.execution?.nextAction?.target;
        context.currentStep = target ? `WAITING_FOR_${target.toUpperCase()}` : 'WAITING_FOR_INFO';
    } else if (goal === 'PRICE_ESTIMATION') {
        context.currentStep = 'PRESENTING_PRICE';
    } else if (goal === 'BOOKING') {
        context.currentStep = 'WAITING_FOR_BOOKING_DATE';
    } else {
        context.currentStep = goal || 'DISCOVERING';
    }

    return context;
}

module.exports = {
    derivePlannerContext
};
