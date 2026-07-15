const BaseTool = require('./baseTool');
const { notifyVisitIntentTool: legacyTool } = require('../notifyVisitIntentTool');

class NotificationTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Beritahu Bosmat bahwa customer ingin datang / mampir.';
        this.capability = 'notification';
    }

    async _run(parameters, state) {
        const args = {
            customerName: state.customer?.name || 'Customer',
            customerPhone: state.metadata?.phoneReal || '6280000000000'
        };

        const result = await legacyTool.implementation(args);

        return {
            rawText: result.message || result,
            success: result.success
        };
    }
}

module.exports = new NotificationTool();
