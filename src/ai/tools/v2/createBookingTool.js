const BaseTool = require('./baseTool');
const { createBookingTool: legacyTool } = require('../createBookingTool');

class CreateBookingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Buat booking baru.';
        this.capability = 'create_booking';
    }

    async _run(parameters, state) {
        // Map V2 parameters to V1 arguments
        const { service_name, motor_model, bookingDate, bookingTime } = parameters;
        
        const args = {
            customerName: state.customer?.name || 'Customer',
            customerPhone: state.metadata?.phoneReal || '6280000000000',
            serviceName: Array.isArray(service_name) ? service_name.join(', ') : (service_name || state.consultation?.requestedServices?.join(', ') || 'Repaint'),
            bookingDate: bookingDate || state.consultation?.knownFacts?.bookingDate?.value || new Date().toISOString().split('T')[0],
            bookingTime: bookingTime || state.consultation?.knownFacts?.bookingTime?.value || '10:00',
            motorModel: motor_model || state.consultation?.knownFacts?.motorModel?.value || state.memory?.identity?.motor || 'Motor'
        };

        const result = await legacyTool.implementation(args);

        return {
            rawText: result,
            success: result.success,
            bookingId: result.bookingId
        };
    }
}

module.exports = new CreateBookingTool();
