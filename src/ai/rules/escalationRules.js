/**
 * Escalation Rules
 * Rules for handing over the conversation to Admin (Bosmat).
 */

function evaluateEscalation(state) {
    const { messages, consultation } = state;
    
    // We check the latest message or the consultation state for trigger words.
    // In a real system, the extraction node/intent logic would populate flags like `wantsCustomConcept`.
    // For now, we simulate checking known facts or requested services.
    
    const requested = consultation?.requestedServices || [];
    const knownFacts = consultation?.knownFacts || {};

    const escalations = [];

    // Rule: Mobil (Car)
    if (knownFacts.vehicleType === 'mobil' || requested.includes('mobil')) {
        escalations.push({
            type: 'ESCALATION',
            reason: 'Customer menanyakan layanan untuk mobil (Bosmat spesialis motor).',
            action: 'HANDOVER'
        });
    }

    // Rule: Custom Concept
    if (knownFacts.wantsCustomConcept) {
        escalations.push({
            type: 'ESCALATION',
            reason: 'Customer ingin konsultasi konsep motor/warna custom yang butuh arahan langsung dari owner.',
            action: 'HANDOVER'
        });
    }

    // Rule: Price not found
    // If previous tool execution failed to find price
    if (state.tool?.lastCapability === 'pricing' && state.tool?.lastResult?.error === 'PRICE_NOT_FOUND') {
        escalations.push({
            type: 'ESCALATION',
            reason: 'Harga layanan di sistem/tools kosong.',
            action: 'HANDOVER'
        });
    }

    return escalations.length > 0 ? escalations : null;
}

module.exports = {
    evaluateEscalation
};
