require('dotenv').config();
const { evaluateRepaintRules } = require('./src/ai/rules/repaintRules');
const { plannerNode } = require('./src/ai/graph/nodes/planner');
const { composerNode } = require('./src/ai/graph/nodes/composer');

async function main() {
    const state = {
        customer: { name: 'Budi' },
        consultation: {
            stage: 'COLLECT_INFO',
            requestedServices: ['repaint bodi halus vario'],
            knownFacts: { motorModel: 'Vario 150', partToRepaint: 'bodi halus' }
        },
        vehicle: { model: 'Vario 150' },
        messages: [{ kwargs: { content: 'repaint vario bodi halus aja', type: 'human' } }]
    };

    console.log('--- Rule Engine ---');
    state.business = evaluateRepaintRules(state);

    console.log('\n--- Planner ---');
    const plannerResult = await plannerNode(state);
    state.planner = plannerResult.planner;

    console.log('\n--- Composer ---');
    const composerResult = await composerNode(state);
}
main();
