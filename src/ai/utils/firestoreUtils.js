// File: src/ai/utils/firestoreUtils.js
// Shared Firestore utility functions, extracted from app.js for cross-module usage.

const admin = require('firebase-admin');
const { parseSenderIdentity } = require('../../lib/utils.js');

/**
 * Save a message to Firestore directMessages collection.
 * @param {string} senderNumber - Raw sender number
 * @param {string} message - Message text
 * @param {string} senderType - 'user', 'ai', or 'admin'
 */
async function saveMessageToFirestore(senderNumber, message, senderType) {
    const db = admin.firestore();
    if (!db) return;

    const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    try {
        const messagesRef = db.collection('directMessages').doc(docId).collection('messages');
        const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

        await messagesRef.add({
            text: message,
            timestamp: serverTimestamp,
            sender: senderType,
        });

        await db.collection('directMessages').doc(docId).set({
            lastMessage: message,
            lastMessageSender: senderType,
            lastMessageAt: serverTimestamp,
            updatedAt: serverTimestamp,
            messageCount: admin.firestore.FieldValue.increment(1),
            channel,
            platform: channel,
            platformId: platformId || docId,
            fullSenderId: senderNumber,
        }, { merge: true });
    } catch (error) {
        console.error('Error saving to Firestore:', error);
    }
}

module.exports = { saveMessageToFirestore };
