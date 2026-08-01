const { buildPlannerPrompt } = require('./src/ai/prompts/promptBuilder');

const state = {
    user: { name: 'Test' },
    vehicle: { model: 'mio smile' },
    consultation: {
        requestedServices: ['Repaint Bodi Halus', 'Repaint Bodi Kasar'],
        knownFacts: {
            motorModel: { value: 'mio smile', state: 'KNOWN' },
            partToRepaint: { value: 'bodi halus dan kasar', state: 'KNOWN' },
            paintColor: { value: 'merah candy', state: 'KNOWN' }
        }
    },
    conversation: { status: 'IN_PROGRESS' },
    metadata: { buyerStage: 'Interested' }
};

const prompt = buildPlannerPrompt(state);
console.log(prompt);
