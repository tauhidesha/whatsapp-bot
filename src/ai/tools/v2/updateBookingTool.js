const BaseTool = require('./baseTool');
const { updateBookingTool: legacyTool } = require('../updateBookingTool');

class UpdateBookingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Update tanggal atau waktu booking yang sudah ada.';
        this.capability = 'update_booking';
    }

    async _run(parameters, state) {
        const { bookingDate, bookingTime } = parameters;
        const customerPhone = state.metadata?.phoneReal || '6280000000000';

        const args = {
            customerPhone,
            newDate: bookingDate || new Date().toISOString().split('T')[0],
            newTime: bookingTime || '10:00'
        };

        const result = await legacyTool.implementation(args);

        return {
            rawText: result,
            success: result.success
        };
    }
}

module.exports = new UpdateBookingTool();
