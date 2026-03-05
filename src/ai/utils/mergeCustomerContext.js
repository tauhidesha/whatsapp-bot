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

module.exports = {
    mergeContextData,
    mergeAndSaveContext,
};
