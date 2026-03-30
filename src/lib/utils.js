// File: src/lib/utils.js
// Shared utility functions

const WHATSAPP_SUFFIX = '@c.us';

function normalizePhone(phone) {
    if (!phone) return '';
    let clean = String(phone).split('@')[0].replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.length >= 10 && !clean.startsWith('62')) clean = '62' + clean;
    return clean;
}

function parseSenderIdentity(rawValue) {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) {
        return {
            docId: '',
            channel: 'unknown',
            platformId: null,
            normalizedAddress: '',
        };
    }

    const isLid = trimmed.endsWith('@lid');
    const numericPart = normalizePhone(trimmed); // Numeric version (62...)
    const fullId = isLid ? trimmed : `${numericPart}@c.us`;

    return {
        docId: fullId, // Now returns full ID (with suffix) to match DB phone field
        numericId: numericPart, // Added numeric version for cases that need it
        channel: 'whatsapp',
        platformId: fullId,
        normalizedAddress: fullId,
        isLid,
        originalId: trimmed
    };
}


module.exports = {
    parseSenderIdentity,
};