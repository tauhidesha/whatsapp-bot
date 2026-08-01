require('dotenv').config();
const { memoryNode } = require('./src/ai/graph/nodes/memoryNode');
async function test() {
    const state = {
        messages: [{ content: "Rencana full bodi halus", type: "user" }],
        consultation: { requestedServices: [] },
        vehicle: {}
    };
    const res = await memoryNode(state);
    console.log(JSON.stringify(res, null, 2));
}
test();
