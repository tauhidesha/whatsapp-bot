const { zoyaAgent } = require('../ai/graph/index');

async function run() {
    console.log('--- TEST V2 GRAPH SPRINT 3 (OBJECTION SCENARIO) ---');
    
    // We pass a dummy state that mimics a customer hesitating
    const initialState = {
        messages: [{ role: 'user', content: 'Waduh mahal juga ya mas, belum gajian nih saya.' }],
        metadata: {
            phoneReal: '6288888888888',
            isAdmin: false
        },
        conversation: {
            buyerStage: 'Exploring', // Initial stage before this message
            status: 'active'
        },
        memory: {
            identity: {},
            salesMemory: {}
        }
    };

    const config = {
        configurable: {
            thread_id: 'test-thread-sprint3'
        }
    };

    try {
        console.log('Invoking Agent...');
        const result = await zoyaAgent.invoke(initialState, config);
        
        console.log('\n--- EXECUTION RESULT ---');
        console.log('Composer Response:');
        console.log(result.conversation?.lastMessages?.[0]);

        console.log('\n--- MEMORY TRACKER ---');
        console.log('Sales Memory:', result.memory?.salesMemory);
        
        console.log('\n--- ANALYTICS ---');
        console.log('Buyer Stage:', result.analytics?.buyerStage);

        console.log('\nExecution successful!');
    } catch (err) {
        console.error('Execution Failed:', err);
    }
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
