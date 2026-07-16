const { getDisclosureDirectives } = require('./disclosure');
const { getReadabilityDirectives } = require('./readability');
const { getQuestioningDirectives } = require('./questioning');

/**
 * Aggregates all response policies into a single instruction set for the Composer.
 */
function getResponsePolicies(state, plannerDecision) {
    const policies = [
        ...getDisclosureDirectives(state, plannerDecision),
        ...getReadabilityDirectives(state, plannerDecision),
        ...getQuestioningDirectives(state, plannerDecision)
    ];

    let result = `=== COMMUNICATION PRINCIPLES (STRICT POLICY) ===\n`;
    policies.forEach((p, index) => {
        result += `${index + 1}. ${p}\n`;
    });
    
    return result;
}

module.exports = {
    getResponsePolicies
};
