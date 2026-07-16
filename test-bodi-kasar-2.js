const { zoyaAgent } = require('./src/ai/graph/index');

async function run() {
    let state = { messages: [] };
    
    let userMsg1 = { role: "user", content: "mau repaint velg vario 150 warna gold" };
    state = await zoyaAgent.invoke({ messages: [userMsg1] }, { configurable: { thread_id: "test-velg-1" } });
    console.log("AI 1:", state.messages[state.messages.length - 1].content);

    let userMsg2 = { role: "user", content: "udah pernah direpaint om" };
    state = await zoyaAgent.invoke({ messages: [userMsg2] }, { configurable: { thread_id: "test-velg-1" } });
    console.log("AI 2:", state.messages[state.messages.length - 1].content);
}
run();
