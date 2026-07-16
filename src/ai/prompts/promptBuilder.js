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
    if (state.knowledge?.raw) {
        const knowledgeStr = typeof state.knowledge.raw === 'object' ? JSON.stringify(state.knowledge.raw, null, 2) : state.knowledge.raw;
        prompt += `=== SERVICE KNOWLEDGE ===\n`;
        prompt += `${knowledgeStr}\n\n`;
    }

    // 4. Current State Snapshot
    prompt += `=== CURRENT STATE ===\n`;
    prompt += `Customer: ${customer?.name} (Status: ${customer?.status})\n`;
    prompt += `Vehicle: ${vehicle?.brand || 'Unknown'} ${vehicle?.model || 'Unknown'}\n`;
    prompt += `Known Facts: ${JSON.stringify(consultation?.knownFacts || {})}\n`;
    prompt += `Conversation Status: ${conversation?.status}\n\n`;
    
    prompt += `=== PLANNER DIRECTIVES ===\n`;
    prompt += `- Anda mengendalikan state graph dengan struktur objek JSON: decision, execution, conversation, dan reasoning.\n`;
    prompt += `- [decision.buyerStage]: Evaluasi stage customer saat ini (Exploring, Comparing, Interested, Ready, atau Booking).\n`;
    prompt += `- [execution.toolIntent]: Gunakan intent generik (GET_PRICE, CREATE_BOOKING, CHECK_AVAILABILITY, SEND_NOTIFICATION, ANSWER_FAQ, ESCALATE_HUMAN) jika butuh data eksternal, atau 'NONE' jika tidak.\n`;
    prompt += `- [conversation.informationPriority]: Tentukan prioritas urutan tipe informasi yang harus disusun oleh Composer.\n`;
    prompt += `- BACA "Known Facts" di atas. JANGAN meminta Composer untuk menanyakan fakta yang sudah diketahui.\n`;
    prompt += `- Tentukan fakta apa yang masih kurang dari "Known Facts" untuk mencapai goal, dan tuangkan ke dalam "reasoning.missingFacts".\n\n`;

    // 5. Tool Output (for Re-evaluation Pass)
    if (state.tool?.lastResult) {
        prompt += `=== CAPABILITY TOOL OUTPUT ===\n`;
        prompt += `Data berikut didapatkan dari eksekusi tool ${state.tool.lastCapability || 'sebelumnya'}:\n`;
        prompt += JSON.stringify(state.tool.lastResult, null, 2) + `\n`;
        prompt += `Gunakan data ini untuk merumuskan aksi selanjutnya (contoh: ubah strategy menjadi EDUCATE/SHOW_PRICE, kosongkan capability).\n\n`;
    }

    // 6. Conversation History
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

const { getResponsePolicies } = require('../response/policy');

function buildComposerPrompt(state, plannerDecision, prioritizedData = null) {
    // Similar to Planner, but with the goal of writing natural text based on planner's strategy
    let prompt = `${ZOYA_PERSONA}\n`;
    prompt += `Sebagai Composer, tugas utama Anda HANYA menyusun pesan teks balasan kepada customer berdasarkan arahan (Strategy & Action) dari Planner.\n`;
    prompt += `Anda TIDAK MENGAMBIL KEPUTUSAN, melainkan mengkomunikasikan keputusan Planner dengan gaya bahasa yang natural.\n\n`;

    // Inject dynamic response policies
    prompt += getResponsePolicies(state, plannerDecision) + `\n`;

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
    prompt += `Goal: ${plannerDecision.decision?.goal}\n`;
    prompt += `Strategy: ${plannerDecision.decision?.strategy}\n`;
    prompt += `Buyer Stage: ${plannerDecision.decision?.buyerStage}\n`;
    prompt += `Action Type: ${plannerDecision.execution?.nextAction?.type}\n`;
    if (plannerDecision.execution?.nextAction?.target) {
        prompt += `Action Target: ${plannerDecision.execution.nextAction.target}\n`;
    }
    
    if (plannerDecision.conversation?.informationPriority && plannerDecision.conversation.informationPriority.length > 0) {
        prompt += `\n=== INFORMATION PRIORITY ===\n`;
        prompt += `Gunakan prioritas (urutan) tipe informasi berikut saat merangkai pesan:\n`;
        const sortedPriority = [...plannerDecision.conversation.informationPriority].sort((a, b) => a.order - b.order);
        sortedPriority.forEach((p) => {
            prompt += `${p.order}. ${p.type}\n`;
        });
    }

    // Inject Prioritized Data (or raw tool output if prioritizer returns the raw object)
    if (prioritizedData) {
        prompt += `\nData: ${JSON.stringify(prioritizedData, null, 2)}\n`;
    } else if (state.tool?.lastResult) {
        prompt += `\nData: ${JSON.stringify(state.tool.lastResult)}\n`;
    }
    prompt += `\n`;

    const missingFacts = plannerDecision.reasoning?.missingFacts;
    if (missingFacts && missingFacts.length > 0) {
        prompt += `=== MISSING FACTS (PRIORITIZED) ===\n`;
        prompt += `Berikut adalah fakta yang perlu Anda tanyakan ke customer. Gabungkan gaya bertanya Anda dengan arahan Strategy di atas.\n`;
        prompt += `Pilih SATU fakta prioritas utama untuk ditanyakan secara natural:\n`;
        prompt += JSON.stringify(missingFacts, null, 2) + `\n\n`;
    }

    if (state.knowledge?.raw) {
        const knowledgeStr = typeof state.knowledge.raw === 'object' ? JSON.stringify(state.knowledge.raw, null, 2) : state.knowledge.raw;
        prompt += `=== SERVICE KNOWLEDGE (CATATAN HARGA & FASILITAS) ===\n`;
        prompt += `Gunakan data ini jika Anda perlu menyebutkan harga atau menjelaskan fasilitas layanan.\n`;
        prompt += `${knowledgeStr}\n\n`;
    }

    if (state.business) {
        if (state.business.restrictions?.length > 0) {
            prompt += `=== BUSINESS CONSTRAINTS ===\n`;
            state.business.restrictions.forEach(r => {
                prompt += `Jelaskan penolakan/restriksi ini dengan sopan: ${r.reason}\n`;
            });
            prompt += `\n`;
        }

        if (state.business.guidelines?.length > 0) {
            prompt += `=== CONVERSATION GUIDELINES ===\n`;
            state.business.guidelines.forEach(g => {
                prompt += `- ${g.directive}\n`;
            });
            prompt += `\n`;
        }

        if (state.business.promotions?.length > 0) {
            prompt += `=== ACTIVE PROMOTIONS ===\n`;
            state.business.promotions.forEach(p => {
                prompt += `- PROMO: ${p.text} (Syarat: ${p.condition})\n`;
            });
            prompt += `\n`;
        }

        if (state.business.upsells?.length > 0) {
            prompt += `=== UPSELL OPPORTUNITIES ===\n`;
            state.business.upsells.forEach(u => {
                prompt += `- Tawarkan layanan "${u.service}": ${u.reason}\n`;
            });
            prompt += `\n`;
        }
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
