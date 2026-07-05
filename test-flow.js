const { PrismaClient } = require('@prisma/client');
const infoCollector = require('./src/ai/graph/nodes/infoCollector.js').infoCollectorNode;

async function run() {
    const state = {
        messages: [{ content: "sampai rangka kak" }],
        context: {
            vehicleType: "Nmax",
            serviceTypes: ["Detailing"],
            paintType: null,
            isBongkarTotal: null,
            detailingFocus: null
        },
        metadata: { prevIntent: "BOOKING_SERVICE", flow: "booking" }
    };

    // We'll mock model.invoke
    const modelMock = {
        invoke: async () => ({
            content: JSON.stringify({
                intent: "BOOKING_SERVICE",
                internal_thought: "User wants bongkar total",
                motor_model: "Nmax",
                service_types: ["Detailing"],
                paint_type: null,
                is_bongkar_total: true,
                detailing_focus: null
            })
        })
    };
    
    // Inject mock (requires modifying infoCollector a bit, or we just rely on require cache override if possible)
}
