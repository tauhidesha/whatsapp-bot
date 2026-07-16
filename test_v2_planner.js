require('dotenv').config();
const { evaluateRepaintRules } = require('./src/ai/rules/repaintRules');
const { plannerNode } = require('./src/ai/graph/nodes/planner');

async function main() {
    const state = {
        customer: { name: 'Budi' },
        consultation: {
            stage: 'COLLECT_INFO',
            requestedServices: ['repaint bodi halus vario'],
            knownFacts: { motor: 'Vario 150', scope: 'bodi halus' }
        },
        vehicle: { model: 'Vario 150' },
        messages: [{ kwargs: { content: 'repaint vario bodi halus aja', type: 'human' } }]
    };

    console.log('--- Rule Engine ---');
    state.business = evaluateRepaintRules(state);
    console.log(JSON.stringify(state.business, null, 2));

    console.log('\n--- Planner ---');
    const plannerResult = await plannerNode(state);
    console.log(JSON.stringify(plannerResult, null, 2));
}
main();
