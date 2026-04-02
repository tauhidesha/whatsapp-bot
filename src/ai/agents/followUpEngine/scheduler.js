// File: src/ai/agents/followUpEngine/scheduler.js
// Daily cron job: label downgrade, eligibility check, generate & send follow-up messages.

const prisma = require('../../../lib/prisma');
const { generateFollowUpMessage, getDaysSince } = require('./messageGenerator.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');
const { markBotMessage } = require('../../utils/adminMessageSync.js');

// ─── Helper: Save message to Prisma ────────────────────────────────────────

async function saveMessageToPrisma(senderNumber, message, senderType) {
    const docId = (senderNumber || '').replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
    if (!docId) return;

    const customer = await prisma.customer.findUnique({ where: { phone: docId } });
    if (!customer) return;

    await prisma.directMessage.create({
        data: {
            customerId: customer.id,
            senderId: senderNumber,
            role: senderType === 'user' ? 'user' : (senderType === 'ai' ? 'assistant' : 'admin'),
            content: message,
        }
    });

    await prisma.customer.update({
        where: { id: customer.id },
        data: {
            lastMessage: message,
            lastMessageAt: new Date(),
        }
    });
}

const { STRATEGY_CONFIG } = require('./config.js');

// ─── Downgrade Rules ─────────────────────────────────────────────────────────

const DOWNGRADE_RULES = [
    {
        from: 'hot_lead',
        to: 'warm_lead',
        condition: (ctx, meta) =>
            getDaysSince(meta.lastMessageAt) > 7 && (ctx.txCount || 0) === 0,
        reason: 'hot_lead tidak reply > 7 hari',
    },
    {
        from: 'warm_lead',
        to: 'window_shopper',
        condition: (ctx, meta) =>
            (ctx.ghostedTimes || 0) >= 1 &&
            getDaysSince(meta.lastMessageAt) > 14,
        reason: 'warm_lead ghosted > 14 hari',
    },
    {
        from: 'existing_customer',
        to: 'churned',
        condition: (ctx) => getDaysSince(ctx.lastTransactionAt) > 90,
        reason: 'existing_customer tidak balik > 90 hari',
    },
];

// ─── Eligibility Check ──────────────────────────────────────────────────────

function isEligible(context, metadata) {
    const label = context.customerLabel;
    const strategy = STRATEGY_CONFIG[label];
    if (!strategy || strategy.action === 'stop') return false;

    const lastFollowUp = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
    const lastMessage = metadata?.lastMessageAt ? new Date(metadata.lastMessageAt) : null;
    const now = new Date();

    // Must have messaged before
    if (!lastMessage) return false;

    // Check wait days
    if (lastFollowUp) {
        const daysSinceLastFollowUp = Math.floor((now - lastFollowUp) / (1000 * 60 * 60 * 24));
        if (daysSinceLastFollowUp < strategy.waitDays) return false;
    }

    // Check max follow-ups
    const followUpCount = context.followUpCount || 0;
    if (followUpCount >= strategy.maxFollowUps) return false;

    return true;
}

// ─── Delay Helper ────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Daily Run ──────────────────────────────────────────────────────────

async function runDailyFollowUp() {
    console.log('[Scheduler] Starting daily follow up run...');

    // 1. Scan semua customerContext dari Prisma
    const contexts = await prisma.customerContext.findMany({
        where: {
            customerLabel: { not: null }
        },
        include: {
            customer: true
        }
    });

    const queue = [];
    let downgradeCount = 0;

    for (const context of contexts) {
        const docId = context.id;
        const customer = context.customer;

        // Skip yang belum punya label
        if (!context.customerLabel) continue;

        // Skip jika tidak ada customer
        if (!customer) continue;

        // Ambil metadata dari customer
        const metadata = {
            lastMessageAt: customer.lastMessageAt,
            name: customer.name,
            fullSenderId: customer.phone.includes('@') ? customer.phone : customer.phone + '@c.us'
        };

        // 2. Label downgrade check
        for (const rule of DOWNGRADE_RULES) {
            if (context.customerLabel === rule.from && rule.condition(context, metadata)) {
                await prisma.customerContext.update({
                    where: { id: docId },
                    data: {
                        customerLabel: rule.to,
                        labelReason: rule.reason,
                        labelScores: {
                            ...(context.labelScores || {}),
                            previousLabel: rule.from,
                            labeledBy: 'scheduler_downgrade'
                        }
                    }
                });
                context.customerLabel = rule.to;
                downgradeCount++;
                console.log(`[Scheduler] Downgrade ${docId}: ${rule.from} → ${rule.to}`);
                break;
            }
        }

        // 3. Eligibility check
        if (!isEligible(context, metadata)) continue;

        queue.push({
            docId,
            senderNumber: customer.phone.includes('@') ? customer.phone : customer.phone + '@c.us',
            name: customer.name || 'Mas',
            context,
            metadata,
            strategy: STRATEGY_CONFIG[context.customerLabel],
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
            await delay(30000);
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
        await handleStopAction(docId, stopResult, context.customerLabel);
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

    markBotMessage(senderNumber, message);
    await global.whatsappClient.sendText(senderNumber, message);
    console.log(`[Scheduler] ✅ Sent to ${docId}: "${message.substring(0, 50)}..."`);

    // Update signals setelah kirim
    await prisma.customerContext.update({
        where: { id: docId },
        data: {
            followUpCount: (context.followUpCount || 0) + 1,
            lastFollowUpAt: new Date(),
            lastFollowUpStrategy: strategy.angle,
            // repliedAfterFollowup: false // Reset, tunggu reply baru
        }
    });

    // Simpan ke Prisma
    await saveMessageToPrisma(senderNumber, message, 'ai');
}

// ─── Cron Scheduler ──────────────────────────────────────────────────────────

let schedulerHandle = null;
let lastDailyRunDate = null; // Track last run date

function startFollowUpScheduler() {
    if (schedulerHandle) return;

    // Cek setiap 15 menit
    const intervalMs = 15 * 60 * 1000;

    schedulerHandle = setInterval(async () => {
        const now = new Date();
        const hour = now.getHours();
        const todayStr = now.toISOString().split('T')[0];

        // Run daily hanya jam 9 pagi (Local Server Time)
        // Dan pastikan belum pernah jalan hari ini
        if (hour === 9 && lastDailyRunDate !== todayStr) {
            try {
                console.log(`[Scheduler] Starting daily follow up at ${now.toISOString()} (Hour: ${hour})`);
                await runDailyFollowUp();
                lastDailyRunDate = todayStr; // Tandai sudah jalan
            } catch (err) {
                console.error('[Scheduler] Daily run failed:', err);
            }
        }
    }, intervalMs);

    console.log('[Scheduler] Follow-up scheduler started (15 min interval, 9am daily run)');
}

function stopFollowUpScheduler() {
    if (schedulerHandle) {
        clearInterval(schedulerHandle);
        schedulerHandle = null;
        console.log('[Scheduler] Follow-up scheduler stopped');
    }
}

function isSchedulerRunning() {
    return schedulerHandle !== null;
}

module.exports = {
    runDailyFollowUp,
    startFollowUpScheduler,
    stopFollowUpScheduler,
    isSchedulerRunning,
};