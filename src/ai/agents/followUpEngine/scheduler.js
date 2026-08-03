// File: src/ai/agents/followUpEngine/scheduler.js
// Daily cron job: label downgrade, eligibility check, generate & send follow-up messages.

const prisma = require('../../../lib/prisma');
const { generateFollowUpMessage, getDaysSince, resolveAngle } = require('./messageGenerator.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');
const { markBotMessage } = require('../../utils/adminMessageSync.js');
const { getActivePromo } = require('../../utils/promoConfig');
const { withRetry } = require('../../utils/retry');
const { sendTextDirect } = require('../../utils/whatsappHelper');

/**
 * Resolve the best WhatsApp ID for sending messages.
 * Priority: whatsappLid > phone (with suffix) > phone + @c.us fallback
 */
function resolveWhatsappId(customer) {
    if (customer.whatsappLid) return customer.whatsappLid;
    if (customer.phone && customer.phone.includes('@')) return customer.phone;
    return customer.phone ? customer.phone + '@c.us' : null;
}

// ─── Helper: Save message to Prisma ────────────────────────────────────────

async function saveMessageToPrisma(senderNumber, message, senderType) {
    if (!senderNumber || !message) return;

    // Use unified identity parser to handle @lid and @c.us correctly
    const { parseSenderIdentity } = require('../../../lib/utils');
    const { docId, normalizedPhone } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { whatsappLid: senderNumber },
                { phone: normalizedPhone },   // bare number (no suffix) — matches DB format
                { phone: docId },             // with @c.us — fallback
                { phone: senderNumber },      // raw input — last resort
            ]
        }
    });

    if (!customer) {
        console.warn(`[Scheduler] saveMessageToPrisma: customer not found for ${senderNumber}`);
        return;
    }

    const messageText = message.trim();

    await prisma.directMessage.create({
        data: {
            customerId: customer.id,
            senderId: senderNumber,
            role: senderType === 'user' ? 'user' : (senderType === 'ai' ? 'assistant' : 'admin'),
            content: messageText,
        }
    });

    await prisma.customer.update({
        where: { id: customer.id },
        data: {
            lastMessage: messageText,
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
        condition: (ctx) => getDaysSince(ctx.lastServiceAt) > 90,
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
    // Must have messaged before (fall back to context updatedAt for newly created records)
    const lastMessage = metadata?.lastMessageAt
        ? new Date(metadata.lastMessageAt)
        : (context.updatedAt ? new Date(context.updatedAt) : null);

    if (!lastMessage) return false;

    if (lastFollowUp) {
        // Already followed up before — use secondIntervalDays for FU3, intervalDays for FU2
        const followUpCount = context.followUpCount || 0;
        const interval = followUpCount >= 2
            ? (strategy.secondIntervalDays || strategy.intervalDays)
            : (strategy.intervalDays || strategy.waitDays);
        const daysSinceLastFollowUp = getDaysSince(lastFollowUp);
        if (daysSinceLastFollowUp < interval) return false;
    } else {
        // First follow-up — check waitDays since last message or last service
        const referenceDate = (label === 'existing_customer' || label === 'loyal_customer')
            ? (context.lastServiceAt ? new Date(context.lastServiceAt) : lastMessage)
            : lastMessage;
        const daysSinceReference = getDaysSince(referenceDate);
        if (daysSinceReference < strategy.waitDays) return false;
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

// ─── Unified Queue Builder ───────────────────────────────────────────────────

async function buildEligibilityQueue(now, contexts, options = { dryRun: false }) {
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
            fullSenderId: resolveWhatsappId(customer)
        };

        // 2. Label downgrade check (Only persisted on live run; dry run simulates
        // in-memory only so the preview reflects what today's real run would do).
        for (const rule of DOWNGRADE_RULES) {
            if (context.customerLabel === rule.from && rule.condition(context, metadata)) {
                if (!options.dryRun) {
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
                    console.log(`[Scheduler] Downgrade ${docId}: ${rule.from} → ${rule.to}`);
                }
                context.customerLabel = rule.to;
                downgradeCount++;
                break;
            }
        }

        // 3. Check Active Bookings (Skip follow-ups if currently in service)
        const activeBookings = customer.bookings || [];
        const hasActiveBooking = activeBookings.length > 0;

        // 4. Eligibility checks
        const isNurtureEligible = !hasActiveBooking && isEligible(context, metadata);

        // 5. Review eligibility (Post-Service 3 Days)
        let isReviewEligible = false;
        const lastService = customer.lastService ? new Date(customer.lastService) : null;

        if (lastService && !context.reviewFollowUpSent && !hasActiveBooking) {
            const daysSinceService = getDaysSince(lastService);
            if (daysSinceService >= 3 && daysSinceService <= 7) {
                isReviewEligible = true;
            }
        }

        // 6. Rebooking eligibility (Maintenance Reminders)
        let isRebookingEligible = false;
        let rebookingAngle = null;
        if (lastService && context.lastServiceType) {
            const daysSinceService = getDaysSince(lastService);
            const interval = REBOOKING_INTERVALS[context.lastServiceType];

            if (interval && daysSinceService >= interval && daysSinceService <= interval + 3) {
                const daysSinceLastFup = context.lastFollowUpAt ? getDaysSince(context.lastFollowUpAt) : 999;
                if (daysSinceLastFup > 7 && !hasActiveBooking) {
                    isRebookingEligible = true;
                    rebookingAngle = `rebooking_${context.lastServiceType}`;
                }
            }
        }

        const senderNumber = resolveWhatsappId(customer);
        // Don't fake "Mas" as a name here — messageGenerator.js detects an
        // unknown/placeholder name and adjusts the sapaan instruction instead
        // of forcing a fake name into the greeting.
        const name = customer.name || null;
        let itemStrategy = null;
        let itemType = null;
        let queueItem = null;

        if (isReviewEligible) {
            // Priority 1: Review
            itemStrategy = { ...STRATEGY_CONFIG[context.customerLabel], angle: 'review' };
            itemType = 'review';
            queueItem = { docId, senderNumber, name, context: { ...context, reviewMode: true }, metadata, strategy: itemStrategy };
            queue.unshift(queueItem);
        } else if (isRebookingEligible) {
            // Priority 2: Rebooking
            itemStrategy = { ...STRATEGY_CONFIG[context.customerLabel], angle: rebookingAngle };
            itemType = 'rebooking';
            queueItem = { docId, senderNumber, name, context: { ...context, rebookingMode: true }, metadata, strategy: itemStrategy };
            const idx = queue.findIndex(item => !item.context.reviewMode);
            queue.splice(idx === -1 ? queue.length : idx, 0, queueItem);
        } else if (isNurtureEligible) {
            // Priority 3: Nurturing
            itemStrategy = STRATEGY_CONFIG[context.customerLabel];
            itemType = 'nurturing';
            queueItem = { docId, senderNumber, name, context, metadata, strategy: itemStrategy };
            queue.push(queueItem);
        }

        if (queueItem && itemStrategy) {
            queueItem.type = itemType;
            queueItem.customerLabel = context.customerLabel;
        }
    }

    return { queue, downgradeCount };
}

// ─── Main Daily Run ──────────────────────────────────────────────────────────

async function runDailyFollowUp(dryRun = false, limit = null) {
    const now = new Date();
    console.log(`[Scheduler] Running daily follow-up check... (dryRun=${dryRun})`);

    if (dryRun) {
        return await _buildDryRunQueue(now, limit);
    }

    const contexts = await prisma.customerContext.findMany({
        where: { customerLabel: { not: null } },
        include: {
            customer: {
                include: {
                    bookings: {
                        where: { status: { notIn: ['COMPLETED', 'PAID', 'DONE', 'CANCELLED'] } }
                    }
                }
            }
        }
    });

    const { queue, downgradeCount } = await buildEligibilityQueue(now, contexts, { dryRun: false });

    console.log(`[Scheduler] Downgrades: ${downgradeCount}, Queue: ${queue.length} eligible`);

    if (queue.length === 0) {
        console.log('[Scheduler] No eligible customers today');
        return { sent: 0, skipped: 0, errors: 0, downgrades: downgradeCount };
    }

    const MAX_DAILY_FOLLOW_UPS = parseInt(process.env.MAX_DAILY_FOLLOW_UPS) || 50;
    const finalLimit = limit ? Math.min(limit, MAX_DAILY_FOLLOW_UPS) : MAX_DAILY_FOLLOW_UPS;
    if (queue.length > finalLimit) {
        queue.sort((a, b) => {
            const dateA = a.metadata?.lastMessageAt ? new Date(a.metadata.lastMessageAt) : new Date(0);
            const dateB = b.metadata?.lastMessageAt ? new Date(b.metadata.lastMessageAt) : new Date(0);
            return dateB - dateA; // Descending
        });
        console.log(`[Scheduler] Limiting queue from ${queue.length} to ${finalLimit} to prevent bans.`);
        queue.splice(finalLimit);
    }

    const promoData = await getActivePromo();

    const { processCoatingReminders } = require('../../utils/coatingReminders.js');
    const { sendBookingReminders } = require('../../utils/bookingReminders.js');
    if (global.whatsappClient) {
        try {
            await processCoatingReminders(global.whatsappClient);
            await sendBookingReminders(true);
        } catch (err) {
            console.error('[Scheduler] Reminders hit an error:', err.message);
        }
    }

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

        if (i < queue.length - 1 && !dryRun) {
            const minMs = 7 * 60 * 1000;
            const maxMs = 10 * 60 * 1000;
            const randomDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
            const minutes = (randomDelay / 60000).toFixed(1);
            console.log(`[Scheduler] Waiting ${minutes} minutes before next message...`);
            await delay(randomDelay);
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
                select: { id: true, phone: true, whatsappLid: true }
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

                // Cache the newly discovered fallback ID so future runs don't need
                // to re-guess. Must key off the Customer record's own id — docId
                // here is the CustomerContext id, not the Customer's identifier,
                // so using it directly (as before) made this update silently no-op.
                if (customerFallback?.id) {
                    await prisma.customer.update({
                        where: { id: customerFallback.id },
                        data: { whatsappLid: fallbackTarget }
                    }).catch(e => console.warn(`[Scheduler] Failed to cache fallback LID: ${e.message}`));
                }

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
        // Use the same angle-resolution logic as messageGenerator so this stays
        // accurate for nurture-flow customers (strategy.angles[]), not just the
        // review/rebooking cases where strategy.angle is set explicitly.
        lastFollowUpStrategy: resolveAngle(strategy, context.followUpCount || 0),
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
                        where: { status: { notIn: ['COMPLETED', 'PAID', 'DONE', 'CANCELLED'] } }
                    }
                }
            }
        }
    });

    const promoData = await getActivePromo();
    const { queue } = await buildEligibilityQueue(now, contexts, { dryRun: true });

    const MAX_DAILY_FOLLOW_UPS = parseInt(process.env.MAX_DAILY_FOLLOW_UPS) || 50;
    const finalLimit = limit ? Math.min(limit, MAX_DAILY_FOLLOW_UPS) : MAX_DAILY_FOLLOW_UPS;
    if (queue.length > finalLimit) {
        queue.sort((a, b) => {
            const dateA = a.metadata?.lastMessageAt ? new Date(a.metadata.lastMessageAt) : new Date(0);
            const dateB = b.metadata?.lastMessageAt ? new Date(b.metadata.lastMessageAt) : new Date(0);
            return dateB - dateA;
        });
        queue.splice(finalLimit);
    }

    console.log(`[Scheduler][DryRun] Preview queue built: ${queue.length} items (Limit: ${finalLimit}/day)`);

    for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        try {
            const generatedMessage = await generateFollowUpMessage(q, q.strategy, promoData);
            q.generatedMessage = generatedMessage || `[No message generated]`;
        } catch (err) {
            console.warn(`[Scheduler][DryRun] Failed to generate preview for ${q.docId}:`, err.message);
            q.generatedMessage = `[Error generating message: ${err.message}]`;
        }

        const dSince = q.metadata?.lastMessageAt ? Math.floor((now - new Date(q.metadata.lastMessageAt)) / (1000 * 60 * 60 * 24)) : 'N/A';
        console.log(`  ${i + 1}. ${q.name || '(no name)'} (${q.customerLabel}) → type: ${q.type}, daysSinceMsg: ${dSince}`);
    }

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

                // 1. Independent Reminders: Always run Booking & Coating reminders at 9 AM
                try {
                    console.log('[Scheduler] Running mandatory Booking and Coating reminders...');
                    const { processCoatingReminders } = require('../../utils/coatingReminders.js');
                    const { sendBookingReminders } = require('../../utils/bookingReminders.js');

                    await Promise.all([
                        processCoatingReminders(global.whatsappClient).catch(e => console.error('[Scheduler] Coating reminders error:', e)),
                        sendBookingReminders(true).catch(e => console.error('[Scheduler] Booking reminders error:', e))
                    ]);
                } catch (remErr) {
                    console.error('[Scheduler] Reminders execution block failed:', remErr);
                }

                // 2. Follow-Up Logic: Manual (Saved) vs Automatic (Fresh)
                const savedRecord = await prisma.keyValueStore.findUnique({
                    where: { collection_key: { collection: 'follow_up_queue', key: 'saved' } }
                }).catch(() => null);

                // Check if saved queue exists AND has at least one approved item
                const hasApprovedItems = savedRecord?.value?.queue
                    ? savedRecord.value.queue.some(item => item.approved === true)
                    : false;

                if (hasApprovedItems) {
                    const { queue: savedQueue, delayMs: savedDelayMs = 300000 } = savedRecord.value;
                    console.log(`[Scheduler] Found saved queue from admin with approved items (${savedQueue.length} total). Using it.`);

                    const { sendTextDirect } = require('../../utils/whatsappHelper');
                    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
                    let sent = 0, errors = 0;

                    for (const item of savedQueue) {
                        const { senderNumber, type, message, docId } = item;
                        if (!item.approved) continue;

                        const cleanMsg = message;
                        if (!cleanMsg) {
                            console.warn(`[Scheduler][Saved] Skip empty message for ${senderNumber}`);
                            continue;
                        }

                        try {
                            if (type !== 'coating_reminder' && type !== 'booking_reminder') {
                                markBotMessage(senderNumber, cleanMsg);
                            }
                            await withRetry(() => sendTextDirect(global.whatsappClient, senderNumber, cleanMsg), { maxRetries: 2, baseDelayMs: 2000 });
                            sent++;
                            console.log(`[Scheduler][Saved] ✅ Sent ${type} to ${senderNumber}`);

                            // Log to DB (Missing in previous version!)
                            await saveMessageToPrisma(senderNumber, cleanMsg, 'ai').catch(err => console.error('[Scheduler][Saved] DB Log failed:', err));

                            // Update DB based on type
                            if (type === 'coating_reminder') {
                                const record = await prisma.coatingMaintenance.findUnique({ where: { id: docId } }).catch(() => null);
                                const nextStatus = record?.status === 'pending' ? 'reminded_h7' : record?.status === 'reminded_h7' ? 'reminded_h3' : 'reminded_h1';
                                await prisma.coatingMaintenance.update({ where: { id: docId }, data: { status: nextStatus, reminderSent: true, reminderSentAt: new Date() } })
                                    .catch(err => console.error(`[Scheduler] CRITICAL: coatingMaintenance status update failed for ${docId}:`, err.message));
                            } else if (type === 'booking_reminder') {
                                await prisma.booking.update({ where: { id: docId }, data: { reminderSent: true, reminderSentAt: new Date() } })
                                    .catch(err => console.error(`[Scheduler] CRITICAL: booking reminderSent update failed for ${docId}:`, err.message));
                            } else {
                                const ctx = await prisma.customerContext.findUnique({ where: { id: docId } }).catch(() => null);
                                if (ctx) {
                                    const updateData = { followUpCount: (ctx.followUpCount || 0) + 1, lastFollowUpAt: new Date(), lastFollowUpStrategy: type };
                                    if (type === 'review') updateData.reviewFollowUpSent = true;
                                    await withRetry(() => prisma.customerContext.update({ where: { id: docId }, data: updateData }), { maxRetries: 3, baseDelayMs: 1000 })
                                        .then(() => console.log(`[Scheduler] Context updated for ${docId} (followUpCount => ${updateData.followUpCount})`))
                                        .catch(err => console.error(`[Scheduler] CRITICAL: Context update failed for ${docId}:`, err.message));
                                } else {
                                    console.warn(`[Scheduler] Warning: Context not found for ${docId}, followUpCount not updated.`);
                                }
                            }
                        } catch (err) {
                            errors++;
                            console.error(`[Scheduler][Saved] Failed ${type} to ${senderNumber}:`, err.message);
                        }

                        if (item !== savedQueue[savedQueue.length - 1] && savedDelayMs > 0) await sleep(savedDelayMs);
                    }

                    // Clear saved queue after execute
                    await prisma.keyValueStore.deleteMany({ where: { collection: 'follow_up_queue', key: 'saved' } }).catch(() => { });
                    console.log(`[Scheduler][Saved] Done — sent: ${sent}, errors: ${errors}`);
                } else {
                    // No approved items or no record — execute fresh daily run
                    console.log('[Scheduler] No approved queue found. Running fresh daily follow-up scan.');
                    await runDailyFollowUp();
                }
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