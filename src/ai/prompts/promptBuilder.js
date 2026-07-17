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

    if (business?.constraints?.length > 0) {
        prompt += `\n=== CONSTRAINTS ===\n`;
        business.constraints.forEach(c => {
            prompt += `- ${c}\n`;
        });
    }
    if (business?.blockingFacts?.length > 0) {
        prompt += `\n=== BLOCKING FACTS ===\n`;
        prompt += `Fakta absolut yang WAJIB ada (state: KNOWN) sebelum pindah goal:\n- ${business.blockingFacts.join('\n- ')}\n`;
    }
    if (business?.requiredFacts?.length > 0) {
        prompt += `\n=== REQUIRED FACTS ===\n`;
        prompt += `Fakta yang idealnya ada untuk memberikan hasil komprehensif:\n- ${business.requiredFacts.join('\n- ')}\n`;
    }
    if (business?.optionalFacts?.length > 0) {
        prompt += `\n=== OPTIONAL FACTS ===\n`;
        prompt += `Fakta tambahan yang berguna untuk upsell atau info ekstra:\n- ${business.optionalFacts.join('\n- ')}\n`;
    }
    if (business?.upsells?.length > 0) {
        prompt += `\n=== UPSELL OPPORTUNITIES ===\n`;
        business.upsells.forEach(u => {
            prompt += `- Tawarkan ${u.service}: ${u.reason}\n`;
        });
        prompt += `PENTING: Jika Anda memutuskan untuk melakukan upsell, pastikan Anda menambahkan objek { type: 'upsell', priority: [n] } ke dalam conversation.informationPriority.\n`;
    }

    prompt += `\n`;

    if (state.knowledge?.raw && Object.keys(state.knowledge.raw).length > 0) {
        const knowledgeStr = typeof state.knowledge.raw === 'object' ? JSON.stringify(state.knowledge.raw, null, 2) : state.knowledge.raw;
        prompt += `=== SERVICE KNOWLEDGE (JSON) ===\n`;
        prompt += `Gunakan data berikut jika perlu mengedukasi customer:\n`;
        prompt += `${knowledgeStr}\n\n`;
    }

    // 4. Current State Snapshot
    if (state.metadata?.visualSummary) {
        prompt += `=== VISUAL CONTEXT ===\n`;
        prompt += `Customer telah mengirimkan gambar/foto. Berikut adalah ringkasan visual dari InfoCollector:\n`;
        prompt += `${state.metadata.visualSummary}\n\n`;
    }

    prompt += `=== CURRENT STATE ===\n`;
    prompt += `Customer: ${customer?.name} (Status: ${customer?.status})\n`;
    
    // Combine explicit knownFacts with vehicle data so Planner sees them as a single truth
    const allKnownFacts = {
        ...(consultation?.knownFacts || {}),
        ...(vehicle?.brand ? { motorBrand: vehicle.brand } : {}),
        ...(vehicle?.model ? { motorModel: vehicle.model } : {}),
        ...(vehicle?.paintType ? { paintColor: vehicle.paintType } : {})
    };
    
    prompt += `Known Facts: ${JSON.stringify(allKnownFacts)}\n`;
    prompt += `Conversation Status: ${conversation?.status}\n\n`;
    
    prompt += `=== PLANNER DIRECTIVES ===\n`;
    prompt += `- Anda mengendalikan state graph dengan struktur objek JSON: decision, execution, conversation, dan reasoning.\n`;
    prompt += `- Anda adalah *state machine* yang menentukan transisi *Goal* dan *Strategy* berdasarkan perbandingan \`knownFacts\` (yang memiliki state \`KNOWN\`/\`UNDECIDED\`/\`NOT_APPLICABLE\`) dengan kumpulan fakta dari Rule Engine (\`blockingFacts\`, \`requiredFacts\`, \`optionalFacts\`).\n`;
    prompt += `- Aturan Transisi:\n`;
    prompt += `  1. Jika masih ada fakta di \`blockingFacts\` yang tidak ada di \`knownFacts\` (implicit UNKNOWN) atau state-nya BUKAN \`KNOWN\`, Anda WAJIB bertanya (\`COLLECT_INFO\`) dan set \`nextAction.type\` menjadi \`ASK_MISSING_FACTS\`. Detail fakta yang ditanyakan letakkan di \`remainingFacts\`.\n`;
    prompt += `  2. Jika semua \`blockingFacts\` sudah \`KNOWN\`, namun ada \`requiredFacts\` yang state-nya \`UNDECIDED\`, Anda bebas berpindah goal (misal ke \`PRICE_ESTIMATION\`) dan ubah strategi (misal ke \`EDUCATE\`), karena kustomer sudah ditanya tapi belum bisa memutuskan.\n`;
    prompt += `  3. Output parameter yang dibutuhkan oleh tool ke dalam \`execution.parameters\` berdasarkan fakta yang sudah ada.\n`;
    prompt += `- [execution.toolIntent]: Gunakan intent generik (GET_PRICE, CREATE_BOOKING, CHECK_AVAILABILITY, dll). Jika tidak butuh tool, set 'NONE'.\n`;
    prompt += `- [conversation.informationPriority]: Tentukan prioritas urutan tipe informasi yang harus disusun oleh Composer.\n`;
    prompt += `- JIKA array remainingFacts BELUM KOSONG, maka toolIntent WAJIB di-set menjadi 'NONE', KECUALI jika kustomer bertanya mengenai jadwal/ketersediaan slot, Anda DIWAJIBKAN memanggil 'CHECK_AVAILABILITY'. JANGAN PERNAH memanggil 'CREATE_BOOKING' atau tool lainnya sebelum fakta pemblokir terkumpul!\n\n`;

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
    let prompt = `# ROLE
Kamu adalah Zoya, Automotive Consultant & Studio Assistant (Vision-Enabled) di Bosmat Repaint Studio.
Persona: "The Cool Expert Friend". Penasihat yang asik, paham hobi otomotif, jujur, dan hangat.
Kamu punya kemampuan untuk melihat foto/video yang dikirim user untuk memberikan saran yang lebih akurat.

Sebagai Composer, tugas utama Anda HANYA menyusun pesan teks balasan kepada customer berdasarkan arahan (Strategy & Action) dari Planner.
Anda TIDAK MENGAMBIL KEPUTUSAN, melainkan mengkomunikasikan keputusan Planner dengan gaya bahasa yang natural.

# ATURAN EMAS
- **Satu pertanyaan per pesan**: JANGAN tumpuk pertanyaan.
- **Sapaan**: Hanya diberikan jika ini awal diskusi atau perpindahan topik. Kosongkan sapaan ("Halo kak") jika sedang diskusi intens.
- **Multi-Motor**: Jika user menyebutkan 2 motor berbeda di satu pesan, bahas SATU per SATU. "Wah dua motor nih, kita bahas yang pertama dulu ya kak biar gak pusing 😆".

# ANTI-YAPPING (WAJIB)
- **Max 3 kalimat** untuk pesan pertama. JANGAN tulis essay panjang.
- **JANGAN beri info yang tidak diminta** (jam buka, alamat, promo) KECUALI planner memerintahkannya di Information Priority.
- **JANGAN minta foto** di pesan pertama. Terlalu agresif. Cukup tanya bagian motornya dulu.
- **Contoh BURUK**: "Kenalin aku Zoya ✨ Biar aku bisa kasih info yang pas... boleh kasih tahu motornya apa? Kalau ada foto boleh kirim juga ya! Oh ya kita buka jam 08.00-17.00..."
- **Contoh BAGUS**: "Halo kak! Aku Zoya dari Bosmat 🎨 Tertarik sama hasil repaint Vario yang di postingan ya? Motornya apa nih kak?"\n\n`;

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
    prompt += `Nama Customer: ${state.customer?.name || 'Customer'}\n`;
    if (state.metadata?.visualSummary) {
        prompt += `Visual Summary (Dari Foto User): ${state.metadata.visualSummary}\n`;
    }
    prompt += `\n`;

    prompt += `=== DIRECTIVE FROM PLANNER ===\n`;
    prompt += `Goal: ${plannerDecision.decision?.goal}\n`;
    prompt += `Strategy: ${plannerDecision.decision?.strategy}\n`;
    prompt += `Buyer Stage: ${plannerDecision.decision?.buyerStage}\n`;
    prompt += `Action Type: ${plannerDecision.execution?.nextAction?.type}\n`;
    

    if (plannerDecision.conversation?.informationPriority && plannerDecision.conversation.informationPriority.length > 0) {
        prompt += `\n=== INFORMATION PRIORITY ===\n`;
        prompt += `Gunakan prioritas (urutan) tipe informasi berikut saat merangkai pesan:\n`;
        const sortedPriority = [...plannerDecision.conversation.informationPriority].sort((a, b) => a.priority - b.priority);
        sortedPriority.forEach((p) => {
            prompt += `${p.priority}. ${p.type}\n`;
        });
    }

    // Inject Prioritized Data (or raw tool output if prioritizer returns the raw object)
    if (prioritizedData) {
        prompt += `\nData: ${JSON.stringify(prioritizedData, null, 2)}\n`;
    } else if (state.tool?.lastResult) {
        if (state.tool.lastResult.formattedText) {
            prompt += `\nData:\n${state.tool.lastResult.formattedText}\n`;
        } else {
            prompt += `\nData: ${JSON.stringify(state.tool.lastResult)}\n`;
        }
    }
    prompt += `PENTING: JANGAN meringkas atau menyembunyikan biaya tambahan (surcharge). Jika di dalam Data terdapat "Rincian:" (misal harga dasar + biaya warna/remover), WAJIB sebutkan biaya tambahan tersebut secara jelas ke customer!\n`;
    prompt += `SANGAT PENTING: JIKA Data di atas berisi pesan error, "tidak ditemukan", atau "belum tersedia", ANDA DILARANG KERAS MENGARANG ATAU MENEBAK HARGA SENDIRI! Sampaikan dengan sopan bahwa harga/layanan tersebut belum ada di sistem atau arahkan untuk pengecekan langsung ke studio.\n\n`;

    const remainingFacts = plannerDecision.reasoning?.goalStatus?.remainingFacts;
    if (remainingFacts && remainingFacts.length > 0) {
        prompt += `=== MISSING FACTS (PRIORITIZED) ===\n`;
        prompt += `Berikut adalah fakta yang perlu Anda tanyakan ke customer. HANYA BACA dari sini untuk mengetahui apa yang harus ditanyakan. Gabungkan gaya bertanya Anda dengan arahan Strategy di atas, dan gunakan 'reason' sebagai konteks empati/natural.\n`;
        prompt += `Pilih SATU fakta prioritas utama untuk ditanyakan secara natural:\n`;
        prompt += JSON.stringify(remainingFacts, null, 2) + `\n\n`;
    }

    if (state.knowledge?.raw && Object.keys(state.knowledge.raw).length > 0) {
        const knowledgeStr = typeof state.knowledge.raw === 'object' ? JSON.stringify(state.knowledge.raw, null, 2) : state.knowledge.raw;
        prompt += `=== SERVICE KNOWLEDGE (JSON) ===\n`;
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

        if (state.business.sop && Object.keys(state.business.sop).length > 0) {
            prompt += `=== BUSINESS RULES & SOP (JSON) ===\n`;
            prompt += `Berikut adalah aturan bisnis yang HARUS dipatuhi, dikategorikan dalam JSON:\n`;
            prompt += JSON.stringify(state.business.sop, null, 2) + `\n\n`;
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

        if (state.business.guidelines?.length > 0) {
            prompt += `=== CONVERSATION GUIDELINES ===\n`;
            state.business.guidelines.forEach(g => {
                prompt += `- ${g.directive}\n`;
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
