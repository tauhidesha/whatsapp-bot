const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { zoyaAgent } = require('../src/ai/graph');

async function testIntentShift() {
    console.log("--- TESTING INTENT SHIFT (COATING -> REPAINT) ---");
    
    // Turn 1: User asks for Coating
    let state = {
        messages: [
            new HumanMessage("Mau Coating"),
            new AIMessage("Siap! Boleh sebutin tipe motornya Kak?")
        ],
        customer: { name: "Tauhid" },
        intent: "BOOKING_SERVICE",
        context: {
            vehicleType: null,
            serviceType: "Coating",
            missingQuestions: ["Boleh sebutin tipe motornya Kak?"]
        },
        metadata: { prevIntent: "BOOKING_SERVICE" }
    };

    // Turn 2: User shifts to Repaint instead
    console.log("\n➡️ USER: Gak jadi deh, mau Repaint Bodi aja");
    const messages = [...state.messages, new HumanMessage("Gak jadi deh, mau Repaint Bodi aja")];
    
    try {
        const result = await zoyaAgent.invoke({ ...state, messages }, { configurable: { thread_id: "test_shift_123" } });
        const zoyaMsg = result.messages[result.messages.length - 1].content;
        
        console.log("⬅️ ZOYA:", zoyaMsg);
        console.log("📊 Final Intent:", result.intent);
        console.log("📊 Metadata Mode:", result.metadata.replyMode);
        console.log("📊 Context Vehicles:", result.context.vehicleType);
        console.log("📊 Missing Questions:", result.context.missingQuestions);
        
        // Verifikasi: harusnya menanyakan motor, bukan hal lain peninggalan coating
        if (result.context.missingQuestions[0]?.toLowerCase().includes("motor")) {
            console.log("✅ SUCCESS: Successfully shifted and prioritized motor type!");
        } else {
            console.log("❌ FAILED: Did not prioritize motor type or context was not reset correctly.");
        }
    } catch (e) {
        console.error(e);
    }
}

testIntentShift().catch(console.error);
