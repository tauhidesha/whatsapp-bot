require('dotenv').config();
const { extractMemory } = require('./src/ai/memory/extractor');

async function test() {
    const input = {
        messages: [{ content: "Rencana full bodi halus" }]
    };
    const result = await extractMemory(input);
    console.log(JSON.stringify(result, null, 2));
}
test();
