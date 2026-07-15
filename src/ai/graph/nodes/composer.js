const { buildComposerPrompt } = require('../../prompts/promptBuilder');

/**
 * Response Composer Node for Zoya V2
 * Formulates natural responses based on the strategy chosen by the Planner,
 * factoring in any Rule flags and Tool results.
 */

async function composerNode(state) {
    console.log('[Composer Node] Composing natural response...');
    
    const strategy = state.planner?.strategy || 'BUILD_TRUST';
    const nextAction = state.planner?.nextAction || 'WAIT';
    
    // In full implementation, we pass this prompt to an LLM
    const _compiledPrompt = buildComposerPrompt(state, state.planner || {});

    let responseText = '';

    // Mocking the LLM behavior based on state logic
    if (state.business?.restrictions?.length > 0) {
        // If there's a restriction, the composer should naturally explain it
        const restriction = state.business.restrictions[0];
        responseText = `Hehe maaf ya mas 🙏\nUntuk ${restriction.service}, ${restriction.reason.toLowerCase()}\nBiar aman, mending kita ${restriction.suggestedAction.toLowerCase()} dulu aja ya 😊`;
    } 
    else if (strategy === 'EDUCATE' && state.tool?.lastCapability === 'pricing') {
        const result = state.tool.lastResult;
        responseText = `Siap mas 🙌\nKalau untuk ${result?.service || 'layanan ini'} harganya Rp${result?.price?.toLocaleString('id-ID') || '800.000'} ya.\nSudah termasuk poles finishing juga. Kalau sekalian mau dibersihkan, bisa tambah Cuci Komplit biar hasilnya makin maksimal 😊`;
    } 
    else if (strategy === 'EMPATHIZE' && nextAction === 'WAIT') {
        // Empathizing with objections (e.g., "belum gajian")
        responseText = `Oh siap mas, santai aja kok 😊\nKalau nanti sudah pas waktunya atau mau nanya-nanya lagi, tinggal chat aja ya. Nanti saya bantu hitungkan lagi.`;
    } 
    else if (strategy === 'BUILD_TRUST' && nextAction === 'BOOK') {
        responseText = `Kalau sudah cocok nanti saya bantu booking ya 🙌\nBisa diinfokan mau jadwalkan hari apa mas?`;
    } 
    else if (strategy === 'CLARIFY' && nextAction === 'ASK') {
        responseText = `Siap mas 🙌\nBiar hitungannya pas, motornya jenis apa ya mas?`;
    } 
    else {
        responseText = `Siap mas, dicatat. Ada lagi yang mau ditanyain mas?`;
    }

    const conversationUpdate = {
        lastMessages: [...(state.conversation?.lastMessages || []), responseText]
    };

    return {
        conversation: conversationUpdate,
        analytics: {
            responseCount: (state.analytics?.responseCount || 0) + 1
        }
    };
}

module.exports = {
    composerNode
};
