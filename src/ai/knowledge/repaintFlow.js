/**
 * Repaint Service Flows
 * 
 * This file defines the required facts and optional facts for different repaint flows.
 * This is used by the Rule Engine to supply constraints to the Planner, ensuring
 * the Planner knows exactly what information is missing before transitioning goals.
 */

const REPAINT_FLOWS = {
    FULL_BODY: {
        requiredFacts: [
            "motorModel",
            "partToRepaint",
            "paintColor"
        ],
        optionalFacts: [
            "paintType",
            "upsell_cuci_komplit"
        ],
        blockedFacts: []
    },
    BODY_HALUS: {
        requiredFacts: [
            "motorModel",
            "partToRepaint",
            "paintColor"
        ],
        optionalFacts: [
            "paintType",
            "upsell_cuci_komplit"
        ],
        blockedFacts: []
    },
    BODY_KASAR: {
        requiredFacts: [
            "motorModel",
            "partToRepaint"
        ],
        optionalFacts: [
            "upsell_cuci_komplit"
        ],
        blockedFacts: [
            "paintType",
            "paintColor",
            "color"
        ]
    },
    VELG: {
        requiredFacts: [
            "motorModel",
            "partToRepaint",
            "paintColor",
            "velgCondition"
        ],
        optionalFacts: [
            "paintType",
            "upsell_cuci_komplit"
        ],
        blockedFacts: []
    }
};

module.exports = {
    REPAINT_FLOWS
};
