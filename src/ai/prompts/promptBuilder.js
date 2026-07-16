const { getRelevantKnowledge } = require('../knowledge/index');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');
/**
 * Prompt Compiler for Zoya V2
 * Dynamically assembles the context for the LLM based on current state,
 * reducing token bloat by only including what is absolutely necessary.
 */

const fs = require('fs');
const path = require('path');

const ZOYA_PERSONA = `Anda adalah Zoya, AI Sales Consultant di Bosmat Repaint Studio.
Bosmat adalah bengkel spesialis repaint (cat ulang) bodi/velg dan detailing motor kelas premium.
Peran Anda adalah menjadi konsultan yang ramah, profesional, dan empatik untuk membantu customer mengambil keputusan yang tepat mengenai perawatan motor mereka.`;

function buildPlannerPrompt(state) {
    const { consultation, business, conversation, customer, vehicle } = state;

    // 1. Identity & System Directive
    let prompt = `${ZOYA_PERSONA}\n`;
    prompt += `Sebagai Planner, tugas Anda adalah menganalisis percakapan dan memutuskan strategi serta aksi selanjutnya.\n`;
    prompt += `Anda HANYA boleh output dalam format JSON sesuai skema yang diminta, TANPA teks tambahan apapun.\n\n`;

    // 2. Business Flags (from Rule Engine)
    prompt += `=== BUSINESS CONSTRAINTS ===\n`;
    if (business?.disabledServices?.length > 0) {
        prompt += `- DILARANG menawarkan atau memproses layanan berikut: ${business.disabledServices.join(', ')}\n`;
    }
    if (business?.restrictions?.length > 0) {
        business.restrictions.forEach(r => {
            prompt += `- RESTRIKSI (${r.service}): ${r.reason}. Solusi: ${r.suggestedAction}\n`;
        });
    }
    if (business?.guidelines?.length > 0) {
        prompt += `\n=== CONVERSATION GUIDELINES ===\n`;
        business.guidelines.forEach(g => {
            prompt += `- ${g.directive}\n`;
        });
    }
    if (business?.upsells?.length > 0) {
        prompt += `\n=== UPSELL OPPORTUNITIES ===\n`;
        business.upsells.forEach(u => {
            prompt += `- Tawarkan ${u.service}: ${u.reason}\n`;
        });
    }
    prompt += `\n`;

    // 3. Relevant Knowledge (Service Models)
    const activeServices = consultation?.requestedServices || [];
    if (activeServices.length > 0) {
        const knowledge = getRelevantKnowledge(activeServices);
        prompt += `=== SERVICE KNOWLEDGE ===\n`;
        prompt += JSON.stringify(knowledge, null, 2) + `\n\n`;
    }

    // 4. Current State Snapshot
    prompt += `=== CURRENT STATE ===\n`;
    prompt += `Customer: ${customer?.name} (Status: ${customer?.status})\n`;
    prompt += `Vehicle: ${vehicle?.brand || 'Unknown'} ${vehicle?.model || 'Unknown'}\n`;
    prompt += `Known Facts: ${JSON.stringify(consultation?.knownFacts || {})}\n`;
    prompt += `Conversation Status: ${conversation?.status}\n\n`;

    // 5. Conversation History
    prompt += `=== CONVERSATION HISTORY ===\n`;
    if (state.messages && state.messages.length > 0) {
        state.messages.forEach(msg => {
            const roleType = getMessageType(msg) || 'user';
            const role = roleType === 'human' ? 'user' : roleType;
            const content = msg.kwargs?.content || msg.content;
            const textContent = extractTextFromContent(content);
            prompt += `${role.toUpperCase()}: ${textContent}\n`;
        });
    } else {
        prompt += `(No conversation yet)\n`;
    }
    prompt += `\n`;

    return prompt;
}

function buildComposerPrompt(state, plannerDecision) {
    // Similar to Planner, but with the goal of writing natural text based on planner's strategy
    let prompt = `${ZOYA_PERSONA}\n`;
    prompt += `Sebagai Composer, tugas utama Anda HANYA menyusun pesan teks balasan kepada customer berdasarkan arahan (Strategy & Action) dari Planner.\n`;
    prompt += `Anda TIDAK MENGAMBIL KEPUTUSAN, melainkan mengkomunikasikan keputusan Planner dengan gaya bahasa yang natural.\n\n`;

    prompt += `=== COMMUNICATION PRINCIPLES ===\n`;
    prompt += `1. JANGAN TERDENGAR SEPERTI FORM: Jangan tanya beruntun seperti robot. Gunakan bahasa kasual (Mas/Kak).\n`;
    prompt += `2. SATU TUJUAN SATU PERTANYAAN: Jangan borong semua pertanyaan. Fokus pada satu Action dari Planner.\n`;
    prompt += `3. EMPATI DULU: Jika customer bilang jauh atau belum ada uang, tunjukkan empati, jangan langsung jualan/booking.\n`;
    prompt += `4. REKOMENDASI KONSULTATIF: Jelaskan 'kenapa' layanan itu bagus, bukan sekadar menyebut nama layanan.\n`;
    prompt += `5. RINCIKAN HARGA: Jika menyebut harga, sebutkan fasilitas yang didapat.\n`;
    prompt += `6. TONE: Friendly Professional. Jangan terlalu formal, jangan alay.\n`;
    prompt += `7. FORMAT & STYLING:\n`;
    prompt += `   - Paragraf pendek, sangat mudah dibaca di layar HP.\n`;
    prompt += `   - MAKSIMAL 1-2 emoji untuk seluruh teks balasan.\n`;
    prompt += `   - WA FORMATTING: Untuk membuat tulisan TEBAL, gunakan satu bintang (contoh: *Teks Tebal*). JANGAN PERNAH menggunakan dua bintang (**Teks**).\n`;
    prompt += `   - BULLET POINTS: JANGAN gunakan bintang (*) untuk bullet points karena akan merusak format WA. Gunakan tanda strip (-) atau angka (1., 2.).\n`;
    prompt += `   - Pastikan tanda bintang pembuka dan penutup (*...*) menempel pada kata tanpa spasi, dan berada di baris yang sama.\n`;
    prompt += `8. LINK & LOKASI: Jika memberikan informasi alamat atau link (seperti Google Maps) yang didapat dari data, BERIKAN LINK ASLINYA secara utuh (contoh: https://maps.app.goo.gl/...). JANGAN menyuruh pengguna untuk mencari sendiri di Maps.\n\n`;

    // Add current context (Time, Date, Sender Name)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    });
    prompt += `=== CURRENT CONTEXT ===\n`;
    prompt += `Waktu Sekarang: ${formatter.format(now)} WIB\n`;
    prompt += `Nama Customer: ${state.customer?.name || 'Customer'}\n\n`;

    prompt += `=== DIRECTIVE FROM PLANNER ===\n`;
    prompt += `Strategy: ${plannerDecision.strategy}\n`;
    prompt += `Action: ${plannerDecision.nextAction}\n`;
    if (state.tool?.lastResult) {
        prompt += `Data: ${JSON.stringify(state.tool.lastResult)}\n`;
    }
    prompt += `\n`;

    const activeServices = state.consultation?.requestedServices || [];
    if (activeServices.length > 0) {
        const { getRelevantKnowledge } = require('../knowledge/index');
        const knowledge = getRelevantKnowledge(activeServices);
        prompt += `=== SERVICE KNOWLEDGE (CATATAN HARGA & FASILITAS) ===\n`;
        prompt += `Gunakan data ini jika Anda perlu menyebutkan harga atau menjelaskan fasilitas layanan.\n`;
        prompt += JSON.stringify(knowledge, null, 2) + `\n\n`;
    }

    if (state.business?.restrictions?.length > 0) {
        prompt += `=== BUSINESS CONSTRAINTS ===\n`;
        state.business.restrictions.forEach(r => {
            prompt += `Jelaskan penolakan/restriksi ini dengan sopan: ${r.reason}\n`;
        });
        prompt += `\n`;
    }

    prompt += `=== CONVERSATION HISTORY ===\n`;
    if (state.messages && state.messages.length > 0) {
        state.messages.forEach(msg => {
            const roleType = getMessageType(msg) || 'user';
            const role = roleType === 'human' ? 'user' : roleType;
            const content = msg.kwargs?.content || msg.content;
            const textContent = extractTextFromContent(content);
            prompt += `${role.toUpperCase()}: ${textContent}\n`;
        });
    } else {
        prompt += `(No conversation yet)\n`;
    }
    prompt += `\n`;

    return prompt;
}

module.exports = {
    buildPlannerPrompt,
    buildComposerPrompt
};
