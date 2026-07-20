const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool');

async function run() {
    const res = await getServiceDetailsTool.implementation({ motor_model: 'Vario', service_name: 'Repaint Bodi Halus' });
    console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
