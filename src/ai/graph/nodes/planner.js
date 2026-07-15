/**
 * Planner Node for Zoya V2
 * Responsible for decision making based on the conversation state.
 * Outputs a structured JSON. It DOES NOT generate natural language for the user.
 */

async function plannerNode(state) {
    console.log('[Planner Node] Analyzing State...');
    
    // In a full implementation, this node builds the prompt using the Prompt Assembly System
    // and calls the LLM (e.g. Gemini Flash Lite) requesting JSON output.
    
    // For Sprint 1, we simulate the LLM output based on the current stage and missing facts.
    // This is a stub that updates the planner object in the state.

    let nextAction = 'WAIT';
    let capability = null;
    let strategy = 'BUILD_TRUST';

    const stage = state.consultation?.stage || 'DISCOVERING';
    const goal = state.consultation?.goal;

    if (stage === 'DISCOVERING' && !goal) {
        nextAction = 'ASK';
        strategy = 'CLARIFY';
    } else if (goal && stage === 'DISCOVERING') {
        nextAction = 'RECOMMEND';
        capability = 'pricing'; 
        strategy = 'EDUCATE';
    } else if (stage === 'PRICING') {
        nextAction = 'PRICE';
        capability = 'pricing';
        strategy = 'EDUCATE';
    } else if (stage === 'BOOKING') {
        nextAction = 'BOOK';
        capability = 'booking';
        strategy = 'BUILD_TRUST';
    } else if (stage === 'OBJECTION') {
        nextAction = 'WAIT';
        strategy = 'EMPATHIZE';
    }

    const plannerUpdate = {
        goal: goal || 'Menentukan kebutuhan customer',
        reason: 'Simulated reasoning based on current stage',
        nextAction: nextAction,
        capability: capability,
        confidence: 0.9,
        strategy: strategy
    };

    return {
        planner: plannerUpdate,
        analytics: {
            plannerRuns: (state.analytics?.plannerRuns || 0) + 1
        }
    };
}

module.exports = {
    plannerNode
};
