const { Annotation } = require('@langchain/langgraph');

/**
 * ZOYA V2 State Schema
 * Single Source of Truth
 */
const ZoyaState = Annotation.Root({
    // 1. Conversation
    conversation: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            id: null,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active', // active, waiting_customer, completed, handover
            language: 'id',
            summary: null,
            messages: []
        })
    }),

    // 2. Customer
    customer: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            id: null,
            name: null,
            phone: null,
            isReturning: false,
            tags: [],
            notes: null,
            trustLevel: 0,
            relationshipScore: 0
        })
    }),

    // 3. Vehicle
    vehicle: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            brand: null,
            model: null,
            year: null,
            paintType: null, // Glossy, Doff, Unknown
            currentCondition: null // Original, Repainted, Unknown
        })
    }),

    // 4. Consultation
    consultation: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            goal: null, // e.g., "Customer ingin repaint body halus"
            stage: 'DISCOVERING', // DISCOVERING, CLARIFYING, CONSULTING, RECOMMENDING, PRICING, OBJECTION, BOOKING, DONE
            requestedServices: [],
            recommendedServices: [],
            last_offered_services: [],
            knownFacts: {},
            missingFacts: []
        })
    }),

    // 5. Pricing
    pricing: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            estimatedPrice: null,
            discount: 0,
            promotion: null,
            priceSource: null, // database, manual, bosmat
            isFinal: false
        })
    }),

    // 6. Booking
    booking: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            status: 'none', // none, asking, confirmed, completed, cancelled
            preferredDate: null,
            preferredTime: null,
            bookingId: null
        })
    }),

    // 7. Sales
    sales: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            buyerStage: 'Exploring', // Exploring, Comparing, Ready to Buy, Hesitating, Cooling Down
            interestLevel: null, // high, medium, low
            budget: null,
            urgency: null,
            objection: null,
            sentiment: null,
            closingProbability: 0
        })
    }),

    // 8. Planner
    planner: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            goal: null,
            plannerContext: {},
            nextAction: null, // ASK, INFORM, CALL_TOOL, WAIT, END, CONFIRM, ESCALATE, HANDOFF
            toolIntent: null, // NONE, GET_PRICE, BOOK, CHECK_BOOKING, ESCALATE, NOTIFY, ANSWER
            informationPriority: [],
            reasoning: {},
            decision: {},
            execution: {},
            conversation: {}
        })
    }),

    // 9. Tool
    tool: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            lastCapability: null,
            lastTool: null,
            lastResult: null,
            executionHistory: []
        })
    }),

    // 10. Memory
    memory: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            customerPreference: null,
            favoriteColor: null,
            favoriteService: null,
            previousMotor: null,
            lastRecommendation: null,
            summary: null
        })
    }),

    // 11. Business
    business: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            sop: {},
            constraints: [],
            blockingFacts: [],
            requiredFacts: [],
            optionalFacts: [],
            upsells: [],
            promotions: [],
            restrictions: [],
            escalations: [],
            guidelines: [],
            escalation: false,
            disabledServices: []
        })
    }),

    // 12. Analytics
    analytics: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            plannerRuns: 0,
            toolCalls: 0,
            responseCount: 0,
            conversationLength: 0,
            stageHistory: []
        })
    }),

    // 13. Cart — Persistent shopping cart accumulating services across turns
    // Items schema:
    //   multi-package: { type:"multi-package", candidates:[{name,price}], selectedPackage:null|"Standar", isDiscountEligible:true }
    //   fixed-price:   { type:"fixed", price:275000, isDiscountEligible:false }
    cart: Annotation({
        reducer: (old, updated) => {
            if (!updated) return old;
            const mergedItems = { ...(old?.items || {}) };
            if (updated.items) {
                // If a key's value is explicitly null, delete it from the cart
                Object.keys(updated.items).forEach(k => {
                    if (updated.items[k] === null) {
                        delete mergedItems[k];
                    } else {
                        mergedItems[k] = updated.items[k];
                    }
                });
            }
            return {
                items: mergedItems,
                calculatedAt: updated.calculatedAt || old?.calculatedAt || null
            };
        },
        default: () => ({ items: {}, calculatedAt: null })
    }),

    // 14. Knowledge (Loaded once, read-only for Planner and Composer)
    knowledge: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            raw: {}
        })
    }),

    // Messages array used strictly by LangGraph for internal state bridging if needed,
    // though the v2 schema dictates storing messages in conversation.messages.
    // Keeping it here for basic LCEL / ToolNode compatibility.
    messages: Annotation({
        reducer: (oldMessages, newMessages) => {
            let combined = [...oldMessages];
            if (Array.isArray(newMessages)) {
                combined.push(...newMessages);
            } else {
                combined.push(newMessages);
            }
            if (combined.length > 20) {
                combined = combined.slice(-20);
            }
            return combined;
        },
        default: () => []
    }),

    // Track last offered services for coreference resolution (populated by composerNode)
    last_offered_services: Annotation({
        reducer: (old, next) => (Array.isArray(next) ? next : old),
        default: () => []
    }),

    // Legacy flag for admin routing, kept for backward compatibility with v1
    isAdmin: Annotation({
        reducer: (old, next) => next,
        default: () => false
    }),

    // Metadata for incoming request
    metadata: Annotation({
        reducer: (old, next) => ({ ...old, ...next }),
        default: () => ({})
    })
});

module.exports = {
    ZoyaState
};
