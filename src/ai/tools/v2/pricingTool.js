const BaseTool = require('./baseTool');
const { getServiceDetailsTool } = require('../getServiceDetailsTool');

class PricingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cek harga, durasi, dan SOP layanan (Repaint, Detailing, Coating)';
        this.capability = 'pricing';
    }

    async _run(parameters, state) {
        // V1 implementation mapping
        // We pass arguments as required by V1 implementation: implementation({ service_name, motor_model, size, color_name })
        const { service_name, motor_model, size, color_name } = parameters;
        
        // Ensure service_name is an array as expected by V1
        const serviceNameArray = Array.isArray(service_name) ? service_name : [service_name];

        const resultString = await getServiceDetailsTool.implementation({
            service_name: serviceNameArray,
            motor_model,
            size,
            color_name
        });

        // The old tool returns a formatted string. We can return it directly or try to parse it.
        // For compatibility with Composer, we return it as an object with raw text.
        return {
            rawText: resultString,
            service: serviceNameArray.join(', ')
        };
    }
}

module.exports = new PricingTool();
