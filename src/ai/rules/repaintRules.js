const { REPAINT_FLOWS } = require('../knowledge/repaintFlow');

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
        guidelines: []
    };
    
    const requested = state.consultation?.requestedServices || [];
    const isRepaintRequested = requested.some(s => s.toLowerCase().includes('repaint'));
    
    if (!isRepaintRequested) {
        return rules;
    }

    const { vehicle, consultation } = state;
    const knownFacts = consultation?.knownFacts || {};
    const knownMotor = knownFacts.motor?.value || vehicle?.model?.value;
    const knownRepaintTarget = knownFacts.partToRepaint?.value || knownFacts.scope?.value;

    // Filter SOP based on context (knownFacts and remainingFacts)
    const contextKeys = [
        ...Object.keys(knownFacts), 
        ...(state.planner?.reasoning?.goalStatus?.remainingFacts?.map(f => f.field) || [])
    ];
    
    // Always include communication rules for repaint
    rules.applicableSOP.push(
        'communication.askColor', 
        'communication.noTechnicalJargon', 
        'communication.explainPartOptions',
        'communication.noPaintTypeQuestion'
    );
    rules.constraints.push(businessRules.communication.noPaintTypeQuestion);

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

    // Bypass logic for UNDECIDED paintColor to prevent Infinite Loop
    const colorState = vehicle?.paintType?.state || knownFacts.paintColor?.state;
    const isColorUndecided = colorState === 'UNDECIDED' || vehicle?.paintType?.value === 'Belum Menentukan';
    
    if (isColorUndecided) {
        rules.blockingFacts = rules.blockingFacts.filter(fact => fact !== 'paintColor');
        rules.requiredFacts = rules.requiredFacts.filter(fact => fact !== 'paintColor');
        rules.constraints.push("Customer belum tahu warna. WAJIB ubah Goal menjadi PRICE_ESTIMATION dan panggil tool GET_PRICE untuk memberikan estimasi/range harga dasar.");
    }

    // 3. Promo/Combo Logic
    const promoInfo = await getActivePromo();
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

    // 4. Upsells
    if (isBodiHalus || isFullBody) {
        let reason = 'Sekalian tambah layanan Cuci Komplit agar pas motornya selesai dicat, bagian lainnya juga bersih semua.';
        
        // Cek apakah ada promo aktif yang bisa di-piggyback
        if (promoInfo && promoInfo.comboDiscount) {
            const discPct = promoInfo.comboDiscount * 100;
            reason += ` Apalagi kebetulan lagi ada promo diskon combo ${discPct}% kalau ambil barengan!`;
        }
        
        rules.upsells.push({
            type: 'UPSELL',
            service: 'Cuci Komplit',
            reason: reason
        });
    }

    // 5. Conversation Guidelines (Legacy support for specific prompting tweaks)
    const isShowingPrice = (state.planner?.nextAction === 'SHOW_PRICE' || state.planner?.strategy === 'EDUCATE' || state.planner?.toolIntent === 'GET_PRICE');
    if (isShowingPrice) {
        rules.guidelines.push({
            type: 'CONVERSATION_GUIDELINE',
            directive: 'Pastikan untuk merangkum total harga sebagai range (misal: "estimasi total sekitar 2.2 - 2.5 juta") jika ada banyak layanan. JANGAN tanya "masuk budget nggak?". Tanyakan saja "Bagaimana mas, mau lanjut booking atau ada yang mau ditanyakan soal paketnya?".'
        });
    }

    return rules;
}

module.exports = {
    evaluateRepaintRules
};
