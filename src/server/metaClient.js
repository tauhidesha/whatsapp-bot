const fetch = require('node-fetch');

const DEFAULT_GRAPH_BASE_URL = 'https://graph.facebook.com/v19.0';

function getGraphBaseUrl() {
    return (process.env.META_GRAPH_API_BASE_URL || DEFAULT_GRAPH_BASE_URL).replace(/\/$/, '');
}

function getMessengerAccessToken() {
    return process.env.META_MESSENGER_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
}

function getInstagramAccessToken() {
    return process.env.META_INSTAGRAM_ACCESS_TOKEN || process.env.META_IG_ACCESS_TOKEN;
}

function getInstagramBusinessId() {
    return process.env.META_INSTAGRAM_BUSINESS_ID || process.env.META_IG_BUSINESS_ID || null;
}

function getAccessToken(channel) {
    if (channel === 'instagram') {
        return getInstagramAccessToken();
    }
    return getMessengerAccessToken();
}

function getLogger(logger) {
    if (logger && typeof logger.log === 'function') {
        return logger;
    }
    return console;
}

async function sendMetaMessage(channel, recipientId, text, logger = console) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
        getLogger(logger).log('[MetaClient] Skipping empty message', { channel, recipientId });
        return { skipped: true };
    }

    const accessToken = getAccessToken(channel);
    if (!accessToken) {
        getLogger(logger).warn('[MetaClient] Missing access token', { channel });
        throw new Error(`Access token for ${channel} not configured`);
    }

    const graphBaseUrl = getGraphBaseUrl();
    const instagramBusinessId = getInstagramBusinessId();

    const basePath = channel === 'instagram'
        ? (instagramBusinessId || 'me')
        : 'me';

    if (channel === 'instagram' && !instagramBusinessId) {
        getLogger(logger).warn('[MetaClient] Instagram business ID not configured; using /me/messages fallback');
    }

    const url = `${graphBaseUrl}/${basePath}/messages?access_token=${encodeURIComponent(accessToken)}`;
    const payload = {
        recipient: { id: recipientId },
        message: { text: trimmed },
        messaging_type: 'RESPONSE',
    };

    if (channel === 'instagram') {
        payload.messaging_product = 'instagram';
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
        getLogger(logger).error('[MetaClient] Failed to deliver message', {
            channel,
            recipientId,
            status: response.status,
            error: result.error || null,
            result,
        });
        throw new Error(result?.error?.message || `Graph API responded with status ${response.status}`);
    }

    getLogger(logger).log('[MetaClient] Message delivered', {
        channel,
        recipientId,
        messageId: result?.message_id || null,
    });

    return result;
}

async function resolveSenderProfile(channel, senderId, logger = console) {
    const accessToken = getAccessToken(channel);
    if (!accessToken) {
        return null;
    }

    let fields;
    if (channel === 'instagram') {
        fields = 'username,name';
    } else if (channel === 'messenger') {
        fields = 'name,first_name,last_name';
    } else {
        return null;
    }

    const graphBaseUrl = getGraphBaseUrl();
    const url = `${graphBaseUrl}/${senderId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;

    try {
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();

        if (!response.ok || data.error) {
            getLogger(logger).warn('[MetaClient] Failed to resolve sender profile', {
                channel,
                senderId,
                status: response.status,
                error: data.error || null,
            });
            return null;
        }

        if (channel === 'instagram') {
            const username = data.username || data.name || null;
            return username ? { displayName: username } : null;
        }

        const candidates = [data.name, [data.first_name, data.last_name].filter(Boolean).join(' ')].filter(Boolean);
        const displayName = candidates.length ? candidates[0] : null;
        return displayName ? { displayName } : null;
    } catch (error) {
        getLogger(logger).error('[MetaClient] resolveSenderProfile error', { channel, senderId, error: error.message });
        return null;
    }
}

module.exports = {
    sendMetaMessage,
    resolveSenderProfile,
};
