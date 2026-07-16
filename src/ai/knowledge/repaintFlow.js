/**
 * Repaint Service Flows
 * 
 * This file defines the required facts and optional facts for different repaint flows.
 * This is used by the Rule Engine to supply constraints to the Planner, ensuring
 * the Planner knows exactly what information is missing before transitioning goals.
 */

const REPAINT_FLOWS = {
    FULL_BODY: {
        blockingFacts: [
            "motorModel",
            "partToRepaint"
        ],
        requiredFacts: [
            "paintColor"
        ],
        optionalFacts: [
            "paintType",
            "upsell_cuci_komplit"
        ],
        blockedFacts: []
    },
    BODY_HALUS: {
        blockingFacts: [
            "motorModel",
            "partToRepaint"
        ],
        requiredFacts: [
            "paintColor"
        ],
        optionalFacts: [
            "paintType",
            "upsell_cuci_komplit"
        ],
        blockedFacts: []
    },
    BODY_KASAR: {
        blockingFacts: [
            "motorModel",
            "partToRepaint"
        ],
        requiredFacts: [],
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
        blockingFacts: [
            "motorModel",
            "partToRepaint"
        ],
        requiredFacts: [
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
