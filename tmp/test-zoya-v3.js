const { zoyaAgent } = require('../src/ai/graph');
const { HumanMessage } = require('@langchain/core/messages');

async function testZoya(text, description) {
    console.log(`\n--- TEST: ${description} ---`);
    console.log(`User: "${text}"`);
    
    const initialState = {
        messages: [new HumanMessage(text)],
        context: {
            vehicleType: null,
            serviceType: null,
            paintType: null,
            isBongkarTotal: null,
            detailingFocus: null,
            colorChoice: null,
            isPreviouslyPainted: null,
            missingQuestions: [],
            isReadyForTools: false
        },
        metadata: {
            customerId: 'test-user',
            customerName: 'Sobat BosMat'
        }
    };

    const result = await zoyaAgent.invoke(initialState, { configurable: { thread_id: 'test-thread' } });
    const lastMsg = result.messages[result.messages.length - 1].content;
    const intent = result.intent;
    const replyMode = result.metadata.replyMode;
    const isReady = result.context.isReadyForTools;

    console.log(`Intent: ${intent}`);
    console.log(`Reply Mode: ${replyMode}`);
    console.log(`Ready for Tools: ${isReady}`);
    console.log(`Zoya: "${lastMsg}"`);
}

async function runTests() {
    // 1. Strict GREETING
    await testZoya("Halo", "Strict GREETING Test");

    // 2. CONSULTATION
    await testZoya("Malam kak, mau tanya-tanya nih tentang motor saya", "CONSULTATION Test");

    // 3. GENERAL_INQUIRY without Vehicle (Should NOT trigger tools)
    await testZoya("Cat motor harganya berapa ya?", "GENERAL_INQUIRY (No Vehicle) Test");

    // 4. Incomplete Info (Has Vehicle, missing service detail)
    await testZoya("Kalau cat motor PCX berapa kak harganya?", "Incomplete Info (Missing Service Detail) Test");
}

runTests().catch(console.error);
