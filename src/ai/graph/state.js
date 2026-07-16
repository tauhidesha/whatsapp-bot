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
            requiredFacts: [],
            optionalFacts: [],
            upsells: [],
            promotions: [],
            restrictions: [],
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

    // 13. Knowledge (Loaded once, read-only for Planner and Composer)
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

    // Legacy flag for admin routing, kept for backward compatibility with v1
    isAdmin: Annotation({
        reducer: (old, next) => next,
        default: () => false
    })
});

module.exports = {
    ZoyaState
};
