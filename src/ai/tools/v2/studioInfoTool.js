const BaseTool = require('./baseTool');
const { getStudioInfoTool: legacyTool } = require('../getStudioInfoTool');

class StudioInfoTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Dapatkan informasi lengkap tentang Bosmat: alamat terkini, jam buka, kontak, dan kebijakan booking';
        this.capability = 'studio_info';
    }

    async _run(parameters, state) {
        const args = {
            infoType: 'all'
        };

        const result = await legacyTool.implementation(args);

        return {
            rawText: result.formattedResponse || result,
            success: result.success
        };
    }
}

module.exports = new StudioInfoTool();
