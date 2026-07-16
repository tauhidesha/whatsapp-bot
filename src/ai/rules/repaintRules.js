/**
 * Repaint Flow Rules
 * Guides the conversation steps for repaint requests.
 */

function evaluateRepaintRules(state) {
    const rules = [];
    const requested = state.consultation?.requestedServices || [];
    
    // Cek apakah ada layanan repaint yang direquest
    const isRepaintRequested = requested.some(s => s.toLowerCase().includes('repaint'));
    
    if (!isRepaintRequested) {
        return null;
    }

    const { vehicle, consultation } = state;
    const hasColorChoice = !!consultation?.knownFacts?.colorChoice;
    
    // Langkah 1: Tanya jenis motor
    if (!vehicle?.model) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis motor customer (Misal: Nmax, Aerox, dll).'
        });
        return rules; // Pause logic untill fulfilled
    }

    // Langkah 2: Tanya bagian mana yang ingin di-repaint
    // Cuma 'repaint' umum, belum spesifik (bodi halus, kasar, velg)
    const isSpecificRepaint = requested.some(s => s.toLowerCase().includes('bodi') || s.toLowerCase().includes('velg'));
    if (!isSpecificRepaint) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan bagian mana yang ingin di-repaint (Bodi Halus, Velg, Bodi Kasar, atau Full Bodi).'
        });
        return rules;
    }

    // Langkah 3: Tanya pilihan warna (JANGAN JADIKAN BLOCKER UNTUK HARGA)
    // Jika belum ada warna, tetap berikan guideline tapi biarkan logic lanjut ke bawah
    // agar planner bisa memanggil PricingTool dan memaparkan harga
    if (!hasColorChoice) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Kustomer belum memilih warna. JANGAN menahan harga. SEGERA berikan estimasi harga (mulai dari Paket Ekonomis hingga Premium). Setelah memaparkan harga, baru tanyakan apakah harga tersebut masuk budget dan tawarkan rekomendasi warna.'
        });
        // Kita HAPUS 'return rules;' di sini agar flow tidak terputus dan PricingTool bisa dipanggil.
    }

    // Opsi Penawaran (Upsell)
    const isBodiHalus = requested.some(s => s.toLowerCase().includes('bodi halus') || s.toLowerCase().includes('full bodi'));
    if (isBodiHalus) {
        rules.push({
            type: 'UPSELL',
            service: 'Cuci Komplit',
            reason: 'Sekalian tambah layanan Cuci Komplit agar pas motornya selesai dicat, bagian lainnya juga bersih semua.'
        });
    }

    const isVelg = requested.some(s => s.toLowerCase().includes('velg'));
    if (isVelg && !consultation?.knownFacts?.velgCondition) {
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
