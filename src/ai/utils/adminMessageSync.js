// src/ai/utils/adminMessageSync.js

const admin = require('firebase-admin');
const { parseSenderIdentity } = require('../../lib/utils.js');

// Track pesan yang dikirim BOT agar tidak double-save
// Key: message body + recipient + timestamp (approx)
// Tidak pakai msg.id karena bot tidak selalu dapat ID sebelum kirim
const BOT_SENT_CACHE = new Map();
const BOT_SENT_TTL = 10000; // 10 detik cukup untuk dedup

/**
 * Dipanggil SEBELUM client.sendText() di processBufferedMessages
 * agar onAnyMessage tahu pesan ini dari bot, bukan dari HP admin
 */
function markBotMessage(recipientNumber, text) {
    const key = `${recipientNumber}::${text.substring(0, 50)}`;
    BOT_SENT_CACHE.set(key, Date.now());

    // Auto cleanup setelah TTL
    setTimeout(() => {
        BOT_SENT_CACHE.delete(key);
    }, BOT_SENT_TTL);
}

function isBotMessage(recipientNumber, text) {
    const key = `${recipientNumber}::${text.substring(0, 50)}`;
    return BOT_SENT_CACHE.has(key);
}

/**
 * Helper: Save message to Firestore (reused logic from app.js)
 */
async function saveMessageToFirestoreLocal(recipientNumber, messageText, senderType) {
    const { docId } = parseSenderIdentity(recipientNumber);
    if (!docId) return;

    try {
        const db = admin.firestore();
        const messagesRef = db.collection('directMessages').doc(docId).collection('messages');

        await messagesRef.add({
            text: messageText,
            sender: senderType,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            syncedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('directMessages').doc(docId).set({
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageText: messageText,
            lastMessageSender: senderType
        }, { merge: true });

    } catch (error) {
        console.error(`Error saving ${senderType} message to Firestore:`, error);
    }
}

/**
 * Handler untuk onAnyMessage
 * Dipanggil untuk setiap pesan — filter fromMe di dalam
 */
async function handleAdminHpMessage(msg) {
    // Hanya proses pesan yang dikirim dari HP (fromMe)
    if (!msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;

    // Teks saja — skip media tanpa caption
    const messageText = (msg.body || msg.caption || '').trim();
    if (!messageText) return;

    // msg.to = nomor customer yang dikirimi admin
    const recipientNumber = msg.to;
    if (!recipientNumber) return;

    // Skip pesan dari bot sendiri
    if (isBotMessage(recipientNumber, messageText)) {
        console.log(`[AdminSync] Skip bot message to ${recipientNumber}`);
        return;
    }

    try {
        // Simpan ke Firestore sebagai 'admin'
        await saveMessageToFirestoreLocal(recipientNumber, messageText, 'admin');
        console.log(`[AdminSync] ✅ Synced admin HP message to ${recipientNumber}: "${messageText.substring(0, 50)}"`);

        // Update snooze — kalau admin balas dari HP, aktifkan snooze
        // agar AI tidak ikut balas di conversation yang sama
        const { setSnoozeMode, isSnoozeActive } = require('./humanHandover.js');
        const { normalizedAddress } = parseSenderIdentity(recipientNumber);

        const snoozeActive = await isSnoozeActive(normalizedAddress);
        if (!snoozeActive) {
            // Admin balas manual → snooze AI selama 60 menit
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
