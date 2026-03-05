// File: src/ai/agents/followUpEngine/scheduler.js
// Daily cron job: label downgrade, eligibility check, generate & send follow-up messages.

const admin = require('firebase-admin');
const { generateFollowUpMessage, getDaysSince } = require('./messageGenerator.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');
const { saveMessageToFirestore } = require('../../utils/firestoreUtils.js');

// ─── Strategy Config ─────────────────────────────────────────────────────────

const STRATEGY_CONFIG = {
    hot_lead: {
        action: 'follow_up',
        waitDays: 1,
        intervalDays: 3,
        maxFollowUps: 2,
        angle: 'urgency',
    },
    warm_lead: {
        action: 'follow_up',
        waitDays: 2,
        intervalDays: 7,
        maxFollowUps: 2,
        angle: 'value',
    },
    window_shopper: {
        action: 'follow_up',
        waitDays: 7,
        intervalDays: 14,
        maxFollowUps: 1,
        angle: 'promo', // Hanya kalau ada promo aktif
    },
    existing: {
        action: 'follow_up',
        waitDays: 45,
        intervalDays: 30,
        maxFollowUps: 3,
        angle: 'maintenance',
    },
    loyal: {
        action: 'follow_up',
        waitDays: 60,
        intervalDays: 30,
        maxFollowUps: 2,
        angle: 'exclusive',
    },
    churned: {
        action: 'follow_up',
        waitDays: 0,
        intervalDays: 30,
        maxFollowUps: 2,
        angle: 'winback',
    },
    dormant_lead: { action: 'stop' },
};

// ─── Downgrade Rules ─────────────────────────────────────────────────────────

const DOWNGRADE_RULES = [
    {
        from: 'hot_lead',
        to: 'warm_lead',
        condition: (ctx, meta) =>
            getDaysSince(meta.lastMessageAt) > 7 && (ctx.tx_count || 0) === 0,
        reason: 'hot_lead tidak reply > 7 hari',
    },
    {
        from: 'warm_lead',
        to: 'window_shopper',
        condition: (ctx, meta) =>
            (ctx.ghosted_times || 0) >= 1 &&
            getDaysSince(meta.lastMessageAt) > 14,
        reason: 'warm_lead ghosted > 14 hari',
    },
    {
        from: 'existing',
        to: 'churned',
        condition: (ctx) => getDaysSince(ctx.last_transaction_at) > 90,
        reason: 'existing tidak balik > 90 hari',
    },
    {
        from: 'loyal',
        to: 'churned',
        condition: (ctx) => getDaysSince(ctx.last_transaction_at) > 180,
        reason: 'loyal tidak balik > 180 hari',
    },
];

// ─── Eligibility Check ──────────────────────────────────────────────────────

function isEligible(context, metadata) {
    const label = context.customer_label;
    const strategy = STRATEGY_CONFIG[label];

    if (!strategy || strategy.action === 'stop') return false;
    if (context.explicitly_rejected) return false;
    if (context.blocked) return false;
    if (context.followup_converted) return false;

    const followupCount = context.followup_count || 0;
    if (followupCount >= strategy.maxFollowUps) return false;

    const daysSinceLastChat = getDaysSince(metadata.lastMessageAt);
    const daysSinceLastFollowUp = getDaysSince(context.last_followup_at);

    if (daysSinceLastChat === null || daysSinceLastChat < strategy.waitDays) return false;
    if (daysSinceLastFollowUp !== null && daysSinceLastFollowUp < strategy.intervalDays) return false;

    return true;
}

// ─── Delay Helper ────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Daily Run ──────────────────────────────────────────────────────────

async function runDailyFollowUp() {
    const db = admin.firestore();
    console.log('[Scheduler] Starting daily follow up run...');

    // 1. Scan semua customerContext
    const snapshot = await db.collection('customerContext').get();
    const queue = [];
    let downgradeCount = 0;

    for (const doc of snapshot.docs) {
        const context = doc.data();
        const docId = doc.id;

        // Skip yang belum punya label
        if (!context.customer_label) continue;

        // Ambil metadata dari directMessages
        const metaDoc = await db.collection('directMessages').doc(docId).get();
        if (!metaDoc.exists) continue;
        const metadata = metaDoc.data();

        // 2. Label downgrade check
        for (const rule of DOWNGRADE_RULES) {
            if (context.customer_label === rule.from && rule.condition(context, metadata)) {
                await doc.ref.update({
                    customer_label: rule.to,
                    previous_label: rule.from,
                    label_reason: rule.reason,
                    labeled_by: 'scheduler_downgrade',
                    label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
                context.customer_label = rule.to; // Update local copy
                downgradeCount++;
                console.log(`[Scheduler] Downgrade ${docId}: ${rule.from} → ${rule.to}`);
                break;
            }
        }

        // 3. Eligibility check
        if (!isEligible(context, metadata)) continue;

        queue.push({
            docId,
            senderNumber: metadata.fullSenderId || `${docId}@c.us`,
            name: metadata.name || 'Mas',
            context,
            metadata,
            strategy: STRATEGY_CONFIG[context.customer_label],
        });
    }

    console.log(`[Scheduler] Downgrades: ${downgradeCount}, Queue: ${queue.length} eligible`);

    if (queue.length === 0) {
        console.log('[Scheduler] No eligible customers today');
        return { sent: 0, skipped: 0, errors: 0, downgrades: downgradeCount };
    }

    // 4. Process queue — staggered, 30 detik antar customer
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < queue.length; i++) {
        const customer = queue[i];

        try {
            await processFollowUp(customer);
            sent++;
        } catch (err) {
            console.error(`[Scheduler] Error processing ${customer.docId}:`, err.message);
            errors++;
        }

        // Stagger delay
        if (i < queue.length - 1) {
            await delay(30000); // 30 detik antar customer
        }
    }

    console.log(`[Scheduler] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}`);
    return { sent, skipped, errors, downgrades: downgradeCount };
}

async function processFollowUp(customer) {
    const { docId, senderNumber, context, strategy } = customer;

    // Check stop conditions
    const stopResult = shouldStop(context);
    if (stopResult.stop) {
        await handleStopAction(docId, stopResult, context.customer_label);
        console.log(`[Scheduler] Stopped ${docId}: ${stopResult.reason}`);
        return;
    }

    // Generate pesan
    const message = await generateFollowUpMessage(customer, strategy);

    // Null = tidak ada promo, skip window_shopper
    if (!message) {
        console.log(`[Scheduler] Skip ${docId}: no message generated`);
        return;
    }

    // Kirim via WhatsApp
    if (!global.whatsappClient) {
        console.warn('[Scheduler] WhatsApp client not available, skipping send');
        return;
    }

    await global.whatsappClient.sendText(senderNumber, message);
    console.log(`[Scheduler] ✅ Sent to ${docId}: "${message.substring(0, 50)}..."`);

    // Update signals setelah kirim
    const db = admin.firestore();
    await db.collection('customerContext').doc(docId).update({
        followup_count: admin.firestore.FieldValue.increment(1),
        last_followup_at: admin.firestore.FieldValue.serverTimestamp(),
        last_followup_strategy: strategy.angle,
        replied_after_followup: false, // Reset, tunggu reply baru
    });

    // Simpan ke directMessages
    await saveMessageToFirestore(senderNumber, message, 'ai');
}

// ─── Cron Scheduler ──────────────────────────────────────────────────────────

let schedulerHandle = null;

function startFollowUpScheduler() {
    if (schedulerHandle) return;

    // Cek setiap 15 menit
    const intervalMs = 15 * 60 * 1000;

    schedulerHandle = setInterval(async () => {
        const now = new Date();
        // UTC+7: jam 09:00 WIB = 02:00 UTC
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Hanya jalankan antara 02:00-02:14 UTC (09:00-09:14 WIB)
        if (utcHour !== 2 || utcMinute >= 15) return;

        // Skip Minggu
        const day = now.getDay();
        if (day === 0) {
            console.log('[Scheduler] Skip Sunday');
            return;
        }

        try {
            await runDailyFollowUp();
        } catch (error) {
            console.error('[Scheduler] Error in daily run:', error);
        }
    }, intervalMs);

    console.log('✅ [FollowUp Scheduler] Started (daily 09:00 WIB, skip Sunday)');
}

function stopFollowUpScheduler() {
    if (schedulerHandle) {
        clearInterval(schedulerHandle);
        schedulerHandle = null;
        console.log('[Scheduler] Stopped');
    }
}

module.exports = {
    startFollowUpScheduler,
    stopFollowUpScheduler,
    runDailyFollowUp,
    // Exported for testing & stopCondition
    STRATEGY_CONFIG,
    DOWNGRADE_RULES,
    isEligible,
    getDaysSince,
};
