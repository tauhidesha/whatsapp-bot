// src/ai/utils/adminMessageSync.js
const prisma = require('../../lib/prisma.js');
const { parseSenderIdentity } = require('../../lib/utils.js');

// Track pesan yang dikirim BOT agar tidak double-save
const BOT_SENT_CACHE = new Map();
const BOT_SENT_TTL = 10000; // 10 detik cukup untuk dedup

function markBotMessage(recipientNumber, text) {
    const key = `${recipientNumber}::${text.substring(0, 50)}`;
    BOT_SENT_CACHE.set(key, Date.now());

    setTimeout(() => {
        BOT_SENT_CACHE.delete(key);
    }, BOT_SENT_TTL);
}

function isBotMessage(recipientNumber, text) {
    const key = `${recipientNumber}::${text.substring(0, 50)}`;
    return BOT_SENT_CACHE.has(key);
}

/**
 * Helper: Save message to SQL (Prisma)
 */
async function saveMessageToPrismaLocal(recipientNumber, messageText, senderType) {
    const { docId: phone } = parseSenderIdentity(recipientNumber);
    if (!phone) return;

    try {
        // Ensure customer exists before creating message (FK constraint)
        const numericPhone = phone.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
        let customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: numericPhone },
                    { phone: phone },
                    { whatsappLid: phone }
                ]
            }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: { phone, name: 'New Customer' }
            });
            console.log(`[AdminSync] Created new customer for ${phone}`);
        }

        await prisma.directMessage.create({
            data: {
                customerId: customer.id,
                senderId: senderType === 'admin' ? 'admin' : 'assistant',
                role: senderType === 'admin' ? 'admin' : 'assistant',
                content: messageText,
                createdAt: new Date()
            }
        });

        await prisma.customer.update({
            where: { id: customer.id },
            data: {
                lastMessage: messageText,
                lastMessageAt: new Date(),
                updatedAt: new Date()
            }
        });

    } catch (error) {
        console.error(`Error saving ${senderType} message to SQL:`, error.message);
    }
}

async function handleAdminHpMessage(msg) {
    if (!msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;

    let messageText = '';
    if (msg.type === 'chat' || msg.type === 'vcard' || msg.type === 'multi_vcard') {
        messageText = msg.body || msg.caption || '';
    } else {
        // For media (image, document, etc), body often contains base64 string.
        messageText = msg.caption || '';
    }
    messageText = messageText.trim();

    // If there's no text (e.g. admin sent an image without caption),
    // we still want to log it and trigger snooze, but we shouldn't save a huge base64 string.
    if (!messageText) {
        if (msg.type && msg.type !== 'chat') {
            messageText = `[Sent a ${msg.type}]`;
        } else {
            return;
        }
    }

    const recipientNumber = msg.to;
    if (!recipientNumber) return;

    if (isBotMessage(recipientNumber, messageText)) {
        console.log(`[AdminSync] Skip bot message to ${recipientNumber}`);
        return;
    }

    try {
        await saveMessageToPrismaLocal(recipientNumber, messageText, 'admin');
        console.log(`[AdminSync] ✅ Synced admin HP message to ${recipientNumber}: "${messageText.substring(0, 50)}"`);

        const { setSnoozeMode, isSnoozeActive } = require('./humanHandover.js');
        const { normalizedAddress } = parseSenderIdentity(recipientNumber);

        const snoozeActive = await isSnoozeActive(normalizedAddress);
        if (!snoozeActive) {
            await setSnoozeMode(normalizedAddress, 60, {
                manual: false,
                reason: 'admin-replied-from-phone',
            });
            console.log(`[AdminSync] Auto-snooze activated for ${recipientNumber} (admin replied from HP)`);
        }

    } catch (error) {
        console.error(`[AdminSync] Error syncing message:`, error.message);
    }
}

module.exports = { handleAdminHpMessage, markBotMessage };
