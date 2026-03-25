# Plan: Edge Case Handling & Orchestrator Refactoring

Harden the chatbot flow against user anomalies (topic switching, incomplete data, hallucinated context) by fully moving validation logic to JavaScript and restricting Agent 2 to pure NLG.

## Phase 1: Context Extractor Schema Upgrade
#### [MODIFY] [contextExtractor.js](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/src/ai/agents/contextExtractor.js)
- Replace `intent_level` (string) with `detected_intents` (array of enums).
- Add `is_changing_topic` (boolean) for interruption detection.
- Add `preferred_time` (string) alongside `preferred_day`.
- Add anti-hallucination instruction for `motor_model` / `target_services`.

## Phase 2: JS Orchestrator Gates
#### [MODIFY] [app.js](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/app.js)
- **Gate 1 (Interruption)**: Reset booking data if `is_changing_topic === true`.
- **Gate 2 (Multi-Intent + Escalation)**: Prioritize `tanya_teknis` → escalate. Otherwise continue.
- **Gate 3 (Strict Booking Validation)**: Validate `preferred_day` + `preferred_time` before booking. Check availability via JS. Execute `createBookingTool` only if slot is open.
- Inject `[SYSTEM_INSTRUCTION]` into Agent 2 prompt based on Gate results.

## Phase 3: Agent 2 NLG Restriction
#### [MODIFY] [app.js](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/app.js)
- Remove `createBookingTool`, `checkBookingAvailabilityTool` from `routeCustomerTools`.
- Agent 2 only receives `[SYSTEM_INSTRUCTION]` from JS Gates and generates natural language.

## Verification
- Manual test: topic change mid-booking → verify reset.
- Manual test: incomplete booking data → verify Zoya asks for missing info.
- Manual test: full booking flow → verify JS executes tool directly.
