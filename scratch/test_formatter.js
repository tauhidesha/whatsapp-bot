const { getServiceDetailsTool } = require('../src/ai/tools/getServiceDetailsTool');
const pricingTool = require('../src/ai/tools/v2/pricingTool');

async function test() {
    const res = await pricingTool._run({
        service_name: ['Repaint Bodi Halus', 'Repaint Bodi Kasar'],
        motor_model: 'Vario'
    }, {});
    console.log(res.formattedText);
}
test().catch(console.error);
