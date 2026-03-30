const { zoyaAgent } = require('../src/ai/graph');
const { HumanMessage } = require('@langchain/core/messages');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function runTest() {
    const thread_id = uuidv4();
    const config = { configurable: { thread_id } };

    console.log("--- 🏁 STARTING PING-PONG TEST 🏁 ---\n");

    // TEST 1: Greeting only
    console.log("➡️ USER: Halo");
    let state = await zoyaAgent.invoke(
        { messages: [new HumanMessage("Halo")] },
        config
    );
    console.log("⬅️ ZOYA:", state.messages[state.messages.length - 1].content);
    console.log("📊 Context:", JSON.stringify(state.context, null, 2));
    console.log("\n------------------\n");

    // TEST 2: Intent established but missing many things
    console.log("➡️ USER: Saya Tauhid, mau tanya harga Coating buat NMAX");
    state = await zoyaAgent.invoke(
        { messages: [new HumanMessage("Saya Tauhid, mau tanya harga Coating buat NMAX")] },
        config
    );
    console.log("⬅️ ZOYA:", state.messages[state.messages.length - 1].content);
    console.log("📊 Context:", JSON.stringify(state.context, null, 2));
    console.log("\n------------------\n");

    // TEST 3: Providing one missing piece
    console.log("➡️ USER: Catnya Glossy");
    state = await zoyaAgent.invoke(
        { messages: [new HumanMessage("Catnya Glossy")] },
        config
    );
    console.log("⬅️ ZOYA:", state.messages[state.messages.length - 1].content);
    console.log("📊 Context:", JSON.stringify(state.context, null, 2));
    
    process.exit(0);
}

runTest().catch(console.error);
