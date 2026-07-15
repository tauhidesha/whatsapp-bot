const BaseTool = require('./baseTool');
const { getPromoOfTheMonthTool: legacyTool } = require('../getPromoOfTheMonthTool');

class PromoTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Dapatkan informasi promo bulan ini.';
        this.capability = 'promotion';
    }

    async _run(parameters, state) {
        const result = await legacyTool.implementation({});

        return {
            rawText: result,
            success: true
        };
    }
}

module.exports = new PromoTool();
