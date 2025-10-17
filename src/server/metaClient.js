const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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

async function sendMetaAttachment(channel, recipientId, filePath, options = {}, logger = console) {
    const effectiveChannel = (channel || '').toLowerCase();
    const log = getLogger(logger);

    if (!effectiveChannel) {
        throw new Error('Channel is required to deliver attachments');
    }

    if (!recipientId) {
        throw new Error(`Recipient ID is required to deliver ${effectiveChannel} attachments`);
    }

    if (!filePath) {
        throw new Error('File path is required to deliver attachments');
    }

    const resolvedPath = path.resolve(filePath);

    try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch (error) {
        throw new Error(`Attachment file not accessible: ${resolvedPath}`);
    }

    const accessToken = getAccessToken(effectiveChannel);
    if (!accessToken) {
        log.warn('[MetaClient] Missing access token', { channel: effectiveChannel });
        throw new Error(`Access token for ${effectiveChannel} not configured`);
    }

    const graphBaseUrl = getGraphBaseUrl();
    const instagramBusinessId = getInstagramBusinessId();

    const basePath = effectiveChannel === 'instagram'
        ? (instagramBusinessId || 'me')
        : 'me';

    if (effectiveChannel === 'instagram' && !instagramBusinessId) {
        log.warn('[MetaClient] Instagram business ID not configured; using /me/messages fallback');
    }

    const url = `${graphBaseUrl}/${basePath}/messages?access_token=${encodeURIComponent(accessToken)}`;
    const form = new FormData();

    form.append('recipient', JSON.stringify({ id: recipientId }));
    form.append('messaging_type', options.messagingType || 'RESPONSE');

    if (effectiveChannel === 'instagram') {
        form.append('messaging_product', 'instagram');
    }

    const attachmentPayload = {
        ...(options.payload || {}),
    };

    if (options.isReusable) {
        attachmentPayload.is_reusable = true;
    }

    const message = {
        attachment: {
            type: options.type || 'image',
            payload: attachmentPayload,
        },
    };

    form.append('message', JSON.stringify(message));

    const filename = options.filename || path.basename(resolvedPath);
    form.append('filedata', fs.createReadStream(resolvedPath), {
        filename,
        contentType: options.mimetype || 'image/jpeg',
    });

    const headers = form.getHeaders();
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
    });

    let result;
    try {
        result = await response.json();
    } catch (error) {
        log.error('[MetaClient] Failed to parse attachment response', {
            channel: effectiveChannel,
            recipientId,
            error: error.message,
        });
        throw new Error('Failed to parse attachment response from Graph API');
    }

    if (!response.ok || result.error) {
        log.error('[MetaClient] Failed to deliver attachment', {
            channel: effectiveChannel,
            recipientId,
            status: response.status,
            error: result.error || null,
            result,
        });
        throw new Error(result?.error?.message || `Graph API responded with status ${response.status}`);
    }

    log.log('[MetaClient] Attachment delivered', {
        channel: effectiveChannel,
        recipientId,
        attachmentId: result?.attachment_id || null,
        messageId: result?.message_id || null,
    });

    const caption = typeof options.caption === 'string' ? options.caption.trim() : '';
    if (caption) {
        try {
            await sendMetaMessage(effectiveChannel, recipientId, caption, logger);
        } catch (error) {
            log.warn('[MetaClient] Attachment delivered but caption delivery failed', {
                channel: effectiveChannel,
                recipientId,
                error: error.message,
            });
            return {
                ...result,
                captionDeliveryFailed: true,
            };
        }
    }

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

async function acceptInstagramMessageRequest(participantId, logger = console) {
    const log = getLogger(logger);
    const normalizedParticipant = (participantId || '').trim();
    if (!normalizedParticipant) {
        log.warn('[MetaClient] Cannot accept request: participantId empty');
        return { skipped: true };
    }

    const accessToken = getInstagramAccessToken();
    if (!accessToken) {
        log.warn('[MetaClient] Cannot accept request: missing Instagram access token');
        return { skipped: true };
    }

    const instagramBusinessId = getInstagramBusinessId();
    if (!instagramBusinessId) {
        log.warn('[MetaClient] Cannot accept request: missing Instagram business ID');
        return { skipped: true };
    }

    const graphBaseUrl = getGraphBaseUrl();
    const url = `${graphBaseUrl}/${instagramBusinessId}/message_requests`;

    const payload = {
        messaging_product: 'instagram',
        participant_id: normalizedParticipant,
        status: 'APPROVED',
    };

    try {
        const response = await fetch(`${url}?access_token=${encodeURIComponent(accessToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        let result = null;
        try {
            result = await response.json();
        } catch (parseError) {
            log.warn('[MetaClient] Failed parsing message request response', { error: parseError.message });
        }

        if (!response.ok || result?.error) {
            log.warn('[MetaClient] Failed approving message request', {
                participantId: normalizedParticipant,
                status: response.status,
                error: result?.error || null,
            });
            return { error: result?.error || response.statusText };
        }

        log.log('[MetaClient] Message request approved', {
            participantId: normalizedParticipant,
            result,
        });

        return result;
    } catch (error) {
        log.error('[MetaClient] acceptInstagramMessageRequest error', {
            participantId: normalizedParticipant,
            error: error.message,
        });
        return { error: error.message };
    }
}

module.exports = {
    sendMetaMessage,
    sendMetaAttachment,
    acceptInstagramMessageRequest,
    resolveSenderProfile,
};
