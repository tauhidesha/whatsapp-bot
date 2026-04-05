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

    const isLid = trimmed.endsWith('@lid');
    // If it has a suffix, use it. If not, simple numeric + @c.us
    const fullId = trimmed.includes('@') ? trimmed : `${trimmed.replace(/\D/g, '')}@c.us`;

    return {
        docId: fullId, 
        numericId: fullId.replace(/@c\.us$|@lid$/, '').replace(/\D/g, ''),
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