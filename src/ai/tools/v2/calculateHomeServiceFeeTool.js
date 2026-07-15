const BaseTool = require('./baseTool');
const { calculateHomeServiceFeeTool: legacyTool } = require('../calculateHomeServiceFeeTool');

class CalculateHomeServiceFeeTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Hitung biaya home service berdasarkan lokasi.';
        this.capability = 'calculate_home_service';
    }

    async _run(parameters, state) {
        // Need to pass subtotal. The parameters from capabilityRouter might include it.
        const { subtotal } = parameters;
        const customerPhone = state.metadata?.phoneReal || '6280000000000';

        const args = {
            customerPhone,
            subtotal: subtotal || 0
        };

        const result = await legacyTool.implementation(args);

        return {
            rawText: result.message || result.error || JSON.stringify(result),
            success: result.success
        };
    }
}

module.exports = new CalculateHomeServiceFeeTool();
