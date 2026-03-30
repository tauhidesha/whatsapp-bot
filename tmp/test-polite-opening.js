require('dotenv').config();
const { HumanMessage } = require('@langchain/core/messages');
const { classifierNode } = require('../src/ai/graph/nodes/classifier');

async function testPoliteOpening() {
    console.log("--- TESTING POLITE OPENING CLASSIFICATION ---");
    
    const cases = [
        "malam kak mau tanya tanya kak",
        "halo zoya mau konsultasi dong",
        "pagi mau kepo harganya"
    ];

    for (const content of cases) {
        const state = {
            messages: [new HumanMessage(content)],
            metadata: {}
        };
        try {
            const result = await classifierNode(state);
            console.log(`➡️ INPUT: "${content}"`);
            console.log(`📊 INTENT: ${result.intent}`);
            console.log("--------------------");
        } catch (e) {
            console.error(`Error for "${content}":`, e.message);
        }
    }
}

testPoliteOpening().catch(console.error);
