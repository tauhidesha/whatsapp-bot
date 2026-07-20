const { syncGraphStateToCRM, getCustomerContext } = require('./src/ai/utils/mergeCustomerContext.js');
const prisma = require('./src/lib/prisma.js');

async function run() {
    const senderNumber = "62899999999@c.us";
    const mockState = {
        vehicle: { model: "Vario 150", paintType: "glossy" },
        consultation: {
            stage: "QUOTING",
            goal: "GET_PRICE",
            requestedServices: ["Repaint Bodi Halus", "Cuci Komplit"],
            knownFacts: {
                colorChoice: "Merah",
                isBongkarTotal: true
            }
        },
        metadata: {
            phoneReal: senderNumber,
            visualSummary: null
        }
    };

    console.log("Syncing state...");
    await syncGraphStateToCRM(senderNumber, mockState);

    console.log("Getting context...");
    const ctx = await getCustomerContext(senderNumber);
    console.log(ctx);

    process.exit(0);
}
run();
