const { REPAINT_FLOWS, COLOR_TREND_ADVISORY, PACKAGE_RECOMMENDATION } = require('../knowledge/repaintFlow');

/**
 * Repaint Flow Rules
 * Guides the conversation steps for repaint requests.
 */

const { businessRules } = require('./businessRulesData');
const { getActivePromo } = require('../utils/promoConfig');

async function evaluateRepaintRules(state) {
    const rules = {
        applicableSOP: [],
        constraints: [],
        blockingFacts: [],
        requiredFacts: [],
        optionalFacts: [],
        upsells: [],
        guidelines: [],
        restrictions: [],
        disabledServices: []
    };
    
    const { vehicle, consultation } = state;
    const knownFacts = consultation?.knownFacts || {};
    const knownMotor = (knownFacts.motor?.value || vehicle?.model?.value || vehicle?.model || '').toString().toLowerCase();
    const motorBrand = (vehicle?.brand?.value || vehicle?.brand || '').toString().toLowerCase();
    const isVespa = knownMotor.includes('vespa') || motorBrand.includes('vespa');

    if (isVespa) {
        rules.restrictions.push({
            type: 'RESTRICTION',
            service: 'Repaint Vespa',
            status: 'DISABLED',
            reason: 'Untuk sementara studio belum menerima pengerjaan repaint khusus motor Vespa Matic.',
            suggestedAction: 'Sampaikan permohonan maaf secara sopan dan ramah bahwa saat ini studio belum bisa melayani repaint Vespa Matic. Tanyakan apakah ada unit motor tipe lain yang ingin di-repaint.'
        });
        rules.disabledServices.push('Repaint Vespa');
    }

    const requested = state.consultation?.requestedServices || [];
    const isRepaintRequested = requested.some(s => s.toLowerCase().includes('repaint'));
    
    if (!isRepaintRequested && !isVespa) {
        return rules;
    }

    const knownRepaintTarget = knownFacts.partToRepaint?.value || knownFacts.scope?.value;

    // Filter SOP based on context (knownFacts and remainingFacts)
    const contextKeys = [
        ...Object.keys(knownFacts), 
        ...(state.planner?.reasoning?.goalStatus?.remainingFacts?.map(f => f.field) || [])
    ];
    
    rules.applicableSOP.push(
        'communication.askColor', 
        'communication.noTechnicalJargon', 
        'communication.explainPartOptions',
        'communication.noPaintTypeQuestion',
        'communication.fullBodiDefinition',
        'communication.noMotorVariantQuestion'
    );
    rules.constraints.push(businessRules.communication.noPaintTypeQuestion);
    rules.constraints.push(businessRules.communication.noMotorVariantQuestion);

    // Repair rules are context-driven (only if damage is reported)
    if (knownFacts.hasDamage === true) {
        rules.applicableSOP.push('repair.repairIncluded', 'repair.severeDamageSurcharge');
    } else {
        // If damage not reported, forbid asking about damage
        rules.applicableSOP.push('communication.noDamageQuestion');
        rules.constraints.push(businessRules.communication.noDamageQuestion);
    }

    // Include generic paint rules
    rules.applicableSOP.push('paint.bodiKasarColor', 'paint.specialColor', 'paint.noBodiKasarColor');
    
    // Explicitly forbid asking about 'bongkar total' for Repaint
    rules.constraints.push('DILARANG KERAS menanyakan apakah perlu bongkar total atau tidak, karena bongkar total HANYA ditanyakan untuk layanan Detailing.');

    // 2. Identify Flow and Inject Required Facts
    // Business Rule: "full bodi" = Repaint Bodi Halus + Repaint Bodi Kasar
    //                "full bodi halus" = Repaint Bodi Halus only
    const isFullBodiHalus = requested.some(s => s.toLowerCase().includes('full bodi halus'));
    const isFullBody = !isFullBodiHalus && requested.some(s => s.toLowerCase().includes('full bodi') || s.toLowerCase().includes('full body'));
    const isBodiHalus = isFullBodiHalus || requested.some(s => s.toLowerCase().includes('bodi halus'));
    const isBodiKasar = isFullBody || requested.some(s => s.toLowerCase().includes('bodi kasar'));
    const isVelg = requested.some(s => s.toLowerCase().includes('velg')) || knownRepaintTarget?.toLowerCase().includes('velg');
    
    // Inject resolved services for "full bodi" as a constraint so planner + pricing tool know the scope
    if (isFullBody) {
        rules.constraints.push(
            'REQUEST SCOPE: Customer meminta "full bodi" yang berarti mencakup DUA layanan: "Repaint Bodi Halus" + "Repaint Bodi Kasar". Pricing tool harus dipanggil dengan kedua layanan ini.'
        );
    } else if (isFullBodiHalus) {
        rules.constraints.push(
            'REQUEST SCOPE: Customer meminta "full bodi halus" yang berarti HANYA "Repaint Bodi Halus". Bukan bodi kasar.'
        );
    }

    let selectedFlow = null;

    if (isFullBody) selectedFlow = REPAINT_FLOWS.FULL_BODY;
    else if (isBodiHalus) selectedFlow = REPAINT_FLOWS.BODY_HALUS;
    else if (isBodiKasar) selectedFlow = REPAINT_FLOWS.BODY_KASAR;
    else if (isVelg) selectedFlow = REPAINT_FLOWS.VELG;

    if (selectedFlow) {
        if (selectedFlow.blockingFacts) rules.blockingFacts.push(...selectedFlow.blockingFacts);
        if (selectedFlow.requiredFacts) rules.requiredFacts.push(...selectedFlow.requiredFacts);
        
        if (selectedFlow.blockedFacts && selectedFlow.blockedFacts.length > 0) {
            rules.constraints.push(`DILARANG KERAS menanyakan atau mencari informasi mengenai: ${selectedFlow.blockedFacts.join(', ')}.`);
        }
        
        if (selectedFlow.optionalFacts) {
            rules.optionalFacts.push(...selectedFlow.optionalFacts);
        }
    } else {
        // Generic repaint, needs clarification
        rules.blockingFacts.push("motorModel", "partToRepaint");
    }

    // ── Color Phase: Inject trend advisory when color is still unknown ──────
    const colorState = vehicle?.paintType?.state || knownFacts.paintColor?.state;
    const isColorUndecided = colorState === 'UNDECIDED' || vehicle?.paintType?.value === 'Belum Menentukan';
    const isColorKnown = knownFacts.paintColor?.state === 'KNOWN' || vehicle?.paintType?.state === 'KNOWN';
    const isColorPhaseFlow = isBodiHalus || isVelg || isFullBody;

    if (isColorUndecided) {
        // User explicitly said they don't know yet — skip to price
        rules.blockingFacts = rules.blockingFacts.filter(fact => fact !== 'paintColor');
        rules.requiredFacts = rules.requiredFacts.filter(fact => fact !== 'paintColor');
        rules.constraints.push('Customer belum tahu warna. WAJIB ubah Goal menjadi PRICE_ESTIMATION dan panggil tool GET_PRICE untuk memberikan estimasi/range harga dasar.');
    } else if (isColorPhaseFlow && !isColorKnown && COLOR_TREND_ADVISORY.enabled) {
        // Color not yet known — user is in the color discussion phase
        // Inject trend advisory so Composer can share tips if user asks
        const trendList = COLOR_TREND_ADVISORY.trends
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');
        rules.guidelines.push({
            type: 'COLOR_TREND_ADVISORY',
            directive: `Saat menanyakan atau mendiskusikan warna, kamu boleh berbagi info tren warna repaint secara singkat dan natural (jangan panjang):\n${trendList}\n\nCatatan: ${COLOR_TREND_ADVISORY.consultNote}\nSampaikan hanya jika user meminta saran atau masih bingung pilih warna — jangan langsung pamer tanpa diminta.`
        });
    }

    // ── Promo Config (fetch early — needed for price phase guidelines & upsells) ──
    const promoInfo = await getActivePromo();
    const discPct = promoInfo?.comboDiscount ? Math.round(promoInfo.comboDiscount * 100) : 10;

    // ── Price Phase: Inject package recommendation ─────────────────────────────
    // Inject WHENEVER motor + bagian are known (color is no longer a blocker).
    const motorKnown = !!knownMotor || knownFacts.motorModel?.state === 'KNOWN';
    const partKnown  = !!knownRepaintTarget || knownFacts.partToRepaint?.state === 'KNOWN';
    const isAllBlockingFactsKnown = motorKnown && partKnown;

    // isPricePhase still used for upsell guard (must be after pricing tool ran)
    const isPricePhase = (
        state.planner?.execution?.toolIntent === 'GET_PRICE' ||
        state.tool?.lastCapability === 'pricing'
    );

    if (isAllBlockingFactsKnown && (isBodiHalus || isBodiKasar || isVelg || isFullBody)) {
        rules.guidelines.push({
            type: 'PACKAGE_RECOMMENDATION',
            directive: `Setelah menampilkan daftar paket harga, WAJIB rekomendasikan paket "${PACKAGE_RECOMMENDATION.preferredPackage}" sebagai pilihan utama. Alasan: ${PACKAGE_RECOMMENDATION.reason}. Cara penyampaian: ${PACKAGE_RECOMMENDATION.note}`
        });
    }

    // Guideline: untuk flow yang butuh warna (Bodi Halus / Full Bodi / Velg),
    // tanyakan warna SETELAH harga + rekomendasi paket ditampilkan — bukan sebelumnya.
    const colorNeeded = (isBodiHalus || isFullBody || isVelg) && !isColorKnown && !isColorUndecided;
    if (isAllBlockingFactsKnown && colorNeeded) {
        rules.guidelines.push({
            type: 'COLOR_AFTER_PRICE',
            directive: `URUTAN WAJIB saat menampilkan harga untuk layanan ini: (1) tampilkan daftar paket harga, (2) rekomendasikan paket Standar, (3) BARU tanyakan mau warna apa. JANGAN tanya warna sebelum harga ditampilkan. Contoh penutup setelah harga: "oh iya, mau warna apa nih? kalau mau candy atau bunglon ada surcharge kecil, tapi hasilnya beda banget."`
        });
    }
    // Full Bodi: harga yang tampil sudah include combo discount — wajib transparan ke customer
    if (isAllBlockingFactsKnown && isFullBody) {
        rules.guidelines.push({
            type: 'COMBO_PRICE_TRANSPARENCY',
            directive: `PENTING: Customer memilih Full Bodi (Bodi Halus + Bodi Kasar). Harga yang tampil di estimasi SUDAH TERMASUK diskon combo ${discPct}% untuk Bodi Halus karena mengambil 2 layanan sekaligus. WAJIB sampaikan ke customer bahwa harga yang ditampilkan SUDAH harga diskon combo — jangan biarkan mereka bingung kenapa ada dua angka. Contoh kalimat: "harga di atas udah termasuk diskon combo ${discPct}% buat bodi halusnya ya, karena sekalian sama bodi kasar."`
        });
    }

    // 3. Promo/Combo Logic — push to promotions if active
    if (promoInfo && promoInfo.promoText) {
        rules.promotions = rules.promotions || [];
        rules.promotions.push({
            type: 'PROMO',
            active: true,
            discountPct: promoInfo.comboDiscount,
            minServices: promoInfo.comboMinServices,
            eligibleCombos: promoInfo.eligibleCombos
        });
    }

    // 4. Upsells — Combo discount offer (AFTER price is shown, not before)
    // Only offer upsell if we're at or past the price phase
    const hasShownPrice = state.tool?.lastCapability === 'pricing' || !!state.cart?.calculatedAt;

    if (isFullBody && hasShownPrice) {
        // Full Bodi = already a combo (Bodi Halus + Bodi Kasar) → discount already applied.
        // DO NOT offer another combo discount. Only upsell Velg as a natural add-on, no discount framing.
        rules.upsells.push({
            type: 'UPSELL',
            service: null,
            timing: 'AFTER_PRICE',
            reason: `Customer sudah ambil Full Bodi — harga combo SUDAH diterapkan. JANGAN tawarkan diskon combo lagi. Satu-satunya upsell yang boleh ditawarkan: tambah Repaint Velg supaya hasilnya lebih complete. Framing: natural, bukan "dapet diskon", tapi "biar makin sempurna sekalian velgnya".`
        });
    } else if (isBodiHalus && hasShownPrice) {
        // Single Bodi Halus → eligible for combo discount with another service
        rules.upsells.push({
            type: 'UPSELL',
            service: null,
            timing: 'AFTER_PRICE',
            reason: `Ada promo diskon ${discPct}% untuk Bodi Halus kalau sekalian ambil 1 layanan lagi. Tawarkan 2 opsi: (1) tambah Repaint Bodi Kasar, (2) tambah Repaint Velg. Sampaikan setelah harga sudah diberikan, jangan sebelum.`
        });
    } else if (isBodiKasar && !isFullBody && hasShownPrice) {
        // Single Bodi Kasar only
        rules.upsells.push({
            type: 'UPSELL',
            service: null,
            timing: 'AFTER_PRICE',
            reason: `Ada promo combo — tawarkan sekalian Repaint Bodi Halus untuk dapat diskon ${discPct}% di Bodi Halusnya. Sampaikan setelah harga Bodi Kasar sudah ditampilkan.`
        });
    } else if (isVelg && hasShownPrice) {
        rules.upsells.push({
            type: 'UPSELL',
            service: null,
            timing: 'AFTER_PRICE',
            reason: `Setelah kasih harga velg, tawarkan combo dengan Repaint Bodi Halus untuk dapat promo diskon ${discPct}% di Bodi Halusnya.`
        });
    }

    // 5. Conversation Guidelines (Legacy support for specific prompting tweaks)
    const isShowingPrice = (state.planner?.nextAction === 'SHOW_PRICE' || state.planner?.strategy === 'EDUCATE' || state.planner?.toolIntent === 'GET_PRICE');
    if (isShowingPrice) {
        rules.guidelines.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'UX FLOW V3: Saat mengestimasi/menampilkan daftar harga, JANGAN langsung bertanya mau booking atau belum. Tanyakan DULU apakah ada rencana repaint bagian lain (misal velg/bodi kasar) untuk memberikan penawaran bundling secara natural.'
        });
    }

    return rules;
}

module.exports = {
    evaluateRepaintRules
};
