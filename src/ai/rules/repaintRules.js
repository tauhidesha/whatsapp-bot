/**
 * Repaint Flow Rules
 * Guides the conversation steps for repaint requests.
 */

function evaluateRepaintRules(state) {
    const rules = [];
    const requested = state.consultation?.requestedServices || [];
    
    if (!requested.includes('repaint')) {
        return null;
    }

    const { vehicle, consultation } = state;
    const targetParts = consultation?.targetParts || [];
    const hasColorChoice = !!consultation?.colorChoice;

    // Langkah 1: Tanya jenis motor
    if (!vehicle?.model) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis motor customer (Misal: Nmax, Aerox, dll).'
        });
        return rules; // Pause logic untill fulfilled
    }

    // Langkah 2: Tanya bagian mana yang ingin di-repaint
    if (targetParts.length === 0) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan bagian mana yang ingin di-repaint (Bodi Halus, Velg, Bodi Kasar, atau Full Bodi).'
        });
        return rules;
    }

    // Langkah 3: Tanya pilihan warna
    if (!hasColorChoice) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan pilihan warna yang diinginkan. Beri info jika mungkin ada biaya tambahan (surcharge) untuk warna tertentu (seperti Chrome/Two-Tone).'
        });
        return rules;
    }

    // Opsi Penawaran (Upsell)
    if (targetParts.includes('bodi_halus') || targetParts.includes('full_bodi')) {
        rules.push({
            type: 'UPSELL',
            service: 'Cuci Komplit',
            reason: 'Sekalian tambah layanan Cuci Komplit agar pas motornya selesai dicat, bagian lainnya juga bersih semua.'
        });
    }

    if (targetParts.includes('velg') && !consultation?.knownFacts?.velgCondition) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan kondisi velg: Masih cat original atau sudah pernah dicat ulang? (Beri info ada surcharge biaya paint remover jika sudah pernah dicat ulang).'
        });
    }

    return rules;
}

module.exports = {
    evaluateRepaintRules
};
