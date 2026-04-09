// File: src/ai/agents/followUpEngine/scheduler.js
// Daily cron job: label downgrade, eligibility check, generate & send follow-up messages.

const prisma = require('../../../lib/prisma');
const { generateFollowUpMessage, getDaysSince } = require('./messageGenerator.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');
const { markBotMessage } = require('../../utils/adminMessageSync.js');
const { getActivePromo } = require('../../utils/promoConfig');
const { withRetry } = require('../../utils/retry');
const { sendTextDirect } = require('../../utils/whatsappHelper');

// ─── Helper: Save message to Prisma ────────────────────────────────────────

async function saveMessageToPrisma(senderNumber, message, senderType) {
    if (!senderNumber || !message) return;

    // Fix: Use findFirst with OR to support both @c.us (digits) and @lid
    const cleanPhone = (senderNumber || '').replace(/@c\.us$|@lid$/, '');
    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { phone: cleanPhone },
                { phone: senderNumber },
                { whatsappLid: senderNumber },
            ]
        }
    });

    if (!customer) {
        console.warn(`[Scheduler] saveMessageToPrisma: customer not found for ${senderNumber}`);
        return;
    }

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

// ─── Rebooking Rules ───────────────────────────────────────────────────────

const REBOOKING_INTERVALS = {
    detailing: 30,  // 1 month
    repaint: 90,  // 3 months
    coating: 180, // 6 months
};

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

async function runDailyFollowUp(dryRun = false, limit = null) {
    const now = new Date(); // Definisi di paling atas scope function
    console.log(`[Scheduler] Running daily follow-up check... (dryRun=${dryRun})`);

    // ── DRY RUN: return preview queue without sending ─────────────────────────
    // NOTE: reminders (coating/booking) are NOT included here; they are fetched
    // separately by the queue-review endpoint via their own dryRun=true calls.
    if (dryRun) {
        return await _buildDryRunQueue(now, limit);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Scan semua customerContext dari Prisma
    const contexts = await prisma.customerContext.findMany({
        where: {
            customerLabel: { not: null }
        },
        include: {
            customer: {
                include: {
                    bookings: {
                        where: {
                            status: { notIn: ['DONE', 'CANCELLED'] }
                        }
                    }
                }
            }
        }
    });

    // 2. Identify eligible customers
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

        // 3. Eligibility checks
        const isNurtureEligible = isEligible(context, metadata);

        // 4. Review eligibility (Post-Service 3 Days)
        let isReviewEligible = false;
        const lastService = customer.lastService ? new Date(customer.lastService) : null;
        
        // Skip review if customer has active/pending bookings
        const activeBookings = customer.bookings || [];
        const hasActiveBooking = activeBookings.length > 0;

        if (lastService && !context.reviewFollowUpSent && !hasActiveBooking) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            if (daysSinceService >= 3 && daysSinceService <= 7) {
                isReviewEligible = true;
            }
        }

        // 5. Rebooking eligibility (Maintenance Reminders)
        let isRebookingEligible = false;
        let rebookingAngle = null;
        if (lastService && context.lastServiceType) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            const interval = REBOOKING_INTERVALS[context.lastServiceType];

            // Trigger exactly on interval or within 3-day window after interval
            if (interval && daysSinceService >= interval && daysSinceService <= interval + 3) {
                // Also check if we haven't sent a rebooking follow-up recently
                const lastFup = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
                const daysSinceLastFup = lastFup ? Math.floor((now - lastFup) / (1000 * 60 * 60 * 24)) : 999;

                if (daysSinceLastFup > 7) { // Don't spam if they just got a different message
                    isRebookingEligible = true;
                    rebookingAngle = `rebooking_${context.lastServiceType}`;
                }
            }
        }

        const senderNumber = customer.phone.includes('@') ? customer.phone : customer.phone + '@c.us';

        if (isReviewEligible) {
            // Priority 1: Review
            queue.unshift({
                docId,
                senderNumber,
                name: customer.name || 'Mas',
                context: { ...context, reviewMode: true },
                metadata,
                strategy: { ...STRATEGY_CONFIG[context.customerLabel], angle: 'review' },
            });
        } else if (isRebookingEligible) {
            // Priority 2: Rebooking
            queue.splice(queue.findIndex(item => !item.context.reviewMode), 0, {
                docId,
                senderNumber,
                name: customer.name || 'Mas',
                context: { ...context, rebookingMode: true },
                metadata,
                strategy: { ...STRATEGY_CONFIG[context.customerLabel], angle: rebookingAngle },
            });
        } else if (isNurtureEligible) {
            // Priority 3: Nurturing
            queue.push({
                docId,
                senderNumber,
                name: customer.name || 'Mas',
                context,
                metadata,
                strategy: STRATEGY_CONFIG[context.customerLabel],
            });
        }
    }

    console.log(`[Scheduler] Downgrades: ${downgradeCount}, Queue: ${queue.length} eligible`);

    if (queue.length === 0) {
        console.log('[Scheduler] No eligible customers today');
        return { sent: 0, skipped: 0, errors: 0, downgrades: downgradeCount };
    }

    // Apply limit if provided
    if (limit && queue.length > limit) {
        console.log(`[Scheduler] Limiting queue from ${queue.length} to ${limit} for testing.`);
        queue.splice(limit);
    }

    // Fetch active promo once per daily run
    const promoData = await getActivePromo();

    // Prioritize Reminders FIRST so they run immediately at 9 AM
    const { processCoatingReminders } = require('../../utils/coatingReminders.js');
    const { sendBookingReminders } = require('../../utils/bookingReminders.js');
    if (global.whatsappClient) {
        try {
            await processCoatingReminders(global.whatsappClient);
            await sendBookingReminders(true); // Always check today's bookings
        } catch (err) {
            console.error('[Scheduler] Reminders hit an error:', err.message);
        }
    }

    // Process follow-up queue
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < queue.length; i++) {
        const customer = queue[i];
        try {
            await processFollowUp(customer, promoData, dryRun);
            sent++;
        } catch (err) {
            console.error(`[Scheduler] Error processing ${customer.docId}:`, err.message);
            errors++;
        }

        // Jeda 2 menit di antara pengiriman agar terhindar dari spam list (HANYA JIKA BUKAN DRY RUN)
        if (i < queue.length - 1 && !dryRun) {
            await delay(2 * 60 * 1000);
        }
    }

    console.log(`[Scheduler] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}`);
    return { sent, skipped, errors, downgrades: downgradeCount, dryRun };
}

async function processFollowUp(customer, promoData = null, dryRun = false) {
    const { docId, context, strategy } = customer;
    let { senderNumber } = customer;

    const stopResult = shouldStop(context);
    if (stopResult.stop) {
        await handleStopAction(docId, stopResult, context.customerLabel);
        return;
    }

    const message = await generateFollowUpMessage(customer, strategy, promoData);
    if (!message) return;

    if (dryRun) {
        console.log(`[Scheduler][DryRun] Would send to ${docId}: "${message.substring(0, 50)}..."`);
        return;
    }

    if (!global.whatsappClient) {
        console.warn('[Scheduler] WhatsApp client not available');
        return;
    }

    markBotMessage(senderNumber, message);
    try {
        await withRetry(() => sendTextDirect(global.whatsappClient, senderNumber, message), { maxRetries: 3, baseDelayMs: 2000 });
    } catch (initialError) {
        if (initialError.message && initialError.message.includes('No LID')) {
            console.warn(`[Scheduler] Send failed with No LID for: ${senderNumber}`);
            const cleanPhone = senderNumber.replace(/@c\.us$|@lid$/, '');
            const customerFallback = await prisma.customer.findFirst({
                where: {
                    OR: [
                        { whatsappLid: senderNumber },
                        { whatsappLid: cleanPhone },
                        { phone: senderNumber },
                        { phone: cleanPhone }
                    ]
                },
                select: { phone: true, whatsappLid: true }
            });

            let fallbackTarget = null;
            if (senderNumber.endsWith('@c.us') && customerFallback?.whatsappLid) {
                fallbackTarget = customerFallback.whatsappLid;
            } else if (senderNumber.endsWith('@lid') && customerFallback?.phone) {
                fallbackTarget = customerFallback.phone.includes('@') ? customerFallback.phone : `${customerFallback.phone}@c.us`;
            }

            // Brute-force flip if DB had no distinct alternative
            if (!fallbackTarget || fallbackTarget === senderNumber) {
                const rawDigits = cleanPhone.replace(/\D/g, '');
                if (senderNumber.endsWith('@c.us')) {
                    fallbackTarget = `${rawDigits}@lid`;
                } else if (senderNumber.endsWith('@lid')) {
                    fallbackTarget = `${rawDigits}@c.us`;
                }
                console.log(`[Scheduler] DB had no distinct alt, brute-force flip: ${fallbackTarget}`);
            }

            if (fallbackTarget && fallbackTarget !== senderNumber) {
                console.log(`[Scheduler] Retrying with fallback: ${fallbackTarget}`);
                markBotMessage(fallbackTarget, message);
                await withRetry(() => sendTextDirect(global.whatsappClient, fallbackTarget, message), { maxRetries: 3, baseDelayMs: 2000 });
                senderNumber = fallbackTarget;
            } else {
                throw initialError;
            }
        } else {
            throw initialError;
        }
    }
    console.log(`[Scheduler] ✅ Sent to ${docId}: "${message.substring(0, 50)}..."`);

    const updateData = {
        followUpCount: (context.followUpCount || 0) + 1,
        lastFollowUpAt: new Date(),
        lastFollowUpStrategy: strategy.angle,
    };

    if (context.reviewMode) {
        updateData.reviewFollowUpSent = true;
        updateData.lastReviewAt = new Date();
    }

    // Rebooking mode triggers a "snooze" on nurturing by updating lastFollowUpAt
    // This is already done by default above.

    await prisma.customerContext.update({
        where: { id: docId },
        data: updateData
    });

    await saveMessageToPrisma(senderNumber, message, 'ai');
}

// ─── Dry-Run Queue Builder ────────────────────────────────────────────────────
// Shared by runDailyFollowUp(dryRun=true) and the queue-review HTTP endpoint.
// Returns an array of preview items (no sends, no DB writes).

async function _buildDryRunQueue(now = new Date(), limit = null) {
    const contexts = await prisma.customerContext.findMany({
        where: { customerLabel: { not: null } },
        include: {
            customer: {
                include: {
                    bookings: {
                        where: { status: { notIn: ['DONE', 'CANCELLED'] } }
                    }
                }
            }
        }
    });

    const queue = [];
    const promoData = await getActivePromo();

    for (const context of contexts) {

        const customer = context.customer;
        if (!customer) continue;

        const metadata = {
            lastMessageAt: customer.lastMessageAt,
            name: customer.name,
            fullSenderId: customer.phone.includes('@') ? customer.phone : customer.phone + '@c.us'
        };

        const isNurtureEligible = isEligible(context, metadata);

        let isReviewEligible = false;
        const lastService = customer.lastService ? new Date(customer.lastService) : null;
        const hasActiveBooking = (customer.bookings || []).length > 0;
        if (lastService && !context.reviewFollowUpSent && !hasActiveBooking) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            if (daysSinceService >= 3 && daysSinceService <= 7) isReviewEligible = true;
        }

        let isRebookingEligible = false;
        let rebookingAngle = null;
        if (lastService && context.lastServiceType) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            const interval = REBOOKING_INTERVALS[context.lastServiceType];
            if (interval && daysSinceService >= interval && daysSinceService <= interval + 3) {
                const lastFup = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
                const daysSinceLastFup = lastFup ? Math.floor((now - lastFup) / (1000 * 60 * 60 * 24)) : 999;
                if (daysSinceLastFup > 7) {
                    isRebookingEligible = true;
                    rebookingAngle = `rebooking_${context.lastServiceType}`;
                }
            }
        }

        const senderNumber = customer.phone.includes('@') ? customer.phone : customer.phone + '@c.us';
        const name = customer.name || 'Mas';


        let itemStrategy = null;
        let itemType = null;
        let queueItem = null;

        if (isReviewEligible) {
            itemStrategy = { ...STRATEGY_CONFIG[context.customerLabel], angle: 'review' };
            itemType = 'review';
            queueItem = { docId: context.id, senderNumber, name, context: { ...context, reviewMode: true }, metadata, strategy: itemStrategy };
        } else if (isRebookingEligible) {
            itemStrategy = { ...STRATEGY_CONFIG[context.customerLabel], angle: rebookingAngle };
            itemType = 'rebooking';
            queueItem = { docId: context.id, senderNumber, name, context: { ...context, rebookingMode: true }, metadata, strategy: itemStrategy };
        } else if (isNurtureEligible) {
            itemStrategy = STRATEGY_CONFIG[context.customerLabel];
            itemType = 'nurturing';
            queueItem = { docId: context.id, senderNumber, name, context, metadata, strategy: itemStrategy };
        }

        if (queueItem && itemStrategy) {
            try {
                const generatedMessage = await generateFollowUpMessage(queueItem, itemStrategy, promoData);
                if (generatedMessage) {
                    queue.push({
                        docId: context.id,
                        senderNumber,
                        name,
                        customerLabel: context.customerLabel || null,
                        type: itemType,
                        strategy: itemStrategy,
                        generatedMessage,
                    });
                }
            } catch (err) {
                console.warn(`[Scheduler][DryRun] Failed to generate preview for ${context.id}:`, err.message);
            }
        }
    }

    if (limit && queue.length > limit) queue.splice(limit);

    console.log(`[Scheduler][DryRun] Preview queue built: ${queue.length} items`);
    return queue;
}

// ─── Cron Scheduler ──────────────────────────────────────────────────────────


let schedulerHandle = null;
let lastDailyRunDate = null; // Track last run date
let schedulerBusy = false;  // True while the cron job is actively running

const { DateTime } = require('luxon');
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

function startFollowUpScheduler() {
    if (schedulerHandle) return;

    // Check every 15 minutes
    const intervalMs = 15 * 60 * 1000;

    schedulerHandle = setInterval(async () => {
        const now = DateTime.now().setZone(TIMEZONE);
        const hour = now.hour;
        const todayStr = now.toFormat('yyyy-MM-dd');

        // Execute only once a day at 9 AM
        if (hour === 9 && lastDailyRunDate !== todayStr) {
            lastDailyRunDate = todayStr; // Mark immediately to prevent concurrent duplicates

            // Skip run completely if it's Sunday (Luxon weekday 7 is Sunday)
            if (now.weekday === 7) {
                console.log(`[Scheduler] Hari Minggu, libur re-engagement / follow up.`);
                return;
            }

            try {
                console.log(`[Scheduler] Starting daily follow up at ${now.toISO()} (Hour: ${hour}, Timezone: ${TIMEZONE})`);
                schedulerBusy = true;
                await runDailyFollowUp();
            } catch (err) {
                console.error('[Scheduler] Daily run failed:', err);
                lastDailyRunDate = null; // allow retry if failed immediately
            } finally {
                schedulerBusy = false;
            }
        }
    }, intervalMs);

    console.log(`[Scheduler] Follow-up scheduler started (Target: 09:00 ${TIMEZONE})`);
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
    processFollowUp,
    _buildDryRunQueue,
    startFollowUpScheduler,
    stopFollowUpScheduler,
    isSchedulerRunning,
    /** True while the 9 AM cron job is actively running. Check before manual execute. */
    isSchedulerBusy: () => schedulerBusy,
    /** Mark today as already run — call after manual queue execute to skip the 9 AM cron. */
    setLastDailyRunDate: (dateStr) => { lastDailyRunDate = dateStr; },
};