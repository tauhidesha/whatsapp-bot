const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const studioMetadata = require('../../constants/studioMetadata');
const { withRetry } = require('../../utils/retry');
const { sanitizeMessagesForGemini, extractTextFromContent, getMessageType } = require('../utils/sanitizeMessages');
const { getServiceDetailsTool } = require('../../tools/getServiceDetailsTool');

const model = new ChatGoogleGenerativeAI({
    model: process.env.AI_MODEL || "gemini-1.5-flash",
    maxOutputTokens: 2048,
    temperature: 0,
});

/**
 * Node: formatter
 * Mengkonversi state menjadi pesan balasan WhatsApp yang sesuai kepribadian Zoya.
 * Menggunakan Structured Output untuk menjamin format dan kepatuhan aturan.
 */
async function formatterNode(state) {
    console.log('--- [FORMATTER_NODE] Starting ---');
    const { customer, intent, context, metadata } = state;
    const sanitizedMessages = sanitizeMessagesForGemini(state.messages);
    const lastUserMessage = sanitizedMessages[sanitizedMessages.length - 1];
    const toolResult = metadata?.toolResult;
    const comboPromo = metadata?.comboPromo; // Structured: { promoText, comboDiscount, comboMinServices }
    const activePromo = metadata?.activePromo;

    // Ambil mode balasan dari metadata
    const replyMode = metadata?.replyMode || 'inform';
    const missingQ = (context.missingQuestions || [])[0] || '';

    // Detect gender dari nama customer
    const customerName = customer.name || 'Kak';

    // Detailing & Repaint Package Suggester (Decision Tree)
    let upsellSuggestion = '';
    let packageExplanation = '';
    let benefitText = '';
    let effectiveBongkar = false;

    if (context.serviceTypes?.length === 1) {
        const primarySvc = context.serviceTypes[0].toLowerCase();
        const paint = String(context.paintType || '').toLowerCase();
        const focus = String(context.detailingFocus || '').toLowerCase();
        const bongkar = context.isBongkarTotal;
        const isImplicitBongkar = primarySvc.includes('cuci komplit') || primarySvc.includes('full detailing') || primarySvc.includes('complete service');
        effectiveBongkar = bongkar || isImplicitBongkar;

        if (primarySvc.includes('detailing') || primarySvc.includes('poles') || primarySvc.includes('cuci') || primarySvc.includes('complete service') || primarySvc.includes('coating')) {
            const isAlreadyCoating = primarySvc.includes('coating') || primarySvc.includes('complete service');

            if (isAlreadyCoating) {
                // DO NOT UPSELL for Coating/Complete Service. 
                // They already get the 10% discount automatically, and we should just book them.
                upsellSuggestion = null;
                benefitText = null;
                packageExplanation = null;
            } else {
                // Belum coating, tawarkan upgrade ke Coating / Complete Service
                if (effectiveBongkar) {
                    if (paint === 'doff') {
                        upsellSuggestion = 'Complete Service Doff';
                        benefitText = 'biar warnanya makin pekat dan terlindungi lama';
                        packageExplanation = '(Jelaskan bahwa isi paket Complete Service Doff ini sudah termasuk Full Detailing sampai rangka dengan tambahan di-coating juga. Cocok banget biar warnanya makin pekat dan terlindungi lama).';
                    } else {
                        upsellSuggestion = 'Complete Service Glossy';
                        benefitText = 'biar dapat efek daun talas dan kilap kaca yang tahan lama';
                        packageExplanation = '(Jelaskan bahwa isi paket Complete Service Glossy ini sudah termasuk Full Detailing sampai rangka dengan tambahan di-coating juga. Biar dapat efek daun talas dan kilap kaca).';
                    }
                } else if (focus.includes('mesin')) {
                    upsellSuggestion = 'Detailing Bodi juga';
                    benefitText = 'sayang kalau mesin bersih tapi bodinya masih kusam';
                    packageExplanation = '(Tawarkan sekalian poles bodi/coating karena mesin sudah bersih, sayang kalau bodinya masih kusam).';
                } else {
                    // Bodi & Kaki-kaki
                    if (paint === 'doff') {
                        upsellSuggestion = 'Coating Motor Doff';
                        benefitText = 'bikin cat awet, anti kusam, dan udah sekalian bersihin kaki-kaki juga';
                        packageExplanation = '(Tawarkan upgrade ke Coating Motor Doff. Bikin cat awet, anti kusam, dan udah termasuk bersihin kaki-kaki juga).';
                    } else {
                        upsellSuggestion = 'Coating Motor Glossy';
                        benefitText = 'biar proteksinya lebih tahan lama, kilap kaca, dan efek daun talas';
                        packageExplanation = '(Tawarkan upgrade ke Coating Motor Glossy biar proteksinya lebih tahan lama, kilap kaca, dan efek daun talas).';
                    }
                }
            }
        } else if (primarySvc.includes('repaint')) {
            if (primarySvc.includes('halus')) {
                upsellSuggestion = 'Cuci Komplit, Repaint Velg, atau Repaint Bodi Kasar';
                benefitText = 'biar tampilan motor makin maksimal secara keseluruhan';
                packageExplanation = '(Tawarkan 3 opsi pilihan: cuci komplit, repaint velg, atau repaint bodi kasar. Jelaskan singkat: Ambil salah satu dari opsi itu aja, Repaint Bodi Halus-nya udah otomatis dapet diskon 10%. Info juga kalau cat baru belum bisa dicoating, harus nunggu 1 bulan biar cat matang.)';
            } else if (primarySvc.includes('kasar') || primarySvc.includes('velg')) {
                upsellSuggestion = 'Repaint Bodi Halus';
                benefitText = 'karena kalau ambil paket Repaint Bodi Halus sekalian, paket bodi halusnya otomatis dapet diskon 10%';
                packageExplanation = '(Infoin santai: Kalau mau sekalian Repaint Bodi Halus juga mumpung lagi ada promo diskon 10% untuk paket bodi halusnya, jadi motornya bisa fresh kayak baru lagi.)';
            }
        }

        console.log(`[FORMATTER_NODE] Upsell Logic - primarySvc: "${primarySvc}", effectiveBongkar: ${effectiveBongkar}, paint: "${paint}" -> Suggestion: "${upsellSuggestion}", Benefit: "${benefitText}"`);
    }

    // Build combo offer text for formatter
    let comboOfferInstruction = '';
    if ((replyMode === 'inform' || replyMode === 'ask') && comboPromo && context.serviceTypes?.length === 1 && !context.comboOffered && upsellSuggestion) {
        const pct = Math.round(comboPromo.comboDiscount * 100);
        let upsellPriceStr = "";
        let primarySvcTitle = toolResult?.results?.[0]?.name || toolResult?.results?.[0]?.service_name || context.serviceTypes[0];

        try {
            const upsellDetails = await getServiceDetailsTool.implementation({
                service_name: [upsellSuggestion],
                motor_model: context.vehicleType
            });

            if (upsellDetails?.results?.length > 0) {
                const res = upsellDetails.results[0];
                let rawPrice = res.final_price || res.price || 0;
                if (res.candidates && res.candidates.length > 0) {
                    rawPrice = res.candidates[0].final_price || res.candidates[0].price || 0;
                }
                if (rawPrice > 0) {
                    // Karena diskon memotong harga layanan UTAMA, tampilkan harga asli untuk upsell
                    upsellPriceStr = `Rp${rawPrice.toLocaleString('id-ID')}`;
                }
            }
        } catch (err) {
            console.error("[FORMATTER_NODE] Failed to fetch upsell price:", err);
        }

        const isUpsellHalus = upsellSuggestion.includes('Repaint Bodi Halus');
        const discountedService = isUpsellHalus ? upsellSuggestion : primarySvcTitle;

        const promoMsg = comboPromo.promoText ? comboPromo.promoText : `Lagi ada promo diskon ${pct}% nih kalau ambil ${comboPromo.comboMinServices} layanan sekaligus`;
        comboOfferInstruction = `
PROMOSI COMBO (WAJIB ditawarkan secara natural di akhir pesan):
Setelah kasih estimasi harga, tawarkan layanan tambahan: "${upsellSuggestion}".
Catatan Paket: ${packageExplanation || 'Jelaskan benefit intinya secara ringkas.'}
Detail Promo Asli: "${promoMsg}"
ATURAN BAHASA PENAWARAN PROMO:
- JANGAN copy-paste syarat promo mentah-mentah (hindari kata kaku seperti "paket ekonomis tidak diskon", "khusus 10 motor", dll).
- WAJIB SEBUT NAMA PAKET SPESIFIKNYA: "${upsellSuggestion}".
- Sampaikan bahwa JIKA ambil paket ${upsellSuggestion} sekalian, maka paket ${discountedService} akan dapat diskon ${pct}%.
- Contoh kalimat santai: "Oiya kak buat info kalau ambil ${upsellSuggestion} sekalian, nanti paket ${discountedService} kakak dapet diskon ${pct}%. ${effectiveBongkar ? 'Isi paketnya sudah detailing sampai rangka dengan tambahan di coating juga. ' : ''}${benefitText ? (benefitText.charAt(0).toUpperCase() + benefitText.slice(1)) + '. ' : ''}Mau sekalian tambah ${upsellSuggestion} nggak kak?"`;
    }

    // Custom Instruction for 4 Paket Repaint Bodi Halus
    let repaintBodiHalusInstruction = '';
    if ((replyMode === 'inform' || replyMode === 'ask') && (toolResult?.category === 'repaint_bodi_halus' || toolResult?.results?.[0]?.category === 'repaint_bodi_halus') && (toolResult?.candidates || toolResult?.results?.[0]?.candidates)) {

        const isFullBodi = context.detailingFocus && context.detailingFocus.toLowerCase().includes('full bodi');
        const hasHalus = isFullBodi || context.serviceTypes?.some(s => s.toLowerCase().includes('bodi halus'));
        const comboPartners = context.serviceTypes?.filter(s => {
            const lower = s.toLowerCase();
            return lower.includes('velg') || lower.includes('kasar') || lower.includes('cuci');
        }) || [];

        if (isFullBodi) {
            const kasarIncluded = comboPartners.some(p => p.toLowerCase().includes('kasar'));
            if (!kasarIncluded) comboPartners.push('Repaint Bodi Kasar');
        }

        const alreadyGotHalusCombo = hasHalus && comboPartners.length > 0;

        let statusPromoCombo = '';
        if (alreadyGotHalusCombo) {
            statusPromoCombo = `
# STATUS PROMO COMBO (WAJIB DISAMPAIKAN)
Kakak sudah mengambil kombinasi layanan: Bodi Halus + ${comboPartners.join(', ')}. 
Maka kakak otomatis BERHAK MENDAPATKAN DISKON 10% untuk Repaint Bodi Halus!
-> Kamu WAJIB menyampaikannya secara eksplisit dan antusias SEBELUM membeberkan rincian harga paket di bawah ini.
`;
        } else {
            statusPromoCombo = `
# SYARAT PROMO DISKON 10% (WAJIB DISAMPAIKAN)
Sampaikan dengan jelas bahwa Promo Diskon 10% Repaint Bodi Halus ini HANYA BERLAKU jika kakak sekalian mengambil layanan kombinasi (${upsellSuggestion || 'Cuci Komplit, Repaint Velg, atau Repaint Bodi Kasar'}).
`;
        }

        repaintBodiHalusInstruction = `${statusPromoCombo}
INSTRUKSI KHUSUS 4 PAKET REPAINT BODI HALUS:
Kamu harus langsung menampilkan ke-4 pilihan paket ini ke user (Ekonomis, Basic, Standar, Premium).
Aturan penyajian:
1. Urutkan dari yang Termahal (Premium) sampai yang Termurah (Ekonomis).
1a. FORMATTING (SANGAT PENTING): Kamu WAJIB menggunakan karakter bulat (•) sebagai bullet point (JANGAN gunakan * atau - untuk list). Jika ingin menebalkan tulisan, apit HANYA teks tersebut dengan satu bintang WhatsApp (contoh: • *Paket Standar*: ~Rp1.000.000~ jadi Rp900.000). Jangan pernah menggunakan dobel bintang (**). Pastikan baris baru antar paket agar rapi.
1b. DESKRIPSI PAKET: WAJIB sertakan deskripsi/penjelasan singkat untuk setiap paket persis seperti yang tertera pada hasil tool JSON. Jangan hilangkan deskripsi paket.
2. TAMPILKAN PROMO CORET: Untuk paket Premium, Standar, dan Basic, kalikan harga dasar dengan 0.9 (diskon 10%), lalu coret harga asli dan tampilkan harga diskonnya. (Contoh: ~Rp1.000.000~ jadi Rp900.000).
3. Paket Ekonomis TIDAK MENDAPAT DISKON (jangan dicoret).
4. WAJIB NUDGE PAKET STANDAR: Setelah menampilkan harga, kamu WAJIB menuliskan kalimat rekomendasi untuk memilih "Paket Standar". Contoh: "Dari 4 paket di atas, Zoya paling saranin kakak ambil Paket Standar ya! Hasilnya udah mantap mirror finish dan dapet garansi 1 tahun lho." (JANGAN SAMPAI LUPA BAGIAN INI!).
5. TAMPILKAN LAYANAN LAIN: JIKA ada layanan lain selain Bodi Halus di dalam TOOL RESULT JSON (misalnya Repaint Bodi Kasar, Cuci Komplit, dll), WAJIB berikan juga harga layanan tersebut. Jangan pernah bilang "harga akan diinfokan nanti", harganya sudah ada di JSON!
6. PENUTUP PESAN (WAJIB): Karena user BELUM memilih 1 dari 4 paket di atas, JANGAN PERNAH menotal seluruh harga dan JANGAN menanyakan jadwal eksekusi. KALIMAT PALING TERAKHIR WAJIB HANYA menanyakan paket Bodi Halus mana yang mau dipilih. Contoh: "Kira-kira dari 4 paket di atas, kakak mau ambil yang mana nih biar Zoya hitung totalnya?".
`;
    }

    let coatingDiscountInstruction = '';
    const isCoatingFlow = context.serviceTypes?.some(s => s.toLowerCase().includes('coating') || s.toLowerCase().includes('complete service'));
    if ((replyMode === 'inform' || replyMode === 'ask') && comboPromo && isCoatingFlow) {
        const pct = Math.round(comboPromo.comboDiscount * 100);
        coatingDiscountInstruction = `
INSTRUKSI KHUSUS COATING:
User SUDAH memilih paket Coating / Complete Service. 
Karena ada promo khusus Coating diskon ${pct}%, kamu WAJIB mematuhinya:
1. Potong harga dasar Coating sebesar ${pct}%, lalu coret harga asli dan tampilkan harga diskonnya. (Contoh: ~Rp1.000.000~ jadi Rp850.000).
2. JANGAN PERNAH menawarkan/upsell layanan lain lagi.
3. Langsung tanyakan kapan jadwal motor mau dibawa ke studio (Jam buka studio: Senin-Sabtu jam 08.00-17.00, Minggu Tutup).
4. JIKA ada hasil layanan Detailing/Poles dalam JSON yang muncul BERSAMAAN dengan Coating, ABAIKAN SAJA (jangan ditampilkan harganya), karena Coating sudah mencakup semuanya.
`;
    }

    // Pass combo data without hardcoding visual display rules
    const hasCandidates = toolResult?.candidates?.length > 1 || toolResult?.results?.some(r => r.candidates?.length > 1);

    let comboResultInstruction = '';
    // JANGAN berikan hasil total combo jika masih ada pilihan paket yang belum dipilih
    if ((replyMode === 'inform' || replyMode === 'ask') && toolResult?.combo?.applied && !hasCandidates) {
        comboResultInstruction = `
HASIL COMBO DATA (Terapkan pada rincian harga sesuai Aturan Emas #2):
${JSON.stringify(toolResult.combo)}`;
    }

    const dateInfo = state.metadata?.currentDateTime
        ? `Tanggal & Waktu Sekarang: ${state.metadata.currentDateTime.dayName}, ${state.metadata.currentDateTime.formatted} (Waktu Indonesia Barat)`
        : `Tanggal & Waktu Sekarang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;

    // Build context summary for the model
    const contextInfo = `
${dateInfo}
- Nama Pelanggan: ${customerName}
- Motor: ${context.vehicleType || 'Belum diketahui'}
- Layanan yang dipilih: ${context.serviceTypes?.join(', ') || 'Belum ada'}
- Detail/Fokus: ${context.detailingFocus || 'Belum ditentukan'}
- Bongkar Total: ${context.isBongkarTotal ? 'Ya' : 'Tidak'}
- Warna Body: ${context.colorChoice || 'Belum ditentukan'}
- Warna Velg: ${context.velgColorChoice || 'Belum ditentukan'}
`.trim();

    let informCTAInstruction = '';
    if (!missingQ && replyMode === 'inform' && !comboOfferInstruction) {

        if (hasCandidates && !context.packageChoice) {
            informCTAInstruction = `
# PENUTUP PESAN (WAJIB ADA)
Karena user BELUM memilih paket yang spesifik, KALIMAT PALING TERAKHIR dari \`main_content\` WAJIB SEKALI berupa pertanyaan (CTA) yang menanyakan paket mana yang mau dipilih. 
Contoh: "Gimana kak, dari pilihan paket di atas kira-kira ada gambaran mau pilih yang mana?". 
(JANGAN menanyakan jadwal booking/eksekusi sebelum user memilih paketnya!)`;
        } else if (context.packageChoice || !hasCandidates) {
            informCTAInstruction = `
# PENUTUP PESAN (WAJIB ADA)
Karena user SUDAH menentukan pilihan layanan/paket, KALIMAT PALING TERAKHIR dari \`main_content\` WAJIB menanyakan kapan jadwal eksekusinya. 
Contoh: "Jadi totalnya segini ya kak, gimana mau dieksekusi hari apa nih?".`;
        }
    }

    let studioInfoInstruction = '';
    if (toolResult?.studioInfo) {
        const hasVehicleAndService = context.vehicleType && context.vehicleType !== 'Belum diketahui' && context.serviceTypes && context.serviceTypes.length > 0;
        
        if (!hasVehicleAndService) {
            studioInfoInstruction = `
INSTRUKSI INFO LOKASI STUDIO:
Kamu harus memberikan informasi alamat / Google Maps studio berdasarkan Tool Result.
PENTING: JANGAN sebutkan patokan/ancer-ancer studio. Cukup berikan alamat atau link maps-nya saja.
PENTING: Karena tipe motor pelanggan masih belum diketahui, KALIMAT PALING TERAKHIR WAJIB HANYA menanyakan tipe motor pelanggan. (contoh: "Btw, motor apa nih kak yang mau digantengin?").`;
        } else {
            studioInfoInstruction = `
INSTRUKSI INFO LOKASI STUDIO:
Kamu harus memberikan informasi lokasi studio berdasarkan Tool Result. 
PENTING: Pastikan untuk menyebutkan alamat lengkap, link Google Maps, DAN JUGA patokan/ancer-ancer lokasi studio agar user tidak nyasar.`;
        }
    }

    const modeInstructions = {
        greet: "Mode PERKENALAN. Sapa user dengan sangat ramah, kenalkan dirimu sebagai Zoya, dan tanyakan apa yang bisa dibantu hari ini.",
        ask: `Mode TANYA DATA. Zoya sedang mengumpulkan info. Fokus utama: Tanyakan soal "${missingQ}". PENTING: Gunakan bahasamu sendiri yang super santai, asik, dan natural ala anak motor (contoh: "Boleh tau tipe motornya apa kak? Nmax, Scoopy, atau yang lain?"). JANGAN pernah mengulang instruksi secara kaku. JANGAN tanya data lain selain yang diminta. Jika Tool Result memiliki informasi harga, sampaikan terlebih dahulu dengan format yang benar. ${comboOfferInstruction} ${comboResultInstruction} ${repaintBodiHalusInstruction} ${coatingDiscountInstruction} ${studioInfoInstruction}`,
        inform: `Mode INFO HARGA/JADWAL/LOKASI. Sampaikan detail biaya, ketersediaan jadwal, atau info studio dari Tool Result secara transparan. ${comboOfferInstruction} ${comboResultInstruction} ${repaintBodiHalusInstruction} ${coatingDiscountInstruction} ${studioInfoInstruction}`,
        consult: "Mode KONSULTASI. User sedang bingung atau minta saran. Berikan masukan ahli otomotif. PENTING: Jika visual_summary menunjukkan user datang dari iklan/postingan IG, referensikan konten iklan tersebut secara natural (misal: 'Oh tertarik sama hasil Vario Mazda Red di postingan kita ya? Cakep emang 🔥'). Lalu langsung tanyakan tipe motor user-nya."
    };

    // --- PROMPT FRAMEWORK: RACE (Role, Audience, Context, Expectation) ---
    const systemPrompt = `# ROLE
Kamu adalah Zoya, Automotive Consultant & Studio Assistant (Vision-Enabled) di ${studioMetadata.name}.
Persona: "The Cool Expert Friend". Penasihat yang asik, paham hobi otomotif, jujur, dan hangat.
Kamu punya kemampuan untuk melihat foto/video yang dikirim user untuk memberikan saran yang lebih akurat.

# CONTEXT & DATA
- Studio Info (Alamat & Jam Buka):
  Alamat: ${studioMetadata.location.address}
  Landmark: ${studioMetadata.location.landmark}
  Patokan/Directions: ${studioMetadata.location.directions}
  Google Maps: ${studioMetadata.location.googleMaps}
  Jam Buka: Senin-Sabtu (${studioMetadata.hours.senin}), Minggu (Tutup).
- Data Motor & Layanan (Hasil Ekstraksi):
${contextInfo}
${activePromo && activePromo.promoText ? `- Promo Aktif Saat Ini: ${activePromo.promoText}` : ''}
- Hasil Teknis/Tool:
${JSON.stringify(toolResult || 'Tidak ada data tambahan')}

# VISION AWARENESS (PENTING)
Gunakan foto yang dikirim user untuk membuat percakapan jadi lebih personal dan nyata:
- Jika user kirim foto motor bagus → puji motornya (misal: "wah nmax mas cakep bener, velgnya udah ganti ya?").
- Jika user kirim foto baret/lecet → tunjukkan empati (misal: "waduh, baretnya lumayan ya mas di bodi samping, tapi tenang nanti kita kasih detailing biar mulus lagi").
- **DILARANG** bilang "saya tidak bisa lihat foto" atau "saya asisten virtual teks". Kamu BISA lihat foto mas/kak!

# VISUAL OBSERVATION (BASED ON INFO_COLLECTOR)
Informasi visual dari pesan terakhir user:
${state.metadata.visualSummary || 'Tidak ada gambar yang terdeteksi.'}


# STRATEGY MODE: ${replyMode.toUpperCase()}
${modeInstructions[replyMode] || modeInstructions.inform}

# PENTING (HARGA & DATA):
${context.curingWarning ? `🚨 INFO PENTING REKOMENDASI PAKET: User awalnya meminta ${context.conflictServices?.join(', ') || 'poles/coating/detailing'} bersamaan dengan Repaint Bodi Halus. Sistem telah otomatis menggantinya menjadi "Cuci Komplit". Jelaskan ke user dengan santai (sesuaikan bahasamu): "Kebetulan tadi kakak mau ambil detailing/poles, ini langsung saya rekomendasikan ambil Cuci Komplit aja untuk pembersihan area rangka, kaki-kaki, dan mesin mumpung bodinya lagi dibongkar. Nah untuk bodinya sendiri, poles bodi sudah otomatis termasuk dalam paket repaint ya kak." JIKA user tadi secara spesifik meminta "Coating" (cek layanannya), TAMBAHKAN penjelasan ini: "Untuk Coating-nya belum bisa sekarang ya kak, karena cat baru butuh waktu 1 bulan biar matang sempurna (curing)."\n` : ""}1. Hasil Teknis/Tool WAJIB jadi dasar info harga. Jika kosong, JANGAN beri harga spesifik.
2. Ada biaya tambahan untuk warna khusus/tertentu.
3. KHUSUS "Repaint Bodi Kasar": TIDAK PERLU menanyakan pilihan warna. Bodi kasar selalu direpaint ke warna original pabrik (hitam plastik/doff). JANGAN PERNAH bertanya "Bodi kasarnya mau warna apa?"
3. Gunakan format rincian berikut jika ada breakdown biaya:
   [kalimat pengantar...]
   • [layanan]: rp...
   ✅ total: rp...

# EXAMPLE
Mode GREET: "pagi juga kak! kenalin aku zoya 🎨✨\n\nbiar aku bisa bantu, motornya apa ya kak?"
Mode INFORM: "siapp mas! untuk *nmax bodi halus* estimasi harganya *rp1.200.000* ya. ✨"

# ATURAN EMAS
- **Multi-Motor**: Jika user menyebutkan 2 motor berbeda di satu pesan (misal: "mau repaint aerox dan coating nmax"), sampaikan bahwa kita bahas SATU per SATU. Gunakan kalimat santai seperti: "Wah dua motor nih, kita bahas yang [Sebut Motor 1] dulu ya kak biar gak pusing 😆".
- **Alamat & Booking**: Jika user menanyakan alamat/lokasi (terutama setelah nanya servis dan fix mau datang), BERIKAN informasinya secara lengkap: sebutkan Alamat, sebutkan Patokan/Directions (penting agar tidak nyasar), dan berikan link Google Maps. TAPI pastikan selalu MENYARANKAN untuk booking jadwal terlebih dahulu atau kabari jika ingin datang langsung hari ini.
- **Tanya Bosmat (Harga Kosong/Mobil/Datang Sekarang)**: Jika \`toolResult.needBosmat\` bernilai true, ATAU user tanya layanan mobil, ATAU user bilang mau datang sekarang, katakan: "Sebentar ya kak, Zoya tanyakan Bosmat dulu 🙏", dan chat ini akan diserahkan ke admin (JANGAN ngarang harga sendiri).
- **Studio Photo**: Jika \`toolResult\` mengandung \`studioPhoto\`, sebutkan dengan santai bahwa kamu sudah mengirimkan foto depan studio agar mas/kak tidak bingung carinya. 
- Sapaan (\`greeting\`) hanya diberikan jika ini awal diskusi atau perpindahan topik yang butuh "lem" percakapan. Kosongkan jika sedang diskusi intens.
- Selalu akhiri dengan Call-to-Action (CTA) yang jelas.

# ANTI-YAPPING (WAJIB)
- **Max 3 kalimat** untuk first response / sapaan awal. JANGAN tulis essay.
- **JANGAN beri info yang tidak diminta** (jam buka, alamat, promo) kecuali user memintanya atau replyMode === 'inform'.
- **JANGAN minta foto** di pesan pertama. Terlalu agresif. Cukup tanya motor apa.
- **Satu pertanyaan per pesan**. Jangan tumpuk 3 pertanyaan sekaligus.
- Contoh BURUK: "Kenalin aku Zoya 🎨✨ Biar aku bisa kasih info yang pas... boleh kasih tahu motornya apa? Atau mungkin ada bagian tertentu? Kalau ada foto boleh kirim juga ya! Oh ya kita buka jam 08.00-17.00..."
- Contoh BAGUS: "Halo kak! Aku Zoya dari Bosmat 🎨 Tertarik sama hasil repaint Vario yang di postingan ya? Motornya apa nih kak?"
${missingQ && replyMode === 'ask' ? `
# ATURAN MUTLAK (ASK MODE)
Karena ada info yang masih kurang, KALIMAT PALING TERAKHIR dari \`main_content\` WAJIB berupa pertanyaan santai untuk menanyakan hal ini: "${missingQ}". JANGAN TUTUP PESAN TANPA BERTANYA!
` : ''}
${informCTAInstruction}
# OUTPUT FORMAT
Kamu WAJIB membalas DALAM FORMAT JSON MURNI (tanpa markdown blocks, tanpa teks pembuka/penutup).
Struktur JSON yang diwajibkan:
{
  "greeting": "sapaan pendek (max 5 kata) jika di awal/pindah topik, kosongkan jika diskusi intens",
  "main_content": "isi pesan utama, gunakan double-newline antar paragraf. WAJIB AKHIRI DENGAN KALIMAT TANYA/CTA SESUAI INSTRUKSI!",
  "internal_thought": "analisis singkat pemilihan pesan"
}`;

    console.log("SYSTEM_PROMPT:", systemPrompt); console.log(`[FORMATTER_NODE] missingQ detected: "${missingQ}"`);

    try {
        // --- Step 2: Build transcript ---

        // 3. Build a text transcript from message history to avoid Gemini strict conversational history issues
        const transcript = sanitizedMessages
            .filter(m => {
                const type = getMessageType(m);
                return type === 'human' || type === 'ai';
            })
            .map(m => {
                const type = getMessageType(m);
                const text = extractTextFromContent(m.content);
                if (!text.trim()) return null;
                return `[${type === 'human' ? 'USER' : 'AI'}]: ${text.trim()}`;
            })
            .filter(Boolean)
            .join('\n\n');

        console.log(`[FORMATTER_NODE] replyMode: "${replyMode}", toolResult: ${JSON.stringify(toolResult)?.substring(0, 100)}`);
        console.log(`[FORMATTER_NODE] transcript length: ${transcript?.length || 0}`);

        const finalPrompt = `TRANSKIP PERCAKAPAN TERAKHIR:\n\n${transcript}\n\n(Tuliskan balasan AI selanjutnya sesuai arahan sistem)`;

        console.log(`[FORMATTER_NODE] Invoking model (manual parse mode)...`);

        // Timeout wrapper for safety
        const invokePromise = withRetry(() => model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(finalPrompt)
        ]), { maxRetries: 3, baseDelayMs: 1500 });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Formatter timeout after 120s')), 120000)
        );

        const response = await Promise.race([invokePromise, timeoutPromise]);

        console.log(`[FORMATTER_NODE] Response received: ${response ? 'OK' : 'NULL'}`);

        // Handle manual JSON parsing
        const rawText = extractTextFromContent(response.content);
        console.log(`[FORMATTER_NODE] Raw response (first 100 char):`, rawText.substring(0, 100).replace(/\n/g, ' '));

        let parsed = { greeting: '', main_content: rawText, internal_thought: 'manual_fallback' };
        try {
            // Clean markdown if model still provides it despite instructions
            const cleaned = rawText.replace(/```json\n?|```/g, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.warn(`[FORMATTER_NODE] JSON parse failed, falling back to raw text. Error: ${e.message}`);
            // Fallback: If not JSON, use the raw text as main_content
            parsed.main_content = rawText;
        }

        console.log(`[FORMATTER_NODE] [${replyMode}] Thought: ${parsed.internal_thought || 'N/A'}`);

        let finalReply = (parsed.greeting && parsed.greeting.trim())
            ? parsed.greeting.trim() + "\n\n" + parsed.main_content
            : parsed.main_content;

        // Konversi ke huruf kecil (lowercase) untuk gaya chat santai
        // Formatting WhatsApp (*, _, ~, •) otomatis aman karena tidak memiliki case
        // URL/Link tetap dipertahankan huruf aslinya agar tidak rusak
        finalReply = finalReply.split(/(https?:\/\/[^\s]+)/g).map(part => {
            if (part.startsWith('http')) {
                return part;
            }
            return part.toLowerCase();
        }).join('');

        console.log(`[FORMATTER_NODE] Reply formulated: "${finalReply.substring(0, 50).replace(/\\n/g, ' ')}..."`);

        // Track combo offered state
        const contextUpdate = {};
        if ((replyMode === 'inform' || replyMode === 'ask') && comboPromo && context.serviceTypes?.length === 1) {
            contextUpdate.comboOffered = true;
        }

        return {
            messages: [new AIMessage(finalReply)],
            ...(Object.keys(contextUpdate).length > 0 ? { context: contextUpdate } : {})
        };

    } catch (error) {
        console.error('[formatterNode] Error:', error);
        return {
            messages: [new AIMessage('Aduh, maaf ya lagi ada kendala teknis dikit. Bisa tanya lagi atau hubungi admin?')]
        };
    }
}

module.exports = { formatterNode };
