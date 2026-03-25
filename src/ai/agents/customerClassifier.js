// File: src/ai/agents/customerClassifier.js
// Background customer classifier agent.
// Rule-based scoring engine — 0 token cost, deterministik.
// Menggunakan Prisma untuk semua database operations.

const prisma = require('../../lib/prisma');
const { syncLabelToDirectMessages, getGhostedCount, updateGhostedCountInContext, normalizePhone } = require('../utils/mergeCustomerContext.js');

const STRATEGY_MAP = {
    window_shopper: 'minimal',
    warm_lead: 'nurture',
    hot_lead: 'aggressive',
    existing: 'retention',
    loyal: 'vip',
    churned: 'winback',
    dormant_lead: 'stop',
};

async function getCustomerTransactions(docId, customerName) {
    let transactions = [];

    let results = await prisma.transaction.findMany({
        where: {
            customer: {
                phone: docId
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    if (results.length > 0) {
        transactions = results;
    } else {
        results = await prisma.transaction.findMany({
            where: {
                customer: {
                    whatsappLid: docId
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        if (results.length > 0) {
            transactions = results;
        }
    }

    if (transactions.length === 0 && customerName && customerName.length > 2) {
        results = await prisma.transaction.findMany({
            where: {
                customer: {
                    name: {
                        contains: customerName,
                        mode: 'insensitive'
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        if (results.length > 0) {
            transactions = results;
        }
    }

    return transactions;
}

async function updateGhostedCount(docId, currentContext, metadata) {
    const lastSender = metadata.lastMessageSender;
    const lastChat = metadata.lastMessageAt instanceof Date 
        ? metadata.lastMessageAt 
        : (metadata.lastMessageAt ? new Date(metadata.lastMessageAt) : null);
    
    const daysSince = lastChat
        ? Math.floor((Date.now() - lastChat.getTime()) / 86400000)
        : 0;

    const isCurrentlyGhosted = lastSender === 'ai' && daysSince > 2;

    if (!isCurrentlyGhosted) {
        return currentContext.ghostedTimes || currentContext.ghosted_times || 0;
    }

    const { count: existingCount, lastCounted } = await getGhostedCount(docId);
    
    if (lastCounted) {
        const lastDate = lastCounted instanceof Date ? lastCounted : new Date(lastCounted);
        const hoursSince = (Date.now() - lastDate.getTime()) / 3600000;
        if (hoursSince < 48) return existingCount;
    }

    const newCount = existingCount + 1;
    await updateGhostedCountInContext(docId, newCount);

    return newCount;
}

function scoreCustomer(context, metadata, transactions) {
    const scores = {
        window_shopper: 0,
        warm_lead: 0,
        hot_lead: 0,
        existing: 0,
        loyal: 0,
        churned: 0,
        dormant_lead: 0,
    };

    const now = Date.now();
    const lastChat = metadata.lastMessageAt instanceof Date
        ? metadata.lastMessageAt
        : (metadata.lastMessageAt ? new Date(metadata.lastMessageAt) : null);
    
    const daysSinceLastChat = lastChat
        ? Math.floor((now - lastChat.getTime()) / 86400000)
        : 999;

    const completedTx = transactions.filter(t => t.type === 'income');
    const txCount = completedTx.length;

    let daysSinceLastTx = 999;
    if (completedTx.length > 0) {
        const lastTxDate = completedTx[0].createdAt instanceof Date
            ? completedTx[0].createdAt
            : new Date(completedTx[0].createdAt);
        
        if (lastTxDate && !isNaN(lastTxDate.getTime())) {
            daysSinceLastTx = Math.floor((now - lastTxDate.getTime()) / 86400000);
        }
    }

    const ghosted = metadata.lastMessageSender === 'ai' && daysSinceLastChat > 2;
    const ghostedTimes = context.ghostedTimes || context.ghosted_times || (ghosted ? 1 : 0);

    if (txCount >= 2) {
        if (daysSinceLastTx > 90) {
            scores.churned += 100;
        } else {
            scores.loyal += 100;
        }
    } else if (txCount === 1) {
        if (daysSinceLastTx > 90) {
            scores.churned += 80;
        } else {
            scores.existing += 100;
        }
    }

    if (txCount === 0) {
        const intents = context.detectedIntents || context.detected_intents || [];
        const stage = context.conversationStage || context.conversation_stage || '';

        if (ghostedTimes >= 2) {
            scores.dormant_lead += 100;
        }

        const askedAvailability = context.askedAvailability || context.asked_availability;
        if (askedAvailability || intents.includes('mulai_booking') || stage === 'closing' || stage === 'done') {
            scores.hot_lead += 60;
        }

        const sharedPhoto = context.sharedPhoto || context.shared_photo;
        if (sharedPhoto) scores.hot_lead += 30;

        const askedPrice = context.askedPrice || context.asked_price;
        const saidExpensive = context.saidExpensive || context.said_expensive;
        if ((askedPrice || intents.includes('tanya_harga') || intents.includes('tanya_layanan')) && !saidExpensive) {
            scores.warm_lead += 50;
        }
        if (stage === 'qualifying' || stage === 'consulting') {
            scores.warm_lead += 20;
        }
        if (daysSinceLastChat <= 3) scores.warm_lead += 20;

        const budgetSignal = context.budgetSignal || context.budget_signal;
        if (saidExpensive) scores.window_shopper += 60;
        if (budgetSignal === 'ketat') scores.window_shopper += 30;
        if (intents.length === 0 || (intents.includes('tanya_lokasi') && !intents.includes('tanya_harga'))) {
            scores.window_shopper += 20;
        }
        if (ghosted && ghostedTimes === 1) scores.window_shopper += 40;
    }

    const customerLabel = context.customerLabel || context.customer_label;
    if (customerLabel === 'hot_lead' && daysSinceLastChat > 7 && txCount === 0) {
        scores.hot_lead = 0;
        scores.warm_lead = Math.max(scores.warm_lead, 50);
    }

    if (customerLabel === 'warm_lead' && ghostedTimes >= 1 && daysSinceLastChat > 14) {
        scores.warm_lead = 0;
        scores.window_shopper = Math.max(scores.window_shopper, 50);
    }

    if (customerLabel === 'existing' && daysSinceLastTx > 90) {
        scores.existing = 0;
        scores.churned = Math.max(scores.churned, 80);
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topLabel, topScore] = sorted[0];
    const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
    const confidence = totalScore > 0
        ? Math.round((topScore / totalScore) * 100) / 100
        : 0;

    const activeSignals = [];
    if (txCount > 0) activeSignals.push(`transactions=${txCount}`);
    if (context.askedAvailability || context.asked_availability) activeSignals.push('asked_availability');
    if (context.askedPrice || context.asked_price) activeSignals.push('asked_price');
    if (context.saidExpensive || context.said_expensive) activeSignals.push('said_expensive');
    if (ghostedTimes > 0) activeSignals.push(`ghosted=${ghostedTimes}x`);
    if (context.sharedPhoto || context.shared_photo) activeSignals.push('shared_photo');
    
    const intents = context.detectedIntents || context.detected_intents || [];
    if (intents.length > 0) activeSignals.push(`intents=${intents.join('|')}`);
    
    const stage = context.conversationStage || context.conversation_stage;
    if (stage) activeSignals.push(`stage=${stage}`);

    return {
        label: topLabel,
        confidence,
        scores,
        reason: activeSignals.join(', ') || 'no signals',
        txCount,
        daysSinceLastChat,
        daysSinceLastTx,
    };
}

async function classifyAndSaveCustomer(senderNumber) {
    if (!senderNumber) return;

    const docId = normalizePhone(senderNumber);
    if (!docId) return;

    try {
        const ctxData = await prisma.customerContext.findUnique({
            where: { id: docId }
        });
        const context = ctxData || {};

        const customerData = await prisma.customer.findUnique({
            where: { phone: docId },
            select: {
                name: true,
                lastMessage: true,
                lastMessageAt: true,
                lastMessageSender: true,
                whatsappLid: true
            }
        });

        const metadata = customerData || {};

        const customerName = metadata.name || null;
        const transactions = await getCustomerTransactions(docId, customerName);

        const ghostedTimes = await updateGhostedCount(docId, context, metadata);
        
        const mappedContext = {
            ...context,
            ghostedTimes,
        };

        const result = scoreCustomer(mappedContext, metadata, transactions);

        await prisma.customerContext.upsert({
            where: { id: docId },
            create: {
                id: docId,
                phone: docId,
                customerLabel: result.label,
                labelConfidence: result.confidence,
                labelReason: result.reason,
                labelScores: result.scores,
                followUpStrategy: STRATEGY_MAP[result.label] || 'minimal',
                txCount: result.txCount,
                daysSinceLastChat: result.daysSinceLastChat,
                daysSinceLastTx: result.daysSinceLastTx,
            },
            update: {
                customerLabel: result.label,
                labelConfidence: result.confidence,
                labelReason: result.reason,
                labelScores: result.scores,
                followUpStrategy: STRATEGY_MAP[result.label] || 'minimal',
                txCount: result.txCount,
                daysSinceLastChat: result.daysSinceLastChat,
                daysSinceLastTx: result.daysSinceLastTx,
            }
        });

        await syncLabelToDirectMessages(senderNumber, result.label);

        console.log(`[Classifier] ${docId} → ${result.label} (confidence: ${result.confidence}, reason: ${result.reason})`);

        return result;
    } catch (error) {
        console.error(`[Classifier] Error classifying ${docId}:`, error.message);
        throw error;
    }
}

module.exports = {
    classifyAndSaveCustomer,
    scoreCustomer,
    updateGhostedCount,
    getCustomerTransactions,
    STRATEGY_MAP,
};
