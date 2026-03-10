// File: src/ai/utils/mergeCustomerContext.js
// Merge logic untuk customer context extraction.
// Tidak overwrite data lama jika ekstraksi baru tidak menemukan info.

const admin = require('firebase-admin');

/**
 * Merge new extracted data with existing data.
 * Rules:
 * - If new value is null/undefined/'' → keep old value
 * - If new value exists → use new (fresher)
 * - Fields in existing but not in newData → preserve
 * 
 * @param {Object} current - Existing data from Firestore
 * @param {Object} newData - Newly extracted data
 * @returns {Object} Merged data
 */
function mergeContextData(current, newData) {
    const merged = {};

    // Process incoming fields
    for (const [key, value] of Object.entries(newData)) {
        if (value === null || value === undefined || value === '') {
            // Pertahankan data lama kalau ekstraksi baru tidak dapat info
            merged[key] = current[key] ?? null;
        } else if (key === 'upsell_offered' && current[key] === true) {
            // Sticky true for upselling stage to avoid regression
            merged[key] = true;
        } else {
            // Data baru lebih fresh, pakai yang baru
            merged[key] = value;
        }
    }

    // Field yang ada di existing tapi tidak di newData → pertahankan
    for (const [key, value] of Object.entries(current)) {
        if (!(key in merged)) {
            merged[key] = value;
        }
    }

    return merged;
}

/**
 * Merge extracted context and save to Firestore.
 * Collection: customerContext/{docId}
 * 
 * @param {string} senderNumber - Raw sender number (e.g. "6281234567890@c.us")
 * @param {Object} newData - Extracted context data
 */
async function mergeAndSaveContext(senderNumber, newData) {
    if (!senderNumber || !newData || typeof newData !== 'object') return;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    if (!docId) return;

    const ref = db.collection('customerContext').doc(docId);

    try {
        const existing = await ref.get();
        const current = existing.exists ? existing.data() : {};

        // Remove internal fields from merging
        const { updatedAt, senderNumber: _, ...cleanCurrent } = current;

        const merged = mergeContextData(cleanCurrent, newData);

        await ref.set({
            ...merged,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            senderNumber,
        }, { merge: true });

        console.log(`[Context] Saved context for ${docId}:`, Object.keys(merged).filter(k => merged[k] !== null).join(', '));
    } catch (error) {
        console.error(`[Context] Error saving context for ${docId}:`, error.message);
        throw error;
    }
}

/**
 * Retrieve customer context from Firestore.
 * 
 * @param {string} senderNumber - Raw sender number
 * @returns {Object|null} Context data or null
 */
async function getCustomerContext(senderNumber) {
    if (!senderNumber) return null;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    if (!docId) return null;

    try {
        const doc = await db.collection('customerContext').doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            // Remove internal fields
            const { updatedAt, senderNumber: _, ...context } = data;
            return context;
        }
        return null;
    } catch (error) {
        console.warn('[Context] Gagal mengambil customer context:', error.message);
        return null;
    }
}

/**
 * Synchronize customer_label from customerContext to directMessages collection
 * to ensure visual consistency in the dashboard.
 * 
 * @param {string} senderNumber - Raw sender number
 * @param {string} aiLabel - Label from customerClassifier
 */
async function syncLabelToDirectMessages(senderNumber, aiLabel) {
    if (!senderNumber || !aiLabel) return;

    const db = admin.firestore();
    const docId = senderNumber.replace(/[^0-9]/g, '');
    if (!docId) return;

    // AI to Frontend Label Mapping
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
        const dmRef = db.collection('directMessages').doc(docId);
        
        await dmRef.set({
            customerLabel: frontendLabel,
            labelReason: `AI Sync: ${aiLabel}`,
            labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[Context] Synced label for ${docId}: ${aiLabel} -> ${frontendLabel}`);
    } catch (error) {
        console.error(`[Context] Error syncing label for ${docId}:`, error.message);
    }
}

module.exports = {
    mergeContextData,
    mergeAndSaveContext,
    getCustomerContext,
    syncLabelToDirectMessages,
};
