require('dotenv').config();
const pricingTool = require('./src/ai/tools/v2/pricingTool');

async function test() {
    const state = {
        consultation: {
            motorModel: "PCX 150",
            motorType: "Besar",
            requestedServices: ["Repaint Bodi Halus"]
        }
    };
    const parameters = { service: "Repaint Bodi Halus" };
    const result = await pricingTool._run(parameters, state);
    console.log(JSON.stringify(result, null, 2));
}
test();
