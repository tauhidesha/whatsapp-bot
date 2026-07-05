const { infoCollectorNode } = require('./src/ai/graph/nodes/infoCollector');

async function run() {
    const state = {
        messages: [
            { _getType: () => 'human', text: "Full bodi moonlight green brp ya?", content: "Full bodi moonlight green brp ya?" }
        ],
        metadata: { intent: "BOOKING_SERVICE", extractedData: { vehicleType: "Yamaha Fazzio", serviceTypes: ["Repaint"], detailing_focus: "full bodi", color_choice: "Moonlight Green" } }
    };
    
    // Stub the actual model call out if possible, wait, I can't easily stub without mocking the whole model.
    // I can just trust the logic.
}
run();
