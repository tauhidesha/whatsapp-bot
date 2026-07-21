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
    if (business?.disabledServices?.length > 0 || business?.restrictions?.length > 0) {
        prompt += `PENTING: Jika customer secara eksplisit menyebut/menanyakan/meminta layanan yang masuk BUSINESS CONSTRAINTS di atas, tambahkan SATU item di conversation.informationPriority dengan type 'restriction' yang isinya penjelasan restriksi tersebut secara sopan. Jika customer TIDAK menyebut/menanyakan layanan tersebut sama sekali di turn ini, JANGAN sertakan item ini.\n`;
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
        prompt += `PENTING: JANGAN pernah menawarkan Upsell di awal diskusi. Anda HANYA boleh menambahkan objek { type: 'upsell', priority: [n] } ke dalam conversation.informationPriority JIKA goal saat ini adalah PRICE_ESTIMATION, UPSELL, atau BOOKING.\n`;
    }
    if (business?.promotions?.length > 0) {
        prompt += `\n=== ACTIVE PROMOTIONS ===\n`;
        business.promotions.forEach(p => {
            prompt += `- PROMO/COMBO AKTIF: Diskon ${p.discountPct * 100}%. Syarat minimum ${p.minServices} layanan.\n`;
            prompt += `  Kombinasi yang berlaku (opsi Upsell): ${JSON.stringify(p.eligibleCombos)}\n`;
        });
        prompt += `PENTING: Jika goal adalah PRICE_ESTIMATION atau BOOKING dan tidak ada keberatan budget, Anda dapat mempertimbangkan informasi promo ini untuk menentukan strategi upsell ke customer (tambahkan di conversation.informationPriority dengan type 'upsell' di urutan terakhir).\n`;
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
    if (consultation?.requestedServices?.length > 0) {
        prompt += `Requested Services: ${JSON.stringify(consultation.requestedServices)}\n`;
    }
    prompt += `Conversation Status: ${conversation?.status}\n\n`;
    
    prompt += `=== PLANNER DIRECTIVES ===\n`;
    prompt += `- Anda mengendalikan state graph dengan struktur objek JSON: decision, execution, conversation, dan reasoning.\n`;
    prompt += `- Anda adalah *state machine* yang menentukan transisi *Goal* dan *Strategy* berdasarkan perbandingan \`knownFacts\` (yang memiliki state \`KNOWN\`/\`UNDECIDED\`/\`NOT_APPLICABLE\`) dengan kumpulan fakta dari Rule Engine (\`blockingFacts\`, \`requiredFacts\`, \`optionalFacts\`).\n`;
    prompt += `- Aturan Transisi:\n`;
    prompt += `  1. Jika masih ada fakta di \`blockingFacts\` yang tidak ada di \`knownFacts\` (implicit UNKNOWN) atau state-nya BUKAN \`KNOWN\`, Anda WAJIB bertanya (\`COLLECT_INFO\`) dan set \`nextAction.type\` menjadi \`ASK_MISSING_FACTS\`. Detail fakta yang ditanyakan letakkan di \`remainingFacts\`.\n`;
    prompt += `  2. Jika semua \`blockingFacts\` sudah \`KNOWN\`, namun ada \`requiredFacts\` yang state-nya \`UNDECIDED\`, Anda bebas berpindah goal (misal ke \`PRICE_ESTIMATION\`) dan ubah strategi (misal ke \`EDUCATE\`), karena kustomer sudah ditanya tapi belum bisa memutuskan.\n`;
    prompt += `  3. Output parameter yang dibutuhkan oleh tool ke dalam \`execution.parameters\` berdasarkan fakta yang sudah ada di \`knownFacts\`. WAJIB isi dengan nilai konkret, JANGAN biarkan parameters kosong ({}) jika ada fakta yang relevan.\n`;
    
    // Inject explicit parameter hints from current known facts so planner doesn't send empty params
    const paramHints = [];
    if (vehicle?.model) paramHints.push(`motor_model: "${vehicle.model}"`);
    // colorChoice OR paintColor — both keys used by different memory extractors
    let rawColorParam = consultation?.knownFacts?.colorChoice || consultation?.knownFacts?.paintColor;
    let knownColorParam = typeof rawColorParam === 'object' && rawColorParam !== null ? rawColorParam.value : rawColorParam;
    if (knownColorParam) paramHints.push(`color_name: "${knownColorParam}"`);
    if (consultation?.requestedServices?.length > 0) paramHints.push(`service: ${JSON.stringify(consultation.requestedServices)}`);
    if (consultation?.knownFacts?.bookingDate?.value) paramHints.push(`bookingDate: "${consultation.knownFacts.bookingDate.value}"`);
    if (consultation?.knownFacts?.bookingTime?.value) paramHints.push(`bookingTime: "${consultation.knownFacts.bookingTime.value}"`);
    if (paramHints.length > 0) {
        prompt += `     ✅ PARAMETER TERSEDIA (gunakan ini sebagai dasar execution.parameters): { ${paramHints.join(', ')} }\n`;
    }

    prompt += `- [execution.toolIntent]: Gunakan intent generik (GET_PRICE, CREATE_BOOKING, CHECK_AVAILABILITY, dll). Jika tidak butuh tool, set 'NONE'.\n`;
    prompt += `- [conversation.informationPriority]: Tentukan prioritas urutan tipe informasi yang harus disusun oleh Composer. Isi 'content' dengan POIN SINGKAT inti idenya saja, BUKAN kalimat lengkap atau bahasa korporat kaku. Biarkan Composer yang merangkainya menjadi kalimat natural.\n`;
    prompt += `- JIKA array remainingFacts BELUM KOSONG, maka toolIntent WAJIB di-set menjadi 'NONE', KECUALI jika kustomer bertanya mengenai jadwal/ketersediaan slot, Anda DIWAJIBKAN memanggil 'CHECK_AVAILABILITY'. JANGAN PERNAH memanggil 'CREATE_BOOKING' atau tool lainnya sebelum fakta pemblokir terkumpul!\n`;
    // Color surcharge re-fetch rule
    const hasBodiHalus = (consultation?.requestedServices || []).some(s => s.toLowerCase().includes('bodi halus'));
    let rawColor = consultation?.knownFacts?.colorChoice || consultation?.knownFacts?.paintColor;
    let knownColorForPrompt = typeof rawColor === 'object' && rawColor !== null ? rawColor.value : rawColor;
    if (typeof knownColorForPrompt === 'string') {
        const isSpecialColor = /candy|stabilo|bunglon|hologram|chrome|two.?tone|pearl|metalik|mazda/i.test(knownColorForPrompt);
        if (hasBodiHalus && isSpecialColor) {
            prompt += `- 🚨 [CRITICAL RULE] ATURAN WARNA KHUSUS: Customer baru saja mengonfirmasi warna "${knownColorForPrompt}". Ini adalah warna SPESIAL/EFFECT yang PASTI menambah surcharge (biaya tambahan) pada Repaint Bodi Halus. Harga yang pernah Anda berikan sebelumnya menjadi TIDAK VALID! Anda WAJIB MENGHITUNG ULANG HARGA sekarang juga. SET execution.toolIntent = "GET_PRICE" dan masukkan parameter color_name = "${knownColorForPrompt}". DILARANG KERAS SET 'NONE'!\n`;
        }
    }

    prompt += `- ATURAN MUTLAK UPSELL/PROMO: Jika goal adalah ESCALATION atau HANDLE_OBJECTION (atau customer menunjukkan tanda keberatan/frustrasi), Anda DILARANG KERAS menyertakan item 'upsell' di informationPriority turn ini, apapun ketersediaannya.\n\n`;

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
const { businessRules } = require('../rules/businessRulesData');

function buildComposerPrompt(state, plannerDecision, prioritizedData = null) {
    // Dynamic Response Length
    let sentenceLimit = "Max 3 kalimat";
    if (plannerDecision.conversation?.responseLength === 'MEDIUM') sentenceLimit = "Max 4-5 kalimat";
    else if (plannerDecision.conversation?.responseLength === 'LONG') sentenceLimit = "Max 6-7 kalimat";

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
- **${sentenceLimit}** untuk pesan ini. Sesuaikan panjangnya dengan instruksi Planner. 
- *PENGECUALIAN BATAS KALIMAT*: Batas maksimal kalimat di atas BOLEH DIABAIKAN khusus ketika Anda sedang menjabarkan list/daftar pilihan paket (karena bullet points akan memakan lebih banyak baris).
- **JANGAN beri info yang tidak diminta** (jam buka, alamat, promo) KECUALI planner memerintahkannya di Information Priority.
- **JANGAN minta foto** di pesan pertama. Terlalu agresif. Cukup tanya bagian motornya dulu.
- **Contoh BURUK**: "Kenalin aku Zoya ✨ Biar aku bisa kasih info yang pas... boleh kasih tahu motornya apa? Kalau ada foto boleh kirim juga ya! Oh ya kita buka jam 08.00-17.00..."
- **Contoh BURUK (Terlalu Kaku/Korporat)**: "Halo! Senang sekali Anda tertarik melakukan repaint. Untuk memberikan estimasi yang akurat, kami perlu mengetahui..."
- **Contoh BAGUS**: "Halo kak! Aku Zoya dari Bosmat 🎨 Tertarik sama hasil repaint Vario yang di postingan ya? Motornya apa nih kak?"
- **Contoh BAGUS (Tanya Info)**: "Boleh tau mau ngecat bagian apa aja kak? Biar aku bisa itungin kisaran harganya."

# FRASA DILARANG (LANGSUNG TOLAK JIKA MUNCUL DI PIKIRAN)
- ❌ "Promo diskon 15% ini memang khusus untuk..."
- ❌ "Sebagai informasi, kami memiliki promo bundling..."
- ❌ "Harga setelah diskon menjadi..."
- ❌ Kalimat yang terasa seperti brosur/iklan korporat

# FRASA DIANJURKAN (GAYA TEMEN BENGKEL)
- ✅ "Nah, sekalian ambil Cuci Komplit juga, bodi halusnya langsung dapet diskon 15% kak!"
- ✅ "Wih, silver cakep tuh! Kelihatan elegan dan ngga gampang kelihatan kotor."
- ✅ "Mantap kalau masih ori, proses stripping-nya lebih cepet!"
- ✅ "Motor dijamin keluar studio berasa turun baru dari dealer!"

# ATURAN KALKULASI MUTLAK (NON-NEGOTIABLE)
⛔ KAMU DILARANG KERAS MELAKUKAN ARITMATIKA APAPUN.
- JANGAN pernah menjumlahkan, mengalikan, atau memperkirakan angka harga sendiri.
- JANGAN mengubah angka dari CART SUMMARY (rounding, estimasi, dll).
- Semua total sudah dihitung TEPAT oleh sistem. Tugasmu hanya mencetak angka tersebut.
- Untuk format coret di WA, gunakan teks: "(sebelum diskon: Rp1.300.000)" karena ~~ tidak didukung.

# TONE & STYLE (MUTLAK)
- JANGAN PERNAH menggunakan bahasa kaku/robotik/korporat. Hindari frasa seperti "Senang sekali Anda tertarik", "Untuk memberikan estimasi yang akurat", atau "Kami perlu mengetahui".
- JANGAN copy-paste kalimat mentah dari Planner (Information Priority / Missing Facts). Ubah poin-poin tersebut menjadi gaya bahasa Anda sendiri yang asik dan luwes.
- Gunakan bahasa obrolan sehari-hari yang natural ("Biar aku bisa bantu itungin", "Boleh tau...").
- Anggap Anda sedang membalas WA teman tongkrongan yang nanya soal motor.\n\n`;

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
    
    if (state.customer?.status) {
        prompt += `Status CRM Customer: ${state.customer.status} `;
        if (state.customer.status === 'existing' || state.customer.status === 'loyal') {
            prompt += `(Pelanggan lama/langganan. Sapa dengan akrab dan berikan apresiasi karena kembali ke studio)\n`;
        } else if (state.customer.status === 'new') {
            prompt += `(Pelanggan baru. Sapa dengan ramah dan perkenalkan studio jika perlu)\n`;
        } else if (state.customer.status.includes('lead')) {
            prompt += `(Prospek potensial. Fokus pada follow-up ringan yang tidak memaksa)\n`;
        } else {
            prompt += `\n`;
        }
    }

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
            prompt += `${p.priority}. ${p.type}${p.content ? `: ${p.content}` : ''}\n`;
        });
    }

    // ── CART SUMMARY (server-calculated, highest priority for pricing turns) ──
    const cartCalc = prioritizedData?.cartCalculation;
    if (cartCalc) {
        prompt += `=== CART SUMMARY (SUDAH DIHITUNG SERVER — JANGAN UBAH ANGKA INI) ===\n`;
        prompt += `⛔ INSTRUKSI KRITIS: Semua angka di bawah SUDAH BENAR. Kamu DILARANG menghitung ulang.\n`;
        prompt += `Tugasmu: cetak angka-angka ini dalam pesan natural sesuai format di bawah.\n\n`;

        if (cartCalc.type === 'multi-package-simulation') {
            // Skenario A: user belum pilih paket, tampilkan simulasi per paket
            prompt += `MODE: SIMULASI PER PAKET (user belum pilih paket ${cartCalc.serviceName})\n`;
            prompt += `Tampilkan SEMUA paket format: "- Paket [Nama]: ~[harga asli]~ -> *[harga diskon]*"\n`;
            prompt += `Setelah list, tiap baris tambahkan total: "*[harga diskon]* + [fixed] = *[total]*"\n\n`;
            if (cartCalc.hasComboDiscount) {
                prompt += `Diskon ${cartCalc.comboDiscountPct}% sudah diterapkan ke ${cartCalc.serviceName} di setiap baris.\n\n`;
            }
            cartCalc.simulations.forEach(sim => {
                const discInfo = sim.hasDiscount
                    ? `~${sim.basePriceFormatted}~ -> *${sim.discountedPriceFormatted}*`
                    : `*${sim.basePriceFormatted}*`;
                prompt += `- Paket ${sim.packageName}: ${discInfo}`;
                if (cartCalc.fixedLineItems?.length > 0) {
                    const fixedSummary = cartCalc.fixedLineItems.map(f => `${f.name} ${f.priceFormatted}`).join(' + ');
                    prompt += ` -> sama ${fixedSummary} = *${sim.totalFormatted}*`;
                }
                if (sim.description) {
                    prompt += ` — ${sim.description}`;
                }
                prompt += `\n`;
            });
            if (cartCalc.fixedLineItems?.length > 0) {
                prompt += `\nLayanan fixed di cart:\n`;
                cartCalc.fixedLineItems.forEach(f => prompt += `- ${f.name}: ${f.priceFormatted}\n`);
            }
        } else if (cartCalc.type === 'fixed-cart') {
            // Skenario B/C: semua harga sudah fix, tampilkan rekap
            prompt += `MODE: REKAP CART (semua harga sudah fix)\n`;
            prompt += `Format output: bullet point per layanan + baris terakhir total bold.\n\n`;
            cartCalc.lineItems.forEach(item => {
                const priceInfo = item.basePrice !== item.finalPrice
                    ? `${item.finalPriceFormatted} (sebelum diskon: ${item.basePriceFormatted})`
                    : item.finalPriceFormatted;
                prompt += `- ${item.name}: ${priceInfo} — ${item.note}\n`;
            });
            prompt += `\n**Total Keseluruhan: ${cartCalc.grandTotalFormatted}**\n`;
        }
        prompt += `\n`;
    }

    prompt += `\n=== TOOL RESULT ===\n`;
    if (!prioritizedData && !state.tool?.lastResult) {
        prompt += `(Belum ada — belum melakukan pricing call turn ini)\n\n`;
    } else if (cartCalc) {
        // Cart summary already injected above — no need to re-dump raw tool result
        prompt += `(Sudah dirangkum di CART SUMMARY di atas. JANGAN sebutkan angka lain selain yang ada di sana.)\n\n`;
    } else {
        if (prioritizedData) {
            prompt += `Data: ${JSON.stringify(prioritizedData, null, 2)}\n`;
        } else if (state.tool?.lastResult) {
            if (state.tool.lastResult.formattedText) {
                prompt += `Data:\n${state.tool.lastResult.formattedText}\n`;
            } else {
                prompt += `Data: ${JSON.stringify(state.tool.lastResult)}\n`;
            }
        }
        prompt += `PENTING: JANGAN meringkas atau menyembunyikan biaya tambahan (surcharge). Jika di dalam Data terdapat "Rincian:" (misal harga dasar + biaya warna/remover), WAJIB sebutkan biaya tambahan tersebut secara jelas ke customer!\n`;
        const hasCandidates = (prioritizedData?.candidates?.length > 0) || 
                              (state.tool?.lastResult?.candidates?.length > 0) ||
                              (state.tool?.lastResult?.results?.some(r => r.candidates?.length > 0));
        
        if (hasCandidates) {
            prompt += `ATURAN PENYAJIAN PAKET: Karena ada beberapa pilihan paket layanan, JANGAN copas semua deksripsi panjangnya! Sebutkan perbedaannya SECARA RINGKAS dengan menyorot point penting saja (misal: jenis clear, estimasi hasil/garansi). Gunakan format bullet points pendek agar nyaman dibaca di chat WA.\n`;
        }
        prompt += `\n`;
    }

    if (prioritizedData && prioritizedData.injected_knowledge) {
        prompt += `=== INJECTED KNOWLEDGE ===\n`;
        prompt += `${prioritizedData.injected_knowledge}\n\n`;
        prompt += `=== ANTI-HALLUCINATION RULES ===\n`;
        prompt += `- Saat menjelaskan layanan, Anda WAJIB HANYA menggunakan fakta yang ada di dalam blok INJECTED KNOWLEDGE di atas.\n`;
        prompt += `- DILARANG mengarang, berasumsi, atau membuat-buat prosedur, tahapan, atau detail layanan yang tidak ada di sana.\n\n`;
    } else if (plannerDecision.decision?.strategy === 'CLARIFY_SERVICE') {
        prompt += `=== ANTI-HALLUCINATION RULES ===\n`;
        prompt += `- Strategi saat ini adalah CLARIFY_SERVICE.\n`;
        prompt += `- Tanya user secara sopan dan santai layanan mana yang mereka maksud karena sebutannya ambigu (contoh: "Maaf Kak, untuk detailnya, Kakak nanya soal layanan Cuci Komplit atau Repaint Velg nih?").\n\n`;
    } else if (state.intent === 'ASK_SERVICE_DETAILS') {
        prompt += `=== ANTI-HALLUCINATION RULES ===\n`;
        prompt += `- INJECTED_KNOWLEDGE kosong.\n`;
        prompt += `- Karena user bertanya detail layanan tapi data tidak ditemukan, WAJIB gunakan fallback: "Wah, untuk detail prosedur pastinya aku hold dulu ya Kak, biar nggak salah info, aku tanyakan ke Bosmat langsung."\n\n`;
    }

    const remainingFacts = plannerDecision.reasoning?.goalStatus?.remainingFacts;
    if (remainingFacts && remainingFacts.length > 0) {
        prompt += `=== MISSING FACTS (PRIORITIZED) ===\n`;
        prompt += `Berikut adalah fakta yang perlu Anda tanyakan ke customer. HANYA BACA dari sini untuk mengetahui apa yang harus ditanyakan. Gabungkan gaya bertanya Anda dengan arahan Strategy di atas, dan gunakan 'reason' sebagai konteks empati/natural.\n`;
        prompt += `Pilih SATU fakta prioritas utama untuk ditanyakan secara natural:\n`;
        prompt += JSON.stringify(remainingFacts, null, 2) + `\n\n`;
    }

    const masterLayanan = require('../../data/masterLayanan');
    
    if (state.knowledge?.raw && Object.keys(state.knowledge.raw).length > 0) {
        const knowledgeStr = typeof state.knowledge.raw === 'object' ? JSON.stringify(state.knowledge.raw, null, 2) : state.knowledge.raw;
        prompt += `=== SERVICE KNOWLEDGE (JSON) ===\n`;
        prompt += `Gunakan data ini jika Anda perlu menyebutkan harga atau menjelaskan fasilitas layanan.\n`;
        prompt += `${knowledgeStr}\n`;
        
        // Anti-hallucination for upsells: If planner wants to upsell, inject its knowledge if it's missing
        if (plannerDecision.conversation?.informationPriority) {
            const upsells = plannerDecision.conversation.informationPriority.filter(p => p.type === 'upsell');
            upsells.forEach(upsell => {
                const matchedService = masterLayanan.find(s => 
                    upsell.content.toLowerCase().includes(s.name.toLowerCase()) || 
                    (s.keywords && s.keywords.some(k => upsell.content.toLowerCase().includes(k.toLowerCase())))
                );
                
                if (matchedService) {
                    // Check if it's already in knowledgeStr to avoid duplication
                    if (!knowledgeStr.toLowerCase().includes(matchedService.name.toLowerCase())) {
                        prompt += `\n[Info Tambahan Layanan]: ${matchedService.name}\n`;
                        prompt += `Deskripsi: ${matchedService.description}\n`;
                    }
                }
            });
        }
        prompt += `\n`;
    }

    if (state.business) {
        if (state.business.restrictions?.length > 0) {
            const hasRestriction = plannerDecision.conversation?.informationPriority?.some(p => p.type === 'restriction');
            if (hasRestriction) {
                prompt += `=== BUSINESS CONSTRAINTS ===\n`;
                state.business.restrictions.forEach(r => {
                    prompt += `Jelaskan penolakan/restriksi ini dengan sopan: ${r.reason}\n`;
                });
                prompt += `\n`;
            }
        }

        const activeSOPs = [];
        if (state.business.applicableSOP && state.business.applicableSOP.length > 0) {
            state.business.applicableSOP.forEach(id => {
                const [category, key] = id.split('.');
                if (businessRules[category] && businessRules[category][key]) {
                    activeSOPs.push(businessRules[category][key]);
                }
            });
        }
        // Dynamically inject pricing SOP if Planner chose GET_PRICE
        if (plannerDecision.execution?.toolIntent === 'GET_PRICE') {
            Object.values(businessRules.pricing).forEach(rule => activeSOPs.push(rule));
        }

        if (activeSOPs.length > 0) {
            prompt += `=== BUSINESS RULES & SOP ===\n`;
            prompt += `Berikut adalah aturan bisnis yang HARUS dipatuhi untuk konteks saat ini:\n`;
            activeSOPs.forEach(rule => {
                prompt += `- ${rule}\n`;
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

        if (state.business.guidelines?.length > 0) {
            prompt += `=== CONVERSATION GUIDELINES ===\n`;
            state.business.guidelines.forEach(g => {
                prompt += `- ${g.directive}\n`;
            });
            prompt += `\n`;
        }
    }

    prompt += `\nSANGAT PENTING: JIKA section TOOL RESULT kosong atau (Belum ada), ANDA DILARANG MUTLAK menyebut angka rupiah apapun! Fokus hanya ke edukasi dan pertanyaan.\n`;
    prompt += `Jika terdapat pesan error pada Tool Result, sampaikan dengan sopan bahwa harga/layanan tersebut belum ada di sistem atau arahkan untuk pengecekan langsung ke studio.\n\n`;

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
