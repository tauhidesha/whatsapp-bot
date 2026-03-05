const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool.js');

async function run() {
    console.log("--- Testing Generic Repaint with Motor Model (Vario) ---");
    const res1 = await getServiceDetailsTool.implementation({ service_name: "repaint", motor_model: "vario" });
    console.log(JSON.stringify(res1, null, 2));

    console.log("\n--- Testing Generic Repaint WITHOUT Motor Model ---");
    const res2 = await getServiceDetailsTool.implementation({ service_name: "repaint" });
    console.log(JSON.stringify(res2, null, 2));

    console.log("\n--- Testing Generic Detailing ---");
    const res3 = await getServiceDetailsTool.implementation({ service_name: "detailing" });
    console.log(JSON.stringify(res3, null, 2));
}

run();
