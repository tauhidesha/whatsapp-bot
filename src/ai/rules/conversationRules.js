/**
 * Conversation & Interaction Rules
 * Rules guiding the flow and tone of the interaction.
 */

function evaluateConversationRules(state) {
    const rules = [];
    const { vehicle, consultation } = state;

    // Menangani Banyak Motor
    // If the state indicates multiple vehicles are requested but not yet split
    if (consultation?.vehicleCount > 1 && !consultation?.focusedVehicleId) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Selesaikan 1 motor dulu. Jangan digabung. Pastikan keinginan motor pertama clear, berikan estimasi, baru lanjut bahas motor kedua.'
        });
    }

    // Menangani Penolakan
    // If the planner indicates a hesitation or cooling down stage, or if objections were extracted
    if (state.conversation?.buyerStage === 'Hesitating' || consultation?.knownFacts?.hasObjection?.state === 'KNOWN' || consultation?.knownFacts?.commonObjection?.state === 'KNOWN' || consultation?.knownFacts?.commonObjection?.value) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'JANGAN PERNAH menanyakan "kapan mau eksekusi". Tunjukkan empati dan berikan kenyamanan. Biarkan percakapan menggantung secara positif tanpa paksaan booking.'
        });
    }

    // Alamat & Booking Guideline
    // If planner is providing address
    if (state.planner?.strategy === 'PROVIDE_INFO' && consultation?.knownFacts?.askedAddress?.state === 'KNOWN') {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Berikan alamat lengkap, tapi WAJIB sarankan customer untuk melakukan booking atau setidaknya mengabari terlebih dahulu sebelum datang.'
        });
    }

    // Promo Bundling (Ambil 2 Layanan)
    if (consultation?.requestedServices?.includes('repaint') && consultation?.requestedServices?.length > 1) {
         rules.push({
            type: 'PRICING_GUIDELINE',
            directive: 'Jika ada promo diskon bundling, diskon tersebut hanya memotong harga Repaint Bodi Halus, bukan layanan lainnya.'
        });
    }

    return rules.length > 0 ? rules : null;
}

module.exports = {
    evaluateConversationRules
};
