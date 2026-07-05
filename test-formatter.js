const { formatterNode } = require('./src/ai/graph/nodes/formatter');
const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool');
const prisma = require('./src/lib/prisma');
const { HumanMessage } = require('@langchain/core/messages');

async function run() {
    const res = await getServiceDetailsTool.implementation({
        serviceName: 'Repaint Bodi Halus',
        motorModel: 'Fazzio',
        extraContext: {}
    });
    
    // Simulate formatter node state
    const state = {
        customer: { name: 'Budi' },
        intent: 'INQUIRY_PRICE',
        context: {
            vehicleType: 'Fazzio',
            serviceTypes: ['Repaint Bodi Halus'],
            detailingFocus: '',
            isBongkarTotal: false,
            colorChoice: '',
            velgColorChoice: ''
        },
        metadata: {
            toolResult: res,
            replyMode: 'inform',
            visualSummary: 'User tidak mengirim foto.',
            comboPromo: {
                promoText: "Diskon 15% kalau ambil 2 layanan.",
                comboDiscount: 0.15,
                comboMinServices: 2
            }
        },
        messages: [
            new HumanMessage({ content: "halo kak mau nanya kalau repaint bodi halus fazzio berapa ya harganya?" })
        ]
    };
    
    console.log("--- Tool Result Category ---");
    console.log(res.category);
    
    console.log("\\n--- Calling Formatter ---");
    const result = await formatterNode(state);
    
    console.log("\\n--- AI Reply ---");
    console.log(result.messages[result.messages.length - 1].content);
    
    await prisma.$disconnect();
}
run();
