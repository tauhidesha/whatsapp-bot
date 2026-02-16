const admin = require('firebase-admin');

const VALID_LABELS = [
    'hot_lead',
    'cold_lead',
    'booking_process',
    'completed',
    'general',
    'follow_up',
];

const LABEL_DISPLAY_NAMES = {
    hot_lead: 'Hot Lead',
    cold_lead: 'Cold Lead',
    booking_process: 'Booking Process',
    completed: 'Completed',
    follow_up: 'Follow Up',
    general: 'General',
};

const PERIOD_MAP = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures a WhatsApp label exists by name.
 * Checks cache -> Checks WA -> Returns null if missing (does NOT create).
 * @param {object} client - WPPConnect client instance
 * @param {object} db - Firestore instance
 * @param {string} labelKey - The internal label key (e.g., 'hot_lead')
 * @returns {Promise<{id: string, name: string}|null>} The label object or null if failed
 */
async function ensureWhatsAppLabel(client, db, labelKey) {
    if (!client) return null;

    const labelName = LABEL_DISPLAY_NAMES[labelKey] || labelKey;
    let labelId = null;

    // 1. Check Firestore Cache
    try {
        const labelCacheRef = db.collection('_labelCache').doc(labelKey);
        const cached = await labelCacheRef.get();
        if (cached.exists && cached.data().labelId) {
            labelId = cached.data().labelId;
            // Verify if it still exists in WA (optional but good for consistency)
            if (client.getAllLabels) {
                const allLabels = await client.getAllLabels();
                const stillExists = allLabels.find((l) => l.id?.toString() === labelId);
                if (stillExists) {
                    console.log(`[LabelUtils] ✅ Cache hit for label "${labelName}" (ID: ${labelId})`);
                    return { id: labelId, name: labelName };
                } else {
                    console.warn(`[LabelUtils] Cached ID ${labelId} not found in WA, clearing cache.`);
                    labelId = null; // Reset to find/create again
                }
            } else {
                return { id: labelId, name: labelName };
            }
        }
    } catch (err) {
        console.warn('[LabelUtils] Cache check failed:', err.message);
    }

    // 2. Search in existing WA labels
    if (client.getAllLabels) {
        try {
            console.log(`[LabelUtils] Fetching all labels from WhatsApp to find "${labelName}"...`);
            const allLabels = await client.getAllLabels();

            // Log available labels for debugging
            const availableNames = allLabels.map(l => l.name).join(', ');
            console.log(`[LabelUtils] Available labels in WA (${allLabels.length}): ${availableNames}`);

            const existing = allLabels.find((l) => l.name === labelName);
            if (existing && existing.id) {
                labelId = existing.id.toString();
                console.log(`[LabelUtils] ✅ Found label "${labelName}" in WA with ID: ${labelId}`);
                // Update cache
                await cacheLabel(db, labelKey, labelId, labelName);
                return { id: labelId, name: labelName };
            } else {
                console.warn(`[LabelUtils] ⚠️ Label "${labelName}" NOT found in WA list.`);
            }
        } catch (err) {
            console.warn('[LabelUtils] getAllLabels failed:', err.message);
        }
    }

    // 3. Label not found (User must create it manually)
    console.warn(`[LabelUtils] Label "${labelName}" not found in WhatsApp. Please create it manually in WA Business.`);
    return null;
}

/**
 * Assigns a label to a chat, removing any previous tracked label.
 * @param {object} client - WPPConnect client
 * @param {object} db - Firestore instance
 * @param {string} senderNumber - The phone number
 * @param {string} docId - The Firestore doc ID
 * @param {string} labelId - The new label ID to assign
 * @param {string} [prevLabelId] - The previous label ID to remove (optional)
 * @returns {Promise<boolean>} Success status
 */
async function assignWhatsAppLabel(client, db, senderNumber, docId, labelId, prevLabelId = null) {
    if (!client || !client.addOrRemoveLabels) return false;

    try {
        const operations = [];

        // Remove old label if exists and different
        if (prevLabelId && prevLabelId !== labelId) {
            operations.push({ labelId: prevLabelId, type: 'remove' });
        }

        // Add new label
        operations.push({ labelId, type: 'add' });

        await client.addOrRemoveLabels([senderNumber], operations);

        // Update tracking in Firestore
        await db.collection('directMessages').doc(docId).set(
            { whatsappLabelId: labelId },
            { merge: true }
        );

        return true;
    } catch (err) {
        console.warn('[LabelUtils] assignWhatsAppLabel failed:', err.message);
        return false;
    }
}

async function cacheLabel(db, labelKey, labelId, labelName) {
    try {
        await db.collection('_labelCache').doc(labelKey).set({
            labelId,
            labelName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.warn('[LabelUtils] Cache update failed:', e.message);
    }
}

module.exports = {
    VALID_LABELS,
    LABEL_DISPLAY_NAMES,
    PERIOD_MAP,
    ensureWhatsAppLabel,
    assignWhatsAppLabel,
};
