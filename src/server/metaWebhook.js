const express = require('express');
const { sendMetaMessage, resolveSenderProfile } = require('./metaClient.js');

const PROCESSED_MESSAGE_RETENTION_MS = 10 * 60 * 1000; // 10 minutes
const processedMetaMessageIds = new Map();

function registerProcessedMessage(messageId) {
    if (!messageId) {
        return true;
    }

    const now = Date.now();
    const lastSeen = processedMetaMessageIds.get(messageId);

    if (lastSeen && (now - lastSeen) < PROCESSED_MESSAGE_RETENTION_MS) {
        return false;
    }

    processedMetaMessageIds.set(messageId, now);

    if (processedMetaMessageIds.size > 5000) {
        const cutoff = now - PROCESSED_MESSAGE_RETENTION_MS;
        for (const [id, ts] of processedMetaMessageIds.entries()) {
            if (ts < cutoff) {
                processedMetaMessageIds.delete(id);
            }
        }
    }

    return true;
}

function createMetaWebhookRouter(deps = {}) {
    const {
        getAIResponse,
        saveMessageToFirestore,
        saveSenderMeta,
        logger = console,
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

        const messageId = message?.mid || message?.id || null;
        if (messageId && !registerProcessedMessage(messageId)) {
            log('Duplicate message ignored', { channel, senderId, messageId });
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
            const resolvedProfile = await resolveSenderProfile(channel, senderId, logger);
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
                await sendMetaMessage(channel, senderId, aiResponse, logger);

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

    return router;
}

module.exports = {
    createMetaWebhookRouter,
};
