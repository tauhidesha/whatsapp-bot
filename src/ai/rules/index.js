const { evaluateCoatingRestriction } = require('./coatingRules');
const { evaluateEscalation } = require('./escalationRules');
const { evaluateConversationRules } = require('./conversationRules');
const { evaluateDetailingRules } = require('./detailingRules');
const { evaluateRepaintRules } = require('./repaintRules');

/**
 * Business Rule Engine
 * Evaluates the current state against all business rules and outputs Business Flags.
 */

function executeRules(state) {
    console.log('[Rule Engine] Evaluating business rules...');
    
    const flags = {
        disabledServices: [],
        promotions: [],
        upsells: [],
        restrictions: [], // Full restriction objects for Context
        escalations: [],
        guidelines: []
    };

    // 1. Evaluate Coating Restrictions
    const coatingRestriction = evaluateCoatingRestriction(state);
    if (coatingRestriction && coatingRestriction.status === 'DISABLED') {
        flags.disabledServices.push(coatingRestriction.service);
        flags.restrictions.push(coatingRestriction);
    }

    // 2. Evaluate Escalation Rules
    const escalations = evaluateEscalation(state);
    if (escalations) {
        flags.escalations.push(...escalations);
    }

    // 3. Evaluate Conversation Guidelines
    const guidelines = evaluateConversationRules(state);
    if (guidelines) {
        flags.guidelines.push(...guidelines);
    }

    // 4. Evaluate Detailing Rules
    const detailingRules = evaluateDetailingRules(state);
    if (detailingRules) {
        detailingRules.forEach(rule => {
            if (rule.type === 'CONVERSATION_GUIDELINE') flags.guidelines.push(rule);
            if (rule.type === 'UPSELL') flags.upsells.push(rule);
        });
    }

    // 5. Evaluate Repaint Rules
    const repaintRules = evaluateRepaintRules(state);
    if (repaintRules) {
        repaintRules.forEach(rule => {
            if (rule.type === 'CONVERSATION_GUIDELINE') flags.guidelines.push(rule);
            if (rule.type === 'UPSELL') flags.upsells.push(rule);
        });
    }

    return flags;
}

module.exports = {
    executeRules
};
