/**
 * Restriction Rules for Repaint + Coating conflicts.
 * Based on docs/07-business-rule-engine.md
 */

function evaluateCoatingRestriction(state) {
    const requested = state.consultation?.requestedServices || [];
    const hasRepaint = requested.includes('repaint');
    
    if (hasRepaint) {
        return {
            type: 'RESTRICTION',
            service: 'coating',
            status: 'DISABLED',
            reason: 'Cat baru butuh curing 1 bulan agar solvent menguap sempurna. Coating menutup pori-pori dan merusak cat.',
            suggestedAction: 'Tawarkan paket perlindungan sealant sementara'
        };
    }
    
    return null;
}

module.exports = {
    evaluateCoatingRestriction
};
