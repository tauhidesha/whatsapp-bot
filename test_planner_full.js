require('dotenv').config();
const { plannerNode } = require('./src/ai/graph/nodes/planner');
async function test() {
    const state = {
        messages: [{ content: "Rencana full bodi halus pcx 150", type: "user" }],
        consultation: { requestedServices: ["Repaint Bodi Halus"] },
        business: { applicableSOP: [] },
        knowledge: { raw: {} },
        analytics: { buyerStage: "Exploring" }
    };
    const res = await plannerNode(state);
    console.log(JSON.stringify(res, null, 2));
}
test();
