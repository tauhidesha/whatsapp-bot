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
    const knownFacts = consultation?.knownFacts || {};
    const hasColorChoice = !!knownFacts.paintShade || !!knownFacts.colorChoice;
    const knownMotor = knownFacts.motor || vehicle?.model;
    
    // Langkah 1: Tanya jenis motor
    if (!knownMotor) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan jenis motor customer (Misal: Nmax, Aerox, dll).'
        });
        return rules; // Pause logic untill fulfilled
    }

    // Langkah 2: Tanya bagian mana yang ingin di-repaint
    // Cuma 'repaint' umum, belum spesifik (bodi halus, kasar, velg)
    const isSpecificRepaint = requested.some(s => s.toLowerCase().includes('bodi') || s.toLowerCase().includes('velg'));
    const knownRepaintTarget = knownFacts.repaintTarget || knownFacts.scope;
    if (!isSpecificRepaint && !knownRepaintTarget) {
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
            directive: 'JANGAN menahan info harga hanya karena belum tahu warna. Berikan estimasi harga jika belum diberikan. HINDARI pertanyaan warna kecuali sudah sepakat estimasi.'
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

    // Pricing step
    const isShowingPrice = (state.planner?.nextAction === 'SHOW_PRICE' || state.planner?.strategy === 'EDUCATE');
    if (isShowingPrice) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Pastikan untuk merangkum total harga sebagai range (misal: "estimasi total sekitar 2.2 - 2.5 juta") jika ada banyak layanan. JANGAN tanya "masuk budget nggak?". Tanyakan saja "Bagaimana mas, mau lanjut booking atau ada yang mau ditanyakan soal paketnya?".'
        });
    }

    const isVelg = requested.some(s => s.toLowerCase().includes('velg')) || knownRepaintTarget?.toLowerCase().includes('velg');
    if (isVelg && !knownFacts.wheelCondition && !knownFacts.velgCondition) {
        rules.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Tanyakan secara natural apakah velg masih cat bawaan pabrik atau sudah pernah dicat ulang, karena jika pernah dicat ulang biasanya perlu paint remover dulu sebelum proses repaint.'
        });
    }

    return rules;
}

module.exports = {
    evaluateRepaintRules
};
