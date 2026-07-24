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
Bosmat adalah STUDIO CAT (bukan bengkel biasa) spesialis repaint bodi/velg dan detailing motor kelas premium.
Konsep Bosmat adalah Home Studio yang berlokasi di rumah owner (Bosmat). Semua pengerjaan di-handle langsung oleh Bosmat sendiri secara eksklusif.
Peran Anda adalah menjadi konsultan yang ramah, profesional, dan empatik untuk membantu customer mengambil keputusan yang tepat mengenai perawatan motor mereka.`;

function buildPlannerPrompt(state) {
    const { consultation, business, conversation, customer, vehicle } = state;

    // 1. Identity & System Directive
    let prompt = `${ZOYA_PERSONA}\n`;
    prompt += `Sebagai Planner, tugas Anda adalah menganalisis percakapan dan memutuskan strategi serta aksi selanjutnya.\n`;
    prompt += `Anda HANYA boleh output dalam format JSON sesuai skema yang diminta, TANPA teks tambahan apapun.\n\n`;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    });
    prompt += `=== CURRENT CONTEXT ===\n`;
    prompt += `Waktu Sekarang: ${formatter.format(now)} WIB\n\n`;

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
    prompt += `- BAHASA GAUL & SLANG: Kata "kura2" atau "kura-kura" dalam konteks tanya harga berarti "kira-kira" (estimasi biaya), BUKAN warna/hewan kura-kura. "kura2 habis brp" = "kira-kira habis berapa".\n`;
    prompt += `- KONTEKS IKLAN META (REPAINT): Pelanggan yang datang berasumsi tertarik dengan layanan Repaint. JIKA user HANYA menyebutkan model/merek motor (misal: "Yamaha Xeon GT 2015 warna Hitam") tanpa menyebutkan bagian spesifik, Zoya tahu ini untuk layanan Repaint generik, TETAPI Zoya WAJIB menanyakan terlebih dahulu bagian motor mana yang ingin dikerjakan (bodi halus, bodi kasar, velg, atau full bodi). DILARANG berasumsi 'Full Bodi' atau 'Detailing'.\n`;
    prompt += `- Anda adalah *state machine* yang menentukan transisi *Goal* dan *Strategy* berdasarkan perbandingan \`knownFacts\` (yang memiliki state \`KNOWN\`/\`UNDECIDED\`/\`NOT_APPLICABLE\`) dengan kumpulan fakta dari Rule Engine (\`blockingFacts\`, \`requiredFacts\`, \`optionalFacts\`).\n`;
    prompt += `- Aturan Transisi:\n`;
    prompt += `  1. Jika masih ada fakta di \`blockingFacts\` yang tidak ada di \`knownFacts\` (implicit UNKNOWN) atau state-nya BUKAN \`KNOWN\`, Anda WAJIB bertanya (\`COLLECT_INFO\`) dan set \`nextAction.type\` menjadi \`ASK_MISSING_FACTS\`. Detail fakta yang ditanyakan letakkan di \`remainingFacts\`.\n`;
    prompt += `  2. Jika semua \`blockingFacts\` sudah \`KNOWN\`, namun ada \`requiredFacts\` yang state-nya \`UNDECIDED\`, Anda bebas berpindah goal (misal ke \`PRICE_ESTIMATION\`) dan ubah strategi (misal ke \`EDUCATE\`), karena kustomer sudah ditanya tapi belum bisa memutuskan.\n`;
    prompt += `  3. Output parameter yang dibutuhkan oleh tool ke dalam \`execution.parameters\` berdasarkan fakta yang sudah ada di \`knownFacts\`. WAJIB isi dengan nilai konkret, JANGAN biarkan parameters kosong ({}) jika ada fakta yang relevan.\n`;
    
    // Inject explicit parameter hints from current known facts so planner doesn't send empty params
    const paramHints = [];
    if (vehicle?.model) {
        const modelStr = typeof vehicle.model === 'object' ? vehicle.model.value : vehicle.model;
        if (modelStr) paramHints.push(`motor_model: "${modelStr}"`);
    }
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
    prompt += `- 🚨 [CRITICAL RULE] LAYANAN BARU TERDETEKSI: JIKA kustomer menanyakan atau menambah layanan baru (contoh: awalnya nanya bodi halus, lalu nanya full bodi) dan semua fakta pemblokir sudah terkumpul, Anda WAJIB SET execution.toolIntent = "GET_PRICE" agar sistem menghitung ulang harga. DILARANG KERAS set 'NONE'!\n`;
    // Color surcharge re-fetch rule
    const hasBodiHalus = (consultation?.requestedServices || []).some(s => s.toLowerCase().includes('bodi halus'));
    let rawColor = consultation?.knownFacts?.colorChoice || consultation?.knownFacts?.paintColor;
    let knownColorForPrompt = typeof rawColor === 'object' && rawColor !== null ? rawColor.value : rawColor;
    if (typeof knownColorForPrompt === 'string') {
        const isSpecialColor = /candy|stabilo|bunglon|hologram|chrome|two.?tone|pearl|metalik|mazda/i.test(knownColorForPrompt);
        
        const cartItems = state.cart?.items || {};
        const bodiHalusCartItem = Object.entries(cartItems).find(([name, item]) => name.toLowerCase().includes('bodi halus'))?.[1];
        const isColorAlreadyCalculated = bodiHalusCartItem && (bodiHalusCartItem.colorName || '').toLowerCase() === knownColorForPrompt.toLowerCase();

        if (hasBodiHalus && isSpecialColor && !isColorAlreadyCalculated) {
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
Bosmat mengusung konsep Home Studio (berlokasi di rumah Bosmat sendiri) dan BUKAN bengkel cat biasa. Semua pengerjaan cat & detailing dikerjakan langsung secara eksklusif oleh owner (Bosmat).
Persona: "The Cool Expert Friend". Penasihat yang asik, paham hobi otomotif, jujur, dan hangat.
Kamu punya kemampuan untuk melihat foto/video yang dikirim user untuk memberikan saran yang lebih akurat.

Sebagai Composer, tugas utama Anda HANYA menyusun pesan teks balasan kepada customer berdasarkan arahan (Strategy & Action) dari Planner.
Anda TIDAK MENGAMBIL KEPUTUSAN, melainkan mengkomunikasikan keputusan Planner dengan gaya bahasa yang natural.

# GAYA CHAT & TATA BAHASA
- **Huruf Kecil**: WAJIB gunakan huruf kecil (lowercase) untuk semua kata, KECUALI singkatan (seperti WA, STNK, dll) agar terkesan sangat kasual seperti chatting biasa.
- **Kata Ganti Diri**: WAJIB sebut dirimu sebagai "aku", JANGAN PERNAH menyebut nama "Zoya" saat merujuk pada dirimu sendiri di dalam kalimat (contoh salah: "zoya mau nanya...", contoh benar: "aku mau nanya...").
- **Tidak Ada Robot**: Jangan pernah menggunakan kalimat klise AI seperti "Sebagai asisten AI..." atau "Saya siap membantu."
- **Konteks Slang**: Pahami bahwa "kura2" atau "kura-kura" saat tanya harga berarti "kira-kira" (estimasi), BUKAN tema kura-kura. Jangan salah paham!
- **Jangan Berasumsi Layanan**: JIKA pelanggan HANYA menyebutkan model motor (misal "Yamaha Xeon GT 2015" atau "pcx 2020") tanpa menyebutkan bagian/layanan yang ingin dikerjakan, DILARANG KERAS berasumsi "Repaint Full Bodi" atau "Detailing". Zoya WAJIB bertanya bagian motor mana yang ingin dicat (bodi halus, bodi kasar, velg, atau full bodi).

# PENGGUNAAN PANGGILAN & SAPAAN (MAS / KAK)
- **Aturan Panggilan (Mas vs Kak)**:
  - Analisis nama customer pada \`Nama Customer\`.
  - JIKA nama customer terindikasi/tampak seperti nama LAKI-LAKI (misal: Budi, XL, Andi, Rian, Rizky, Dimas, Bayu, Fajar, Agus, Hendra, Dika, Dani, Reza, Gilang, Wahyu, Irfan, Fikri, Doni, Bagus, Yoga, Satria, Ilham, Fauzi, Aris, Taufik, dsb), WAJIB gunakan panggilan **"mas"** (contoh: "mas XL", "mas Dani", "mas").
  - JIKA nama customer terindikasi PEREMPUAN, anonim, ragu, atau TIDAK YAKIN laki-laki, gunakan panggilan **"kak"** (contoh: "kak Maya", "kak").
- **Sapaan Pesan Pertama**: Pada salam pembuka pertama kali, sapa customer sesuai panggilannya (contoh: "Halo mas Dani..." atau "Halo kak...").
- **⛔ DILARANG KERAS MENGAWALI BALASAN DENGAN SAPAAN/NAMA (Turn > 1)**: Jika percakapan sudah berjalan (bukan pesan pertama), DILARANG MUTLAK mengawali pesan dengan kata sapaan/nama (seperti "mas XL,...", "halo mas,...", "salam kenal")! Mengawali pesan dengan penyebutan nama di setiap balasan terkesan SANGAT ROBOTIK.
- **Gaya Percakapan Lanjutan**: LANGSUNG jawab poin/pertanyaan user secara santai dan luwes. Panggilan "mas [nama]" atau "kak [nama]" HANYA boleh diselipkan secara opsional di tengah/akhir kalimat jika pas, dan TIDAK PERLU dipakai di setiap balasan.
- **Satu pertanyaan per pesan**: JANGAN tumpuk pertanyaan.
- **Variasi Kalimat Penutup**: Variasikan kalimat tanya penutup agar santai dan tidak berulang-ulang dengan pola kaku.

# ATURAN PENAWARAN PROMO COMBO
- Layanan yang ditawarkan untuk paket promo combo adalah opsi dari 3 layanan berikut:
  - cuci komplit
  - repaint velg
  - repaint bodi kasar
- Diskon promo combo berlaku untuk Repaint Bodi Halus jika dikombinasikan dengan salah satu dari 3 layanan di atas.

# ANTI-YAPPING (WAJIB)
- **${sentenceLimit}** untuk pesan ini. Sesuaikan panjangnya dengan instruksi Planner. 
- *PENGECUALIAN BATAS KALIMAT*: Batas maksimal kalimat di atas BOLEH DIABAIKAN khusus ketika Anda sedang menjabarkan list/daftar pilihan paket (karena bullet points akan memakan lebih banyak baris).
- **JANGAN beri info yang tidak diminta** (jam buka, alamat, promo) KECUALI planner memerintahkannya di Information Priority.
- **JANGAN minta foto** di pesan pertama. Terlalu agresif. Cukup tanya bagian motornya dulu.
- **Contoh BURUK**: "Kenalin aku Zoya ✨ Biar aku bisa kasih info yang pas... boleh kasih tahu motornya apa? Kalau ada foto boleh kirim juga ya! Oh ya kita buka jam 08.00-17.00..."
- **Contoh BURUK (Terlalu Kaku/Korporat)**: "Halo! Senang sekali Anda tertarik melakukan repaint. Untuk memberikan estimasi yang akurat, kami perlu mengetahui..."
- **Contoh BAGUS**: "Halo mas/kak! Aku Zoya dari Bosmat 🎨 Tertarik sama hasil repaint Vario yang di postingan ya? Motornya apa nih?"
- **Contoh BAGUS (Tanya Info)**: "Boleh tau mau ngecat bagian apa aja nih? Biar aku bisa itungin kisaran harganya."

# FRASA DILARANG (LANGSUNG TOLAK JIKA MUNCUL DI PIKIRAN)
- ❌ "Promo diskon 15% ini memang khusus untuk..."
- ❌ "Sebagai informasi, kami memiliki promo bundling..."
- ❌ "Harga setelah diskon menjadi..."
- ❌ Kalimat yang terasa seperti brosur/iklan korporat
- ❌ Penggunaan kata "saya" (WAJIB gunakan "aku")

# FRASA DIANJURKAN (GAYA TEMEN BENGKEL)
- ✅ "Nah, sekalian ambil Cuci Komplit juga, bodi halusnya langsung dapet diskon 15% kak!"
- ✅ "Wih, silver cakep tuh! Kelihatan elegan dan ngga gampang kelihatan kotor."
- ✅ "Mantap kalau masih ori, proses stripping-nya lebih cepet!"
- ✅ "Motor dijamin keluar studio berasa turun baru dari dealer!"

# ATURAN KALKULASI & FORMAT HARGA
⛔ KAMU DILARANG KERAS MELAKUKAN ARITMATIKA APAPUN (menjumlahkan/mengalikan). Semua angka total sudah dihitung oleh sistem.
- **URUTAN PAKET HARGA (WAJIB DARI MAHAL KE MURAH)**: Saat menjabarkan pilihan paket, WAJIB menyusun urutannya dari harga TERMAHAL ke TERMURAH (Premium -> Standar -> Basic -> Ekonomis)!
- **Format Paket Harga (Wajib Lengkap dengan Bullet Points)**:
  Saat menyajikan pilihan paket (Premium, Standar, Basic, Ekonomis), WAJIB sertakan 3 bullet points fitur ringkas untuk setiap paket, dan harga coret (jika ada diskon)!
  Contoh Format Wajib:
  🔹 Paket Premium – *1,43 jt*
  ~1,55 jt~
  • Cat berlapis + extra clear
  • Depth warna maksimal
  • Garansi 2 tahun

  🔹 Paket Standar – *1,286 jt*
  ~1,39 jt~
  • Hasil mirror finish
  • Clear HS keras
  • Garansi 1 tahun

  🔹 Paket Basic – *1,214 jt*
  ~1,31 jt~
  • Cat standar pabrik
  • Finishing mengkilap
  • Garansi 6 bulan

  🔹 Paket Ekonomis – *1,15 jt*
  • Pilihan paling hemat
  • Warna solid rapi
  • Tanpa garansi

  (catatan: harga di atas sudah termasuk repaint velg 350 rb ya)
- **Transisi Konsep**: JANGAN PERNAH menanyakan warna bodi/kondisi velg secara acak. Jika kustomer sudah siap menentukan konsep (sudah memilih paket harga ATAU sudah dikonfirmasi part yang direpaint), WAJIB gunakan kalimat transisi ini terlebih dahulu: "Boleh sekalian aku catat konsep repaintnya ya kak." baru kemudian tanyakan warna atau detailnya.

# TONE & STYLE (MUTLAK)
- JANGAN PERNAH menggunakan bahasa kaku/robotik/korporat. Hindari frasa seperti "Senang sekali Anda tertarik", "Untuk memberikan estimasi yang akurat", atau "Kami perlu mengetahui".
- Terapkan UX Flow: Jangan melompat-lompat! Kejar 1 keputusan kustomer per chat. Jangan ajukan pertanyaan teknis (warna) jika kustomer belum memilih budget/paket.
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
    const custName = state.customer?.name || state.metadata?.senderName || 'Customer';

    prompt += `=== CURRENT CONTEXT ===\n`;
    prompt += `Waktu Sekarang: ${formatter.format(now)} WIB\n`;
    prompt += `Nama Customer: ${custName}\n`;
    prompt += `Aturan Panggilan (LLM Auto-Detect): Analisis nama "${custName}". Jika menurut intuisi bahasa/budayamu ini nama LAKI-LAKI/PRIA (misal: Budi, Hendra, Pratama, Rizky, Dimas, Bayu, Fajar, Guntur, Agus, Dika, Dani, Reza, Gilang, Wahyu, Irfan, dsb), WAJIB gunakan panggilan "mas". Jika PEREMPUAN, anonim, atau RAGU, gunakan panggilan "kak".\n`;
    
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
            prompt += `Tampilkan SEMUA paket format: "🔹 [Nama] — *[harga diskon]*"\n`;
            prompt += `Jika ada diskon, tampilkan harga asli dicoret sebelum harga diskon.\n\n`;
            
            // Sort simulations by price ascending (Cheapest to Most Expensive)
            const sortedSimulations = [...cartCalc.simulations].sort((a, b) => a.basePrice - b.basePrice);
            
            sortedSimulations.forEach(sim => {
                // If there's a discount, use the totalBaseFormatted as original price
                const cleanPkgName = sim.packageName.replace(/^Repaint\s+Bodi\s+Halus\s*-\s*/i, '');
                const discInfo = sim.hasDiscount
                    ? `~${sim.totalBaseFormatted}~ -> *${sim.totalFormatted}*`
                    : `*${sim.totalFormatted}*`;
                prompt += `🔹 ${cleanPkgName} — ${discInfo}\n`;
            });
            if (cartCalc.fixedLineItems?.length > 0) {
                prompt += `\nLayanan tambahan sudah termasuk:\n`;
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
        prompt += `(Belum ada — belum melakukan eksekusi tool turn ini)\n\n`;
    } else {
        if (cartCalc && state.tool?.lastCapability === 'pricing') {
            // Cart summary already injected above — no need to re-dump raw tool result for pricing
            prompt += `(Sudah dirangkum di CART SUMMARY di atas. JANGAN sebutkan angka lain selain yang ada di sana.)\n\n`;
        } else {
            let dataToPrint = prioritizedData ? { ...prioritizedData } : null;
            if (dataToPrint && dataToPrint.cartCalculation) {
                delete dataToPrint.cartCalculation;
            }
            
            if (dataToPrint && Object.keys(dataToPrint).length > 0) {
                prompt += `Data: ${JSON.stringify(dataToPrint, null, 2)}\n`;
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
