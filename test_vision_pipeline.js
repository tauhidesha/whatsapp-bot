require('dotenv').config({ path: '/Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/.env' });
const { HumanMessage } = require('@langchain/core/messages');
const { zoyaAgent } = require('./src/ai/graph/index');

async function testVision() {
    const messageContent = [
        { type: 'text', text: 'ini bisa direpaint ga kak?' },
        { type: 'image_url', image_url: 'https://storage.googleapis.com/proudcity/mebanenc/uploads/2021/03/placeholder-image.png' }
    ];
    
    const input = {
        messages: [new HumanMessage({ content: messageContent })],
        metadata: {
            phoneReal: '628123456789',
            senderName: 'TestUser',
            isAdmin: false
        }
    };
    
    console.log("Invoking Zoya...");
    const config = { configurable: { thread_id: 'test-vision-123' } };
    const result = await zoyaAgent.invoke(input, config);
    
    console.log("\n=== FINAL RESULT ===");
    console.log("Visual Summary:", result.metadata?.visualSummary);
    console.log("Zoya Response:", result.messages[result.messages.length - 1].content);
}

testVision().catch(console.error);
