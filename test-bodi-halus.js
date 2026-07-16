const { zoyaAgent } = require('./src/ai/graph/index');
const process = require('process');

process.env.GOOGLE_API_KEY = "AIzaSyALnE-sJ-qjnRWini7fS2jPddDVF8rIV_I";

async function run() {
    let state = { messages: [] };
    
    let userMsg1 = { role: "user", content: "mas mau repaint nmax" };
    state = await zoyaAgent.invoke({ messages: [userMsg1] }, { configurable: { thread_id: "test-bodi-halus-2" } });
    console.log("AI 1:", state.messages[state.messages.length - 1].content);

    let userMsg2 = { role: "user", content: "bodi halus warna merah candy" };
    state = await zoyaAgent.invoke({ messages: [userMsg2] }, { configurable: { thread_id: "test-bodi-halus-2" } });
    console.log("AI 2:", state.messages[state.messages.length - 1].content);
    
    // Dump consultation
    console.log("\n--- CONSULTATION ---");
    console.log(JSON.stringify(state.consultation, null, 2));
    
    console.log("\n--- PLANNER ---");
    console.log(JSON.stringify(state.planner, null, 2));
}
run();
