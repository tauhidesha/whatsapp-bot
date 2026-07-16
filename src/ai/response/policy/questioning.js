/**
 * Questioning Policy
 * Controls how and when the AI asks questions to the user.
 */

const config = {
    maxQuestions: 1,
    empathizeBeforeQuestion: true
};

function getQuestioningDirectives(state, plannerDecision) {
    const directives = [];
    
    directives.push(`ONE QUESTION POLICY: Maksimal HANYA BOLEH mengajukan ${config.maxQuestions} pertanyaan di setiap pesan balasan. JANGAN membrondong customer dengan banyak pertanyaan sekaligus. Fokus pada SATU Action dari Planner.`);
    
    if (config.empathizeBeforeQuestion) {
        directives.push(`EMPATI SEBELUM BERTANYA: Jika customer mengeluh (jauh, belum ada dana), tunjukkan empati terlebih dahulu. JANGAN langsung berjualan atau memaksa *booking*.`);
    }

    // Sales stage alignment
    const stage = state.consultation?.stage;
    const strategy = plannerDecision?.strategy;
    if (strategy === 'BUILD_TRUST' || stage === 'DISCOVERING') {
        directives.push(`SALES ALIGNMENT: Jangan melakukan *hard closing*, *upsell*, atau memaksa *booking* di tahap ini. Fokus pada edukasi dan membangun kepercayaan.`);
    }

    return directives;
}

module.exports = {
    config,
    getQuestioningDirectives
};
