const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool');

async function run() {
    const input = {
        service_name: ["Repaint Bodi Halus", "Repaint Bodi Kasar"],
        motor_model: "Yamaha Fazzio",
        size: "M"
    };
    const result = await getServiceDetailsTool.implementation(input);
    console.log(JSON.stringify(result, null, 2));
}
run();
