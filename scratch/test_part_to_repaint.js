require('dotenv').config();
const { plannerNode } = require('../src/ai/graph/nodes/planner');
const { ruleEngineNode } = require('../src/ai/graph/nodes/ruleEngine');

async function runTest() {
    let state = {
        consultation: {
            requestedServices: ['repaint'],
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
            { content: 'mau repaint vario nih', _getType: () => 'human' }
        ]
    };

    const ruleResult = await ruleEngineNode(state);
    state.business = { ...state.business, ...ruleResult.business };
    
    const plannerResult = await plannerNode(state);
    console.log(JSON.stringify(plannerResult, null, 2));
}
runTest();
