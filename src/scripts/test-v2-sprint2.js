const { zoyaAgent } = require('../ai/graph/index');
const { buildPlannerPrompt } = require('../ai/prompts/promptBuilder');

async function run() {
    console.log('--- TEST V2 GRAPH SPRINT 2 (CONFLICT SCENARIO) ---');
    
    // We pass a dummy state that mimics a new message asking for repaint and coating
    // We mock that the intent/extractor node (which is currently just part of consultation) has extracted the requested services.
    // In reality, this would be updated by the planner or an extraction node, but we inject it directly to test the Rule Engine.
    
    const initialState = {
        messages: [{ role: 'user', content: 'Mas, mau repaint body halus sama sekalian di coating ya.' }],
        metadata: {
            phoneReal: '6289999999999',
            isAdmin: false
        },
        consultation: {
            requestedServices: ['repaint', 'coating'],
            knownFacts: {}
        }
    };

    const config = {
        configurable: {
            thread_id: 'test-thread-sprint2'
        }
    };

    try {
        console.log('Invoking Agent...');
        const result = await zoyaAgent.invoke(initialState, config);
        
        console.log('\n--- EXECUTION RESULT ---');
        console.log('Business Flags (from Rule Engine):');
        console.log('- Disabled Services:', result.business?.disabledServices);
        console.log('- Restrictions:', JSON.stringify(result.business?.restrictions, null, 2));

        console.log('\n--- COMPILED PLANNER PROMPT ---');
        const compiledPrompt = buildPlannerPrompt(result);
        console.log(compiledPrompt);

        console.log('\nExecution successful!');
    } catch (err) {
        console.error('Execution Failed:', err);
    }
}

run().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
