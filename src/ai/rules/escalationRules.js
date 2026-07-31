/**
 * Escalation Rules
 * Rules for handing over the conversation to Admin (Bosmat).
 */

const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');

function evaluateEscalation(state) {
    const { messages, consultation } = state;
    
    // We check the latest message or the consultation state for trigger words.
    // In a real system, the extraction node/intent logic would populate flags like `wantsCustomConcept`.
    // For now, we simulate checking known facts or requested services.
    
    const requested = consultation?.requestedServices || [];
    const knownFacts = consultation?.knownFacts || {};

    const escalations = [];

    // Rule: Mobil (Car)
    if (knownFacts.vehicleType?.value === 'mobil' || requested.includes('mobil')) {
        escalations.push({
            type: 'ESCALATION',
            reason: 'Customer menanyakan layanan untuk mobil (Bosmat spesialis motor).',
            action: 'HANDOVER'
        });
    }

    // Rule: Custom Concept
    if (knownFacts.wantsCustomConcept?.state === 'KNOWN' || knownFacts.wantsCustomConcept?.value) {
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

    // Rule: Customer minta contoh warna / foto referensi
    // Trigger: knownFacts (set by memory extractor) OR keyword fallback on last user message
    const wantsColorExample = knownFacts.wantsColorExample === true;
    let keywordMatch = false;
    if (!wantsColorExample && Array.isArray(messages)) {
        const lastUserMsg = [...messages].reverse().find(m => {
            const t = getMessageType(m) || 'user';
            return t === 'human' || t === 'user';
        });
        if (lastUserMsg) {
            const text = extractTextFromContent(
                lastUserMsg.kwargs?.content || lastUserMsg.content || ''
            ).toLowerCase();
            const colorPhotoKeywords = [
                'contoh warna', 'foto warna', 'foto contoh', 'contoh foto',
                'gambar warna', 'referensi warna', 'referensi foto',
                'kirim foto', 'kirim gambar', 'ada fotonya', 'ada gambarnya',
                'liat contoh', 'lihat contoh', 'mau liat', 'mau lihat',
                'bisa kirim', 'kasih contoh'
            ];
            keywordMatch = colorPhotoKeywords.some(kw => text.includes(kw));
        }
    }

    if (wantsColorExample || keywordMatch) {
        escalations.push({
            type: 'ESCALATION',
            reason: 'Customer minta contoh warna atau foto referensi hasil pengerjaan.',
            action: 'HANDOVER',
            message: 'Customer minta contoh warna / foto referensi. Tolong kirimkan foto contoh hasil repaint ke customer ini ya boss 🙏'
        });
    }

    return escalations.length > 0 ? escalations : null;
}

module.exports = {
    evaluateEscalation
};
