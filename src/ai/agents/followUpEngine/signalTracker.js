// File: src/ai/agents/followUpEngine/signalTracker.js
// Jalan REALTIME setiap pesan masuk dari customer.
// Track sinyal: replied after follow up, stop keywords, converted.

const admin = require('firebase-admin');

const STOP_KEYWORDS = [
    'stop', 'jangan', 'tidak usah', 'ga usah',
    'hapus', 'unsubscribe', 'berhenti', 'ganggu',
    'spam', 'blokir',
];

/**
 * Update signals saat customer kirim pesan.
 * Fire & forget — tidak blocking reply.
 */
async function updateSignalsOnIncomingMessage(senderNumber, messageText) {
    const docId = (senderNumber || '').replace(/[^0-9]/g, '');
    if (!docId) return;

    const db = admin.firestore();
    const ref = db.collection('customerContext').doc(docId);

    try {
        const doc = await ref.get();
        if (!doc.exists) return;

        const context = doc.data();
        const updates = {};

        // 1. Customer balas setelah di-follow up
        if (context.last_followup_at && !context.replied_after_followup) {
            const lastFollowUp = context.last_followup_at?.toDate?.()
                || (context.last_followup_at ? new Date(context.last_followup_at) : null);
            const lastReply = context.last_customer_reply_at?.toDate?.()
                || (context.last_customer_reply_at ? new Date(context.last_customer_reply_at) : null);

            if (!lastReply || (lastFollowUp && lastFollowUp > lastReply)) {
                updates.replied_after_followup = true;
                updates.followup_reply_at = admin.firestore.FieldValue.serverTimestamp();
                console.log(`[SignalTracker] ${docId} replied after follow up`);
            }
        }

        // 2. Detect explicit stop request
        const lowerMsg = (messageText || '').toLowerCase();
        const isStopRequest = STOP_KEYWORDS.some(k => lowerMsg.includes(k));
        if (isStopRequest) {
            updates.explicitly_rejected = true;
            updates.follow_up_strategy = 'stop';
            updates.rejected_at = admin.firestore.FieldValue.serverTimestamp();
            console.log(`[SignalTracker] ${docId} explicitly rejected follow up`);
        }

        // 3. Track last customer reply timestamp
        updates.last_customer_reply_at = admin.firestore.FieldValue.serverTimestamp();

        if (Object.keys(updates).length > 0) {
            await ref.update(updates);
        }
    } catch (error) {
        console.warn('[SignalTracker] Error:', error.message);
    }
}

/**
 * Mark customer as converted (booking/bayar setelah follow up).
 */
async function markAsConverted(senderNumber) {
    const docId = (senderNumber || '').replace(/[^0-9]/g, '');
    if (!docId) return;

    const db = admin.firestore();
    await db.collection('customerContext').doc(docId).update({
        followup_converted: true,
        converted_at: admin.firestore.FieldValue.serverTimestamp(),
        customer_label: 'existing',
        follow_up_strategy: 'retention',
        label_reason: 'converted after follow up',
        labeled_by: 'signal_tracker',
        label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[SignalTracker] ${docId} marked as converted`);
}

module.exports = { updateSignalsOnIncomingMessage, markAsConverted };
