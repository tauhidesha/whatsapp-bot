const { executeRules } = require('../../rules/index');

/**
 * Rule Engine Node for Zoya V2
 * Executes business rules BEFORE the planner.
 * Injects constraints, disabled services, and upsell opportunities into the `business` state.
 */
async function ruleEngineNode(state) {
    console.log('[Rule Engine Node] Evaluating constraints...');

    // Call the core rule engine
    const businessFlags = executeRules(state);

    // Return the updated state under the `business` channel
    return {
        business: businessFlags
    };
}

module.exports = {
    ruleEngineNode
};
