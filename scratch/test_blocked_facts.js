require('dotenv').config();
const { plannerNode } = require('../src/ai/graph/nodes/planner');
const { ruleEngineNode } = require('../src/ai/graph/nodes/ruleEngine');

async function runTest() {
    let state = {
        consultation: {
            requestedServices: ['repaint bodi kasar'],
            knownFacts: {
                motorModel: 'Vario'
            }
        },
        vehicle: {
            model: 'Vario'
        },
        knowledge: {
            raw: require('../src/ai/knowledge/knowledgeData').serviceKnowledge
        },
        business: {
            sop: require('../src/ai/rules/businessRulesData').businessRules
        },
        messages: [
            { content: 'mau repaint bodi kasar', _getType: () => 'human' }
        ]
    };

    const ruleResult = await ruleEngineNode(state);
    state.business = { ...state.business, ...ruleResult.business };
    console.log("RULES:", JSON.stringify(state.business, null, 2));
}
runTest();
