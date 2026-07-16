require('dotenv').config();
const { zoyaAgent } = require('./src/ai/graph/index');
const { HumanMessage } = require('@langchain/core/messages');

async function run() {
    const threadId = "test_scenario_1_" + Date.now();
    
    console.log("--- Turn 1 ---");
    const input1 = {
        messages: [new HumanMessage({ content: "mas mau repaint nmax" })],
        metadata: { phoneReal: threadId, senderName: "Test User" }
    };
    let result = await zoyaAgent.invoke(input1, { configurable: { thread_id: threadId } });
    console.log("AI:", result.messages[result.messages.length - 1].content);
    
    console.log("--- Turn 2 ---");
    const input2 = {
        messages: [new HumanMessage({ content: "bodi halus warna merah candy" })],
        metadata: { phoneReal: threadId, senderName: "Test User" }
    };
    result = await zoyaAgent.invoke(input2, { configurable: { thread_id: threadId } });
    console.log("AI:", result.messages[result.messages.length - 1].content);
}

run().catch(console.error);
