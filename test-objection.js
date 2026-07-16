const { zoyaAgent } = require('./src/ai/graph/index');

async function run() {
    let state = { messages: [] };
    
    let userMsg1 = { role: "user", content: "poles bodi aerox berapa?" };
    state = await zoyaAgent.invoke({ messages: [userMsg1] }, { configurable: { thread_id: "test-objection-1" } });
    console.log("AI 1:", state.messages[state.messages.length - 1].content);

    let userMsg2 = { role: "user", content: "warna glossy" };
    state = await zoyaAgent.invoke({ messages: [userMsg2] }, { configurable: { thread_id: "test-objection-1" } });
    console.log("AI 2:", state.messages[state.messages.length - 1].content);

    let userMsg3 = { role: "user", content: "waduh jauh om rumah saya di bekasi, nanti dulu deh nabung dulu" };
    state = await zoyaAgent.invoke({ messages: [userMsg3] }, { configurable: { thread_id: "test-objection-1" } });
    console.log("AI 3:", state.messages[state.messages.length - 1].content);
}
run();
