require('dotenv').config();
const { zoyaAgent } = require('./src/ai/graph/index');
const { HumanMessage } = require('@langchain/core/messages');

async function runTest() {
    console.log('Invoking Zoya with test input...');
    const result = await zoyaAgent.invoke({
        messages: [
            new HumanMessage("Bang mau nanya dong") // Simulate previous context
        ]
    });
    
    // Simulate user message
    const userMessage = "ada retak dipinggir gitu paling 2 cm di bodi belakang, nah untuk di spakbor patah sampai lepas tapi patahannya saya simapan.";
    console.log(`\nUser: ${userMessage}`);
    
    const nextResult = await zoyaAgent.invoke({
        messages: [
            ...result.messages,
            new HumanMessage(userMessage)
        ]
    });

    const aiMessage = nextResult.messages[nextResult.messages.length - 1].content;
    console.log(`\nZoya Response: ${aiMessage}`);
    
    // Extracted Memory
    console.log('\nExtracted Memory State (Consultation):');
    console.log(JSON.stringify(nextResult.consultation, null, 2));
}

runTest().catch(console.error);
