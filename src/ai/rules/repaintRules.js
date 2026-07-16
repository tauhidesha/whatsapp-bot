const { REPAINT_FLOWS } = require('../knowledge/repaintFlow');

/**
 * Repaint Flow Rules
 * Guides the conversation steps for repaint requests.
 */

const { businessRules } = require('./businessRulesData');

function evaluateRepaintRules(state) {
    const rules = {
        sop: {},
        constraints: [],
        requiredFacts: [],
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
    const knownMotor = knownFacts.motor || vehicle?.model;
    const knownRepaintTarget = knownFacts.repaintTarget || knownFacts.scope;

    // Filter SOP based on context (knownFacts and remainingFacts)
    const contextKeys = [
        ...Object.keys(knownFacts), 
        ...(state.planner?.reasoning?.goalStatus?.remainingFacts?.map(f => f.field) || [])
    ];
    
    // Always include communication rules for repaint
    rules.sop.communication = businessRules.communication;

    // Include paint rules if color or part is discussed
    if (contextKeys.includes('paintColor') || contextKeys.includes('partToRepaint') || isRepaintRequested) {
        rules.sop.paint = businessRules.paint;
    }

    // 2. Identify Flow and Inject Required Facts
    const isFullBody = requested.some(s => s.toLowerCase().includes('full bodi') && !s.toLowerCase().includes('halus'));
    const isBodiHalus = requested.some(s => s.toLowerCase().includes('bodi halus') || s.toLowerCase().includes('full bodi halus'));
    const isBodiKasar = requested.some(s => s.toLowerCase().includes('bodi kasar'));
    const isVelg = requested.some(s => s.toLowerCase().includes('velg')) || knownRepaintTarget?.toLowerCase().includes('velg');
    
    if (isFullBody) {
        rules.requiredFacts.push(...REPAINT_FLOWS.FULL_BODY.requiredFacts);
    } else if (isBodiHalus) {
        rules.requiredFacts.push(...REPAINT_FLOWS.BODY_HALUS.requiredFacts);
    } else if (isBodiKasar) {
        rules.requiredFacts.push(...REPAINT_FLOWS.BODY_KASAR.requiredFacts);
    } else if (isVelg) {
        rules.requiredFacts.push(...REPAINT_FLOWS.VELG.requiredFacts);
    } else {
        // Generic repaint, needs clarification
        rules.requiredFacts.push("motorModel", "partToRepaint");
    }

    // 3. Upsells
    if (isBodiHalus || isFullBody) {
        rules.upsells.push({
            type: 'UPSELL',
            service: 'Cuci Komplit',
            reason: 'Sekalian tambah layanan Cuci Komplit agar pas motornya selesai dicat, bagian lainnya juga bersih semua.'
        });
    }

    // 4. Conversation Guidelines (Legacy support for specific prompting tweaks)
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
