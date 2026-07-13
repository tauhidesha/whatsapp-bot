const { generateFollowUpMessage } = require('./src/ai/agents/followUpEngine/messageGenerator.js');

async function run() {
    const mockCustomer = {
        docId: '6281234567890', // Just a placeholder
        name: 'Rully',
        context: {
            motorModel: 'NMAX',
            motorColor: 'Hitam',
            targetServices: ['Repaint Bodi Halus'],
            phone: '6281234567890'
        },
        metadata: {
            lastMessageAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
    };
    
    console.log("Generating message...");
    const result = await generateFollowUpMessage(mockCustomer, { angle: 'standard' });
    console.log("RESULT:");
    console.log(result);
}

run();
