const prisma = require('./prisma.js');

const VALID_LABELS = [
    'hot_lead',
    'cold_lead',
    'booking_process',
    'completed',
    'general',
    'follow_up',
    'scheduling',
    'archive'
];

const LABEL_DISPLAY_NAMES = {
    hot_lead: 'Hot Lead',
    cold_lead: 'Cold Lead',
    booking_process: 'Booking Process',
    completed: 'Completed',
    follow_up: 'Follow Up',
    general: 'General',
    scheduling: 'Scheduling',
    archive: 'Archive'
};

const PERIOD_MAP = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures a WhatsApp label exists by name.
 * Checks SQL cache -> Checks WA -> Returns null if missing.
 */
async function ensureWhatsAppLabel(client, db_is_ignored, labelKey) {
    if (!client) return null;

    const labelName = LABEL_DISPLAY_NAMES[labelKey] || labelKey;
    let labelId = null;

    // 1. Check SQL Cache (KeyValueStore)
    try {
        const cached = await prisma.keyValueStore.findUnique({
            where: { collection_key: { collection: '_labelCache', key: labelKey } }
        });
        
        if (cached && cached.value && cached.value.labelId) {
            labelId = cached.value.labelId;
            // Verify if it still exists in WA
            if (client.getAllLabels) {
                const allLabels = await client.getAllLabels();
                const stillExists = allLabels.find((l) => l.id?.toString() === labelId);
                if (stillExists) {
                    console.log(`[LabelUtils] ✅ SQL Cache hit for label "${labelName}" (ID: ${labelId})`);
                    return { id: labelId, name: labelName };
                } else {
                    console.warn(`[LabelUtils] Cached ID ${labelId} not found in WA, clearing SQL cache.`);
                    labelId = null; 
                }
            } else {
                return { id: labelId, name: labelName };
            }
        }
    } catch (err) {
        console.warn('[LabelUtils] SQL Cache check failed:', err.message);
    }

    // 2. Search in existing WA labels
    if (client.getAllLabels) {
        try {
            console.log(`[LabelUtils] Fetching all labels from WhatsApp to find "${labelName}"...`);
            const allLabels = await client.getAllLabels();

            const existing = allLabels.find((l) => l.name === labelName);
            if (existing && existing.id) {
                labelId = existing.id.toString();
                console.log(`[LabelUtils] ✅ Found label "${labelName}" in WA with ID: ${labelId}`);
                // Update SQL cache
                await cacheLabel(labelKey, labelId, labelName);
                return { id: labelId, name: labelName };
            }
        } catch (err) {
            console.warn('[LabelUtils] getAllLabels failed:', err.message);
        }
    }

    console.warn(`[LabelUtils] Label "${labelName}" not found in WhatsApp.`);
    return null;
}

/**
 * Assigns a label to a chat in WhatsApp and tracks it in SQL Customer table.
 */
async function assignWhatsAppLabel(client, db_ignored, senderNumber, docId_is_phone, labelId, prevLabelId = null) {
    if (!client || !client.addOrRemoveLabels) return false;
    const phone = docId_is_phone.replace(/[^0-9]/g, '');

    try {
        const operations = [];

        // Remove old label if exists and different
        if (prevLabelId && prevLabelId !== labelId) {
            operations.push({ labelId: prevLabelId, type: 'remove' });
        }

        // Add new label
        operations.push({ labelId, type: 'add' });

        await client.addOrRemoveLabels([senderNumber], operations);

        // Update tracking in SQL (Customer table)
        // We use whatsappLid or custom field if needed, but for now we store in metadata or similar
        // Let's use Customer schema field if available or KeyValueStore
        await prisma.customer.update({
            where: { phone },
            data: { 
                notes: `WA_LABEL_ID:${labelId}`, // Simple tracking in notes for now
                updatedAt: new Date()
            }
        }).catch(err => console.warn('[LabelUtils] Failed to update customer label info:', err.message));

        return true;
    } catch (err) {
        console.warn('[LabelUtils] assignWhatsAppLabel failed:', err.message);
        return false;
    }
}

async function cacheLabel(labelKey, labelId, labelName) {
    try {
        await prisma.keyValueStore.upsert({
            where: { collection_key: { collection: '_labelCache', key: labelKey } },
            update: {
                value: { labelId, labelName, updatedAt: new Date().toISOString() }
            },
            create: {
                collection: '_labelCache',
                key: labelKey,
                value: { labelId, labelName, updatedAt: new Date().toISOString() }
            }
        });
    } catch (e) {
        console.warn('[LabelUtils] SQL Cache update failed:', e.message);
    }
}

module.exports = {
    VALID_LABELS,
    LABEL_DISPLAY_NAMES,
    PERIOD_MAP,
    ensureWhatsAppLabel,
    assignWhatsAppLabel,
};
