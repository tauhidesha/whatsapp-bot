const BaseTool = require('./baseTool');
const { checkBookingAvailabilityTool } = require('../checkBookingAvailabilityTool');

class BookingAvailabilityTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cek ketersediaan slot booking pada tanggal dan jam tertentu';
        this.capability = 'booking_availability';
    }

    async _run(parameters, state) {
        // V1 implementation mapping
        const { bookingDate, bookingTime, serviceName, estimatedDurationMinutes } = parameters;
        
        const result = await checkBookingAvailabilityTool.implementation({
            bookingDate,
            bookingTime,
            serviceName,
            estimatedDurationMinutes
        });

        // The old tool returns an object { isAvailable, suggestions, reason, warning }
        // We return it exactly as is for the composer to consume.
        return result;
    }
}

module.exports = new BookingAvailabilityTool();
