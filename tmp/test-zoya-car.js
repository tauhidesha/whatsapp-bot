const { zoyaAgent } = require('../src/ai/graph/index');
const { HumanMessage } = require('@langchain/core/messages');

async function testCar() {
    console.log("--- TEST: CAR INQUIRY Test ---");
    const inputs = {
        messages: [new HumanMessage("halo, bisa repaint mobil toyota avanza gak?")],
        context: {},
        metadata: { conversationId: 'car-test', phoneReal: '628123456789' }
    };
    const config = { configurable: { thread_id: "car-test-123" } };
    const result = await zoyaAgent.invoke(inputs, config);
    console.log("Zoya: \"" + result.messages[result.messages.length - 1].content + "\"");
}

testCar().catch(console.error);
