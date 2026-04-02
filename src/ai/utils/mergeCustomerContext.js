// File: src/ai/utils/mergeCustomerContext.js
// Merge logic untuk customer context extraction.
// Menggunakan Prisma CustomerContext model.

const prisma = require('../../lib/prisma');
const { normalizePlate } = require('../../lib/vehicleService');
const { parseSenderIdentity } = require('../../lib/utils');


/**
 * Normalize phone number for use as ID.
 */
function normalizePhone(senderNumber) {
    if (!senderNumber) return null;
    // Use centralized identity parsing to ensure consistency with DB (including suffixes)
    const { docId } = parseSenderIdentity(senderNumber);
    return docId;
}


/**
 * Map LLM snake_case output to Prisma camelCase field names.
 */
function mapExtractedToPrismaFields(extracted) {
    return {
        motorModel: extracted.motor_model || null,
        motorPlate: extracted.motor_plate ? normalizePlate(extracted.motor_plate) : null,
        motorYear: extracted.motor_year || null,
        motorColor: extracted.motor_color || null,
        motorCondition: extracted.motor_condition || null,
        targetServices: Array.isArray(extracted.target_services) ? extracted.target_services : [],
        serviceDetail: extracted.service_detail || null,
        paintType: extracted.paint_type || null,
        isBongkarTotal: extracted.is_bongkar_total === true ? true : extracted.is_bongkar_total === false ? false : null,
        budgetSignal: extracted.budget_signal || null,
        detectedIntents: Array.isArray(extracted.detected_intents) ? extracted.detected_intents : [],
        isChangingTopic: extracted.is_changing_topic === true,
        saidExpensive: extracted.said_expensive === true ? true : extracted.said_expensive === false ? false : null,
        askedPrice: extracted.asked_price === true ? true : extracted.asked_price === false ? false : null,
        askedAvailability: extracted.asked_availability === true ? true : extracted.asked_availability === false ? false : null,
        sharedPhoto: extracted.shared_photo === true ? true : extracted.shared_photo === false ? false : null,
        preferredDay: extracted.preferred_day || null,
        preferredTime: extracted.preferred_time || null,
        locationHint: extracted.location_hint || null,
        quotedServices: extracted.quoted_services || null,
        quotedTotalNormal: extracted.quoted_total_normal || null,
        quotedTotalBundling: extracted.quoted_total_bundling || null,
        quotedAt: extracted.quoted_at ? new Date(extracted.quoted_at) : null,
        conversationStage: extracted.conversation_stage || null,
        lastAiAction: extracted.last_ai_action || null,
        upsellOffered: extracted.upsell_offered === true ? true : extracted.upsell_offered === false ? false : null,
        upsellAccepted: extracted.upsell_accepted === true ? true : extracted.upsell_accepted === false ? false : null,
        butuhBantuanAdmin: extracted.butuh_bantuan_admin === true,
        conversationSummary: extracted.conversation_summary || null,
        visualSummary: extracted.visual_summary || null,
        sharedPhoto: (extracted.shared_photo === true || !!extracted.visual_summary) ? true : extracted.shared_photo === false ? false : null,
    };
}

/**
 * Map Prisma camelCase fields to LLM snake_case output.
 */
function mapPrismaToLLMFields(data) {
    if (!data) return null;
    return {
        motor_model: data.motorModel,
        motor_plate: data.motorPlate,
        motor_year: data.motorYear,
        motor_color: data.motorColor,
        motor_condition: data.motorCondition,
        target_services: data.targetServices || [],
        service_detail: data.serviceDetail,
        paint_type: data.paintType,
        is_bongkar_total: data.isBongkarTotal,
        budget_signal: data.budgetSignal,
        detected_intents: data.detectedIntents || [],
        is_changing_topic: data.isChangingTopic,
        said_expensive: data.saidExpensive,
        asked_price: data.askedPrice,
        asked_availability: data.askedAvailability,
        shared_photo: data.sharedPhoto,
        preferred_day: data.preferredDay,
        preferred_time: data.preferredTime,
        location_hint: data.locationHint,
        quoted_services: data.quotedServices,
        quoted_total_normal: data.quotedTotalNormal,
        quoted_total_bundling: data.quotedTotalBundling,
        quoted_at: data.quotedAt?.toISOString(),
        conversation_stage: data.conversationStage,
        last_ai_action: data.lastAiAction,
        upsell_offered: data.upsellOffered,
        upsell_accepted: data.upsellAccepted,
        butuh_bantuan_admin: data.butuhBantuanAdmin,
        conversation_summary: data.conversationSummary,
        visual_summary: data.visualSummary,
        customer_label: data.customerLabel,
    };
}

/**
 * Merge new extracted data with existing data.
 * Rules:
 * - If new value is null/undefined/'' → keep old value
 * - If new value exists → use new (fresher)
 * - Fields in existing but not in newData → preserve
 */
function mergeContextData(current, newData) {
    const merged = {};

    for (const [key, value] of Object.entries(newData)) {
        if (value === null || value === undefined || value === '') {
            merged[key] = current[key] ?? null;
        } else if (key === 'upsell_offered' && current[key] === true) {
            merged[key] = true;
        } else {
            merged[key] = value;
        }
    }

    for (const [key, value] of Object.entries(current)) {
        if (!(key in merged)) {
            merged[key] = value;
        }
    }

    return merged;
}

/**
 * Merge extracted context and save to Prisma CustomerContext.
 * Uses upsert to avoid duplicate key errors.
 */
async function mergeAndSaveContext(senderNumber, newData) {
    if (!senderNumber || !newData || typeof newData !== 'object') return;

    const docId = normalizePhone(senderNumber);
    if (!docId) return;

    try {
        const existing = await prisma.customerContext.findUnique({
            where: { id: docId }
        });

        // Convert new LLM output to Prisma format (camelCase)
        const newPrisma = mapExtractedToPrismaFields(newData);
        
        // Existing data is already in Prisma format (camelCase)
        const existingPrisma = existing || {};

        // Merge: keep existing if new value is null/empty
        const merged = {};
        
        // Start with existing data
        for (const [key, value] of Object.entries(existingPrisma)) {
            merged[key] = value;
        }
        
        // Override with new data (only if not null/undefined/empty)
        for (const [key, value] of Object.entries(newPrisma)) {
            if (value === null || value === undefined || value === '' || 
                (Array.isArray(value) && value.length === 0)) {
                // Keep existing value
                continue;
            } else if (key === 'upsell_offered' && merged.upsellOffered === true) {
                // Sticky true for upselling
                continue;
            } else {
                merged[key] = value;
            }
        }

        // Ensure customer exists before creating context (FK constraint)
        await prisma.customer.upsert({
            where: { phone: docId },
            create: { phone: docId, name: 'New Customer' },
            update: {}
        });

        await prisma.customerContext.upsert({
            where: { id: docId },
            create: {
                id: docId,
                phone: docId,
                ...merged,
            },
            update: merged,
        });

        console.log(`[Context] Saved context for ${docId}:`, 
            Object.keys(merged).filter(k => merged[k] !== null && merged[k] !== false && merged[k] !== '').join(', '));
    } catch (error) {
        console.error(`[Context] Error saving context for ${docId}:`, error.message);
        throw error;
    }
}

/**
 * Retrieve customer context from Prisma.
 */
async function getCustomerContext(senderNumber) {
    if (!senderNumber) return null;

    const docId = normalizePhone(senderNumber);
    if (!docId) return null;

    try {
        const data = await prisma.customerContext.findUnique({
            where: { id: docId }
        });

        if (data) {
            return mapPrismaToLLMFields(data);
        }
        return null;
    } catch (error) {
        console.warn('[Context] Gagal mengambil customer context:', error.message);
        return null;
    }
}

/**
 * Synchronize customer_label from CustomerContext to Customer table
 * for frontend dashboard compatibility.
 */
async function syncLabelToDirectMessages(senderNumber, aiLabel) {
    if (!senderNumber || !aiLabel) return;

    const docId = normalizePhone(senderNumber);
    if (!docId) return;

    const LABEL_MAPPING = {
        'hot_lead': 'hot_lead',
        'warm_lead': 'general',
        'lead': 'general',
        'window_shopper': 'cold_lead',
        'existing': 'completed',
        'existing_customer': 'completed',
        'loyal': 'completed',
        'churned': 'archive',
        'dormant_lead': 'archive'
    };

    const frontendLabel = LABEL_MAPPING[aiLabel] || 'general';

    try {
        await prisma.customer.update({
            where: { phone: docId },
            data: { 
                status: frontendLabel === 'completed' ? 'active' : undefined
            }
        });

        console.log(`[Context] Synced label for ${docId}: ${aiLabel} -> ${frontendLabel}`);
    } catch (error) {
        console.error(`[Context] Error syncing label for ${docId}:`, error.message);
    }
}

async function getGhostedCount(docId) {
    const ctx = await prisma.customerContext.findUnique({
        where: { id: docId },
        select: { ghostedTimes: true, lastGhostCountedAt: true }
    });
    return { 
        count: ctx?.ghostedTimes || 0, 
        lastCounted: ctx?.lastGhostCountedAt || null 
    };
}

/**
 * Update ghosted count in context.
 */
async function updateGhostedCountInContext(docId, newCount) {
    await prisma.customerContext.update({
        where: { id: docId },
        data: {
            ghostedTimes: newCount,
            lastGhostCountedAt: new Date()
        }
    });
}

/**
 * Sync LangGraph state to CRM (Flat Table).
 * This bridges the conversation state with the CRM data.
 */
async function syncGraphStateToCRM(senderNumber, state) {
    if (!senderNumber || !state) return;
    
    const docId = normalizePhone(senderNumber);
    if (!docId) return;

    try {
        const { context, metadata, intent } = state;
        
        // Map LangGraph context back to snake_case for the existing merger
        const extractorData = {
            motor_model: context.vehicleType,
            motor_color: context.colorChoice,
            target_services: context.serviceTypes,
            service_detail: context.serviceDetail,
            paint_type: context.paintType,
            is_bongkar_total: context.isBongkarTotal,
            visual_summary: metadata.visualSummary || context.visualSummary,
            detected_intents: [intent],
            conversation_stage: context.isReadyForTools ? 'ready' : 'collecting',
            shared_photo: !!(metadata.visualSummary || context.visualSummary)
        };

        // Merge and Save
        await mergeAndSaveContext(senderNumber, extractorData);
        
        console.log(`[CRM-Sync] Successfully synced LangGraph state for ${docId}`);
    } catch (err) {
        console.error(`[CRM-Sync] Error syncing ${docId}:`, err.message);
    }
}

module.exports = {
    mergeContextData,
    mergeAndSaveContext,
    getCustomerContext,
    syncLabelToDirectMessages,
    getGhostedCount,
    updateGhostedCountInContext,
    normalizePhone,
    mapExtractedToPrismaFields,
    mapPrismaToLLMFields,
    syncGraphStateToCRM
};
