const BaseTool = require('./baseTool');
const { checkBookingAvailabilityTool } = require('../checkBookingAvailabilityTool');

class BookingAvailabilityTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cek ketersediaan slot booking pada tanggal dan jam tertentu';
        this.capability = 'booking_availability';
    }

    async _run(parameters, state) {
        // V1 implementation mapping with fallback to state knownFacts
        const bookingDate = parameters?.bookingDate || state?.consultation?.knownFacts?.bookingDate?.value;
        const bookingTime = parameters?.bookingTime || state?.consultation?.knownFacts?.bookingTime?.value;
        const serviceName = parameters?.serviceName || state?.consultation?.requestedServices?.[0] || 'Layanan Umum';
        const estimatedDurationMinutes = parameters?.estimatedDurationMinutes || 120;
        
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
