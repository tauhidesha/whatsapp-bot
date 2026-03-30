const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { zoyaAgent } = require('../src/ai/graph');

async function testStale() {
    console.log("--- TESTING STALE QUESTION BEHAVIOR ---");
    
    // Turn 1: User asks for Coating, Zoya asks for Motor
    let state = {
        messages: [
            new HumanMessage("Mau Coating"),
            new AIMessage("Siap! Boleh sebutin tipe motornya Kak?")
        ],
        customer: { name: "Tauhid" },
        context: {
            vehicleType: null,
            serviceType: "Coating",
            missingQuestions: ["Boleh sebutin tipe motornya Kak?"]
        },
        metadata: {}
    };

    // Turn 2: User says "Malam" (Greeting)
    state.messages.push(new HumanMessage("Malam"));
    
    console.log("\n➡️ USER: Malam (after previously asked for motor)");
    try {
        const result = await zoyaAgent.invoke(state, { configurable: { thread_id: "test_stale_123" } });
        const zoyaMsg = result.messages[result.messages.length - 1].content;
        console.log("⬅️ ZOYA:", zoyaMsg);
        console.log("📊 Intent:", result.intent);
        console.log("📊 Missing Questions:", result.context.missingQuestions);
        
        if (zoyaMsg.toLowerCase().includes("motor")) {
            console.error("❌ FAILED: Still asking for motor during greeting!");
        } else {
            console.log("✅ SUCCESS: Only greeted back!");
        }
    } catch (e) {
        console.error(e);
    }
}

testStale().catch(console.error);
