// File: src/ai/agents/followUpEngine/signalTracker.js
// Jalan REALTIME setiap pesan masuk dari customer.
// Track sinyal: replied after follow up, stop keywords, converted.

const prisma = require('../../../lib/prisma');

const STOP_KEYWORDS = [
    'stop', 'jangan', 'tidak usah', 'ga usam',
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

    try {
        const context = await prisma.customerContext.findUnique({
            where: { id: docId }
        });
        if (!context) return;

        const updates = {};

        // 1. Customer balas setelah di-follow up
        if (context.lastFollowUpAt && !context.repliedAfterFollowup) {
            const lastFollowUp = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
            const lastReply = context.lastCustomerReplyAt ? new Date(context.lastCustomerReplyAt) : null;

            if (!lastReply || (lastFollowUp && lastFollowUp > lastReply)) {
                updates.repliedAfterFollowup = true;
                console.log(`[SignalTracker] ${docId} replied after follow up`);
            }
        }

        // 2. Detect explicit stop request
        const lowerMsg = (messageText || '').toLowerCase();
        const isStopRequest = STOP_KEYWORDS.some(k => lowerMsg.includes(k));
        if (isStopRequest) {
            updates.explicitlyRejected = true;
            updates.followUpStrategy = 'stop';
            console.log(`[SignalTracker] ${docId} explicitly rejected follow up`);
        }

        // 3. Track last customer reply timestamp - use updatedAt instead
        // lastCustomerReplyAt not in schema, using existing fields

        if (Object.keys(updates).length > 0) {
            await prisma.customerContext.update({
                where: { id: docId },
                data: updates
            });
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

    await prisma.customerContext.update({
        where: { id: docId },
        data: {
            followUpConverted: true,
            customerLabel: 'existing',
            followUpStrategy: 'retention',
            labelReason: 'converted after follow up',
            labelScores: {
                labeledBy: 'signal_tracker'
            }
        }
    });

    console.log(`[SignalTracker] ${docId} marked as converted`);
}

module.exports = { updateSignalsOnIncomingMessage, markAsConverted };