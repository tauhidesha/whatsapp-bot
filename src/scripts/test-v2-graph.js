const { zoyaAgent } = require('../ai/graph/index');

async function run() {
    console.log('--- TEST V2 GRAPH EXECUTION ---');
    
    // We pass a dummy state that mimics a new message
    const initialState = {
        messages: [{ role: 'user', content: 'berapa harga balikin ke aslinya nmax full bodi?' }],
        metadata: {
            phoneReal: '6281234567890',
            isAdmin: false
        }
    };

    const config = {
        configurable: {
            thread_id: 'test-thread-v2'
        }
    };

    try {
        console.log('Invoking Agent...');
        const result = await zoyaAgent.invoke(initialState, config);
        
        console.log('\n--- EXECUTION RESULT ---');
        console.log('Planner Goal:', result.planner?.decision?.goal);
        console.log('Planner Action:', JSON.stringify(result.planner?.execution?.nextAction));
        console.log('Planner Tool Intent:', result.planner?.execution?.toolIntent);
        console.log('Planner Strategy:', result.planner?.decision?.strategy);
        console.log('Buyer Stage:', result.planner?.decision?.buyerStage);
        
        console.log('\nTool Last Intent:', result.tool?.lastCapability);
        console.log('Tool Result:', result.tool?.lastResult);
        
        console.log('\nComposer Last Message:');
        console.log(result.messages?.[result.messages.length - 1]?.content || 'No message generated');
        
        console.log('\nExecution successful!');
    } catch (err) {
        console.error('Execution Failed:', err);
    }
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
