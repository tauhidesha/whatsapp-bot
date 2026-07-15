const { getRelevantKnowledge } = require('../knowledge/index');
const { extractTextFromContent } = require('../graph/utils/sanitizeMessages');

/**
 * Prompt Compiler for Zoya V2
 * Dynamically assembles the context for the LLM based on current state,
 * reducing token bloat by only including what is absolutely necessary.
 */

const fs = require('fs');
const path = require('path');

function buildPlannerPrompt(state) {
    const { consultation, business, conversation, customer, vehicle } = state;
    
    // 1. Identity & System Directive
    let prompt = `Anda adalah Zoya, Sales Consultant di Bosmat Motor.\nTugas Anda adalah menganalisis percakapan dan memutuskan strategi serta aksi selanjutnya.\nAnda HANYA boleh output dalam format JSON sesuai skema yang diminta, TANPA teks tambahan apapun.\n\n`;

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
            const role = msg._getType ? msg._getType() : (msg.role || 'user');
            const textContent = extractTextFromContent(msg.content);
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
    let prompt = `Anda adalah Zoya, Sales Consultant di Bosmat Motor.\n`;
    prompt += `Tugas utama Anda HANYA merespons (menyusun pesan teks) kepada customer berdasarkan arahan (Strategy & Action) dari Planner.\n`;
    prompt += `Anda TIDAK MENGAMBIL KEPUTUSAN, melainkan mengkomunikasikan keputusan Planner dengan gaya bahasa yang natural, ramah, dan empatik.\n\n`;
    
    prompt += `=== COMMUNICATION PRINCIPLES ===\n`;
    prompt += `1. JANGAN TERDENGAR SEPERTI FORM: Jangan tanya beruntun seperti robot. Gunakan bahasa kasual (Mas/Kak).\n`;
    prompt += `2. SATU TUJUAN SATU PERTANYAAN: Jangan borong semua pertanyaan. Fokus pada satu Action dari Planner.\n`;
    prompt += `3. EMPATI DULU: Jika customer bilang jauh atau belum ada uang, tunjukkan empati, jangan langsung jualan/booking.\n`;
    prompt += `4. REKOMENDASI KONSULTATIF: Jelaskan 'kenapa' layanan itu bagus, bukan sekadar menyebut nama layanan.\n`;
    prompt += `5. RINCIKAN HARGA: Jika menyebut harga, sebutkan fasilitas yang didapat.\n`;
    prompt += `6. TONE: Friendly Professional. Jangan terlalu formal, jangan alay.\n`;
    prompt += `7. FORMAT: Paragraf pendek, WA friendly. Maksimal 1-2 emoji keseluruhan.\n\n`;
    
    prompt += `=== DIRECTIVE FROM PLANNER ===\n`;
    prompt += `Strategy: ${plannerDecision.strategy}\n`;
    prompt += `Action: ${plannerDecision.nextAction}\n`;
    if (state.tool?.lastResult) {
        prompt += `Data: ${JSON.stringify(state.tool.lastResult)}\n`;
    }
    prompt += `\n`;

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
            const role = msg._getType ? msg._getType() : (msg.role || 'user');
            const textContent = extractTextFromContent(msg.content);
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
