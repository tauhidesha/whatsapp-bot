require('dotenv').config();
const { extractMemory } = require('./src/ai/memory/extractor');
async function test() {
    const res = await extractMemory(
        [{ content: "Rencana full bodi halus", type: "user" }],
        { consultation: { requestedServices: [] }, vehicle: {} }
    );
    console.log(JSON.stringify(res, null, 2));
}
test();
