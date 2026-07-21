const BaseTool = require('./baseTool');
const { triggerBosMatTool } = require('../triggerBosMatTool');

class EscalateHumanTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Digunakan saat Zoya butuh bantuan BosMat karena tidak yakin jawabannya atau butuh intervensi manusia.';
        this.capability = 'escalate_human';
    }

    async _run(parameters, state) {
        // V1 implementation mapping
        const args = {
            reason: parameters.reason || state.planner?.reasoning?.reason || 'Customer butuh bantuan admin',
            customerQuestion: parameters.customerQuestion || 'Pertanyaan tidak bisa dijawab sistem',
            senderNumber: state.metadata?.phoneReal || 'Unknown',
            senderName: state.customer?.name || 'Customer'
        };
        
        const result = await triggerBosMatTool.implementation(args);

        return {
            rawText: result.message || result,
            success: result.success
        };
    }
}

module.exports = new EscalateHumanTool();
