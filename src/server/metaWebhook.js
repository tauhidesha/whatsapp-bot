const express = require('express');
const fetch = require('node-fetch');

function createMetaWebhookRouter(deps = {}) {
    const {
        getAIResponse,
        saveMessageToFirestore,
        saveSenderMeta,
        logger = console,
        messengerAccessToken = process.env.META_MESSENGER_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN,
        instagramAccessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN || process.env.META_IG_ACCESS_TOKEN,
        instagramBusinessId = process.env.META_INSTAGRAM_BUSINESS_ID || process.env.META_IG_BUSINESS_ID,
        graphAPIBaseUrl = process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com/v19.0',
    } = deps;

    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

    const router = express.Router();

    function log(message, ...args) {
        if (!logger || typeof logger.log !== 'function') {
            return;
        }
        logger.log(`[MetaWebhook] ${message}`, ...args);
    }

    router.get('/', (req, res) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                log('Webhook verified');
                return res.status(200).send(challenge);
            }
            log('Webhook verification failed: invalid token or mode', { mode, tokenMatches: token === VERIFY_TOKEN });
            return res.sendStatus(403);
        }

        log('Webhook verification failed: missing parameters');
        return res.sendStatus(400);
    });

    router.post('/', async (req, res) => {
        const body = req.body;

        if (!body || !body.object) {
            log('Received invalid payload', body);
            return res.sendStatus(400);
        }

        const entries = Array.isArray(body.entry) ? body.entry : [];
        const objectType = body.object;

        await Promise.all(entries.map((entry) => handleEntry(entry, objectType)));

        return res.sendStatus(200);
    });

    async function handleEntry(entry, objectType) {
        const channel = objectType === 'instagram' ? 'instagram' : 'messenger';
        const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];

        if (!messagingEvents.length) {
            log('Entry without messaging events ignored');
            return;
        }

        for (const event of messagingEvents) {
            try {
                if (event.message) {
                    await handleMessageEvent(channel, event);
                } else {
                    log('Unhandled event type', { channel, keys: Object.keys(event || {}) });
                }
            } catch (error) {
                log(`Error handling ${channel} event`, error);
            }
        }
    }

    async function handleMessageEvent(channel, event) {
        const senderId = event?.sender?.id;
        const recipientId = event?.recipient?.id;

        if (!senderId) {
            log('Message without sender id ignored', { channel, recipientId });
            return;
        }

        const message = event.message;
        if (!message || message.is_echo) {
            log('Echo or empty message ignored', { channel, senderId, isEcho: message?.is_echo });
            return;
        }

        const text = typeof message.text === 'string' ? message.text.trim() : '';
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];

        if (!text && attachments.length === 0) {
            log('Message without text or attachments ignored', { channel, senderId });
            return;
        }

        const normalizedSenderId = `${channel}:${senderId}`;
        let displayName = event?.sender?.name || event?.sender?.username || normalizedSenderId;

        if (displayName === normalizedSenderId) {
            const resolvedProfile = await resolveSenderProfile(channel, senderId);
            if (resolvedProfile?.displayName) {
                displayName = resolvedProfile.displayName;
            }
        }

        if (typeof saveSenderMeta === 'function') {
            try {
                await saveSenderMeta(normalizedSenderId, displayName);
            } catch (error) {
                log('Failed to persist sender metadata', error);
            }
        }

        if (text && typeof saveMessageToFirestore === 'function') {
            try {
                await saveMessageToFirestore(normalizedSenderId, text, 'user');
            } catch (error) {
                log('Failed to persist inbound message', error);
            }
        }

        if (text && typeof getAIResponse === 'function') {
            try {
                const aiResponse = await getAIResponse(text, displayName, normalizedSenderId);
                log('AI response ready for outbound delivery', { channel, senderId });
                await sendMetaMessage(channel, senderId, aiResponse);

                if (typeof saveMessageToFirestore === 'function' && aiResponse) {
                    try {
                        await saveMessageToFirestore(normalizedSenderId, aiResponse, 'ai');
                    } catch (error) {
                        log('Failed to persist AI response', error);
                    }
                }
            } catch (error) {
                log('Failed generating AI response', error);
            }
        } else if (!text) {
            log('Attachments received without text. TODO: handle media payloads', { channel, senderId, attachmentCount: attachments.length });
        }
    }

    async function sendMetaMessage(channel, senderId, text) {
        const trimmed = (text || '').trim();
        if (!trimmed) {
            log('Skipping empty AI response', { channel, senderId });
            return;
        }

        const accessToken = channel === 'instagram' ? instagramAccessToken : messengerAccessToken;
        if (!accessToken) {
            log('Access token not configured for channel', { channel });
            return;
        }

        try {
            const basePath = channel === 'instagram'
                ? (instagramBusinessId || 'me')
                : 'me';

            if (channel === 'instagram' && !instagramBusinessId) {
                log('Instagram business ID not configured; attempting fallback to /me/messages', { channel });
            }

            const url = `${graphAPIBaseUrl.replace(/\/$/, '')}/${basePath}/messages?access_token=${encodeURIComponent(accessToken)}`;
            const payload = {
                recipient: { id: senderId },
                message: { text: trimmed },
                messaging_type: 'RESPONSE',
            };

            if (channel === 'instagram') {
                payload.messaging_product = 'instagram';
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                log('Failed to deliver AI response via Graph API', {
                    channel,
                    senderId,
                    status: response.status,
                    error: result.error || null,
                });
                return;
            }

            log('AI response delivered', { channel, senderId, messageId: result?.message_id || null });
        } catch (error) {
            log('Graph API call failed', { channel, senderId, error: error.message });
        }
    }

    async function resolveSenderProfile(channel, senderId) {
        const accessToken = channel === 'instagram' ? instagramAccessToken : messengerAccessToken;
        if (!accessToken) {
            return null;
        }

        try {
            let fields;
            if (channel === 'instagram') {
                fields = 'username,name';
            } else if (channel === 'messenger') {
                fields = 'name,first_name,last_name';
            } else {
                return null;
            }

            const url = `${graphAPIBaseUrl.replace(/\/$/, '')}/${senderId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
            const response = await fetch(url, { method: 'GET' });
            const data = await response.json();

            if (!response.ok || data.error) {
                log('Failed resolving sender profile', {
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
            log('Error resolving sender profile', { channel, senderId, error: error.message });
            return null;
        }
    }

    return router;
}

module.exports = {
    createMetaWebhookRouter,
};
