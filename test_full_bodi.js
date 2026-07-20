require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
global.prisma = new PrismaClient();
const pricingTool = require('./src/ai/tools/v2/pricingTool');

async function main() {
    const res = await pricingTool.execute({
        conversationState: {
            consultation: { requestedServices: ["Repaint Full Bodi Halus"] },
            vehicle: { model: "Vario" }
        },
        parameters: { service_name: ["Repaint Full Bodi Halus"] }
    });
    console.log("Full Bodi Halus:\n", res);

    const res2 = await pricingTool.execute({
        conversationState: {
            consultation: { requestedServices: ["Repaint Full Bodi"] },
            vehicle: { model: "Vario" }
        },
        parameters: { service_name: ["Repaint Full Bodi"] }
    });
    console.log("Full Bodi:\n", res2);
}

main().catch(console.error).finally(() => process.exit(0));
