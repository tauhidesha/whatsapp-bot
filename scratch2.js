const { formatterNode } = require('./src/ai/graph/nodes/formatter');
const state = {
    customer: { name: 'Test' },
    intent: 'BOOKING_SERVICE',
    context: {
        vehicleType: 'Fazzio',
        serviceTypes: ['Repaint Bodi Halus', 'Repaint Bodi Kasar'],
        paintType: null,
        isBongkarTotal: null,
        detailingFocus: 'full bodi',
        colorChoice: 'red candy',
        packageChoice: null,
        comboOffered: false,
        missingQuestions: []
    },
    metadata: {
        replyMode: 'inform',
        visualSummary: 'Tidak ada foto',
        comboPromo: { promoText: 'promo', comboDiscount: 0.15, comboMinServices: 2 },
        toolResult: {
            category: 'repaint_bodi_halus',
            results: [{
                category: 'repaint_bodi_halus',
                candidates: [
                    { name: 'Premium', price: 2000 },
                    { name: 'Standar', price: 1000 }
                ]
            }]
        }
    },
    messages: []
};

// We will stub the LLM call to just print the system prompt
const proxyquire = require('proxyquire');
const formatterProxy = proxyquire('./src/ai/graph/nodes/formatter', {
    '@langchain/core/messages': {
        SystemMessage: class SystemMessage {
            constructor(text) { console.log("SYSTEM PROMPT:\n", text); }
        },
        HumanMessage: class HumanMessage {
            constructor() {}
        },
        AIMessage: class AIMessage {
            constructor() {}
        }
    },
    '../../llm': {
        getModel: () => ({
            invoke: async () => ({ content: '{"greeting":"hi","main_content":"test","internal_thought":"test"}' })
        })
    }
});

async function test() {
    await formatterProxy.formatterNode(state);
}
test();
