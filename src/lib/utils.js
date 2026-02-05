// File: src/lib/utils.js
// Shared utility functions

const WHATSAPP_SUFFIX = '@c.us';

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

    // Handle @lid suffix (Meta Business / Linked Devices)
    if (trimmed.endsWith('@lid')) {
        const baseId = trimmed.slice(0, -4);
        return {
            docId: baseId,
            channel: 'whatsapp',
            platformId: baseId,
            normalizedAddress: trimmed,
        };
    }

    const hasWhatsappSuffix = trimmed.endsWith(WHATSAPP_SUFFIX);
    const baseId = hasWhatsappSuffix ? trimmed.slice(0, -WHATSAPP_SUFFIX.length) : trimmed;

    let channel = 'whatsapp';
    let platformId = baseId;

    if (baseId.includes(':')) {
        const [channelPart, ...rest] = baseId.split(':');
        channel = channelPart || 'unknown';
        platformId = rest.length ? rest.join(':') : null;
    }

    const normalizedAddress = channel === 'whatsapp'
        ? `${baseId}${WHATSAPP_SUFFIX}`
        : baseId;

    return {
        docId: baseId,
        channel,
        platformId,
        normalizedAddress,
    };
}

module.exports = {
    parseSenderIdentity,
};