require('dotenv').config();
const { plannerNode } = require('./src/ai/graph/nodes/planner');
async function test() {
    const state = {
        messages: [{ content: "pcx 150 rencana full bodi halus berapa harganya?", type: "user" }],
        consultation: { requestedServices: [], motorModel: "PCX 150" },
        business: { applicableSOP: [] },
        knowledge: { raw: {} },
        analytics: { buyerStage: "Interested" }
    };
    const res = await plannerNode(state);
    console.log(JSON.stringify(res, null, 2));
}
test();
