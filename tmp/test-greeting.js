const { HumanMessage } = require('@langchain/core/messages');
const { zoyaAgent } = require('../src/ai/graph');

async function testGreeting() {
    console.log("--- TESTING GREETING BEHAVIOR ---");
    
    let state = {
        messages: [new HumanMessage("Malam Kak")],
        customer: { name: "Tauhid" },
        context: {
            vehicleType: null,
            serviceType: null,
            paintType: null,
            isReadyForTools: null,
            missingQuestions: []
        },
        metadata: {}
    };

    const randomThreadId = `test_greeting_${Date.now()}`;
    console.log(`\n➡️ USER: Malam Kak (Thread: ${randomThreadId})`);
    const result = await zoyaAgent.invoke(state, { configurable: { thread_id: randomThreadId } });
    const zoyaMsg = result.messages[result.messages.length - 1].content;
    console.log("⬅️ ZOYA:", zoyaMsg);
    console.log("📊 Intent:", result.intent);
    console.log("📊 Missing Questions:", result.context.missingQuestions);
    
    if (result.context.missingQuestions.length > 0) {
        console.error("❌ FAILED: Zoya asked data questions on a greeting!");
    } else {
        console.log("✅ SUCCESS: Zoya greeted back without robotic questions.");
    }
}

testGreeting().catch(console.error);
