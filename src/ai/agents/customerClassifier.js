// File: src/ai/agents/customerClassifier.js
// Background customer classifier agent.
// Rule-based scoring engine — 0 token cost, deterministik.
// Jalan otomatis (fire & forget) setelah Context Extractor selesai.

const admin = require('firebase-admin');
const { syncLabelToDirectMessages } = require('../utils/mergeCustomerContext.js');

// ─── Follow-Up Strategy Map ──────────────────────────────────────────────────

const STRATEGY_MAP = {
    window_shopper: 'minimal',    // 1x setelah 7 hari, lalu stop
    warm_lead: 'nurture',    // 1x setelah 2 hari
    hot_lead: 'aggressive', // 1x setelah 24 jam
    existing: 'retention',  // berbasis waktu sejak servis terakhir
    loyal: 'vip',        // exclusive treatment
    churned: 'winback',    // angle berbeda, bukan jualan
    dormant_lead: 'stop',       // jangan follow up
};

// ─── Ghost Tracking ──────────────────────────────────────────────────────────

/**
 * Update ghosted count. Hindari double increment (48h cooldown).
 * @returns {number} Updated ghosted_times count
 */
async function updateGhostedCount(docId, currentContext, metadata) {
    const lastSender = metadata.lastMessageSender;
    const lastChat = metadata.lastMessageAt?.toDate?.()
        || (metadata.lastMessageAt ? new Date(metadata.lastMessageAt) : null);
    const daysSince = lastChat
        ? Math.floor((Date.now() - lastChat.getTime()) / 86400000)
        : 0;

    // Ghosted = AI yang terakhir balas, sudah > 2 hari
    const isCurrentlyGhosted = lastSender === 'ai' && daysSince > 2;

    if (!isCurrentlyGhosted) return currentContext.ghosted_times || 0;

    // Hindari increment berulang untuk ghost yang sama
    const alreadyCounted = currentContext.last_ghost_counted_at;
    if (alreadyCounted) {
        const lastCounted = new Date(alreadyCounted).getTime();
        const hoursSince = (Date.now() - lastCounted) / 3600000;
        if (hoursSince < 48) return currentContext.ghosted_times || 0;
    }

    const newCount = (currentContext.ghosted_times || 0) + 1;

    const db = admin.firestore();
    await db.collection('customerContext').doc(docId).update({
        ghosted_times: newCount,
        last_ghost_counted_at: new Date().toISOString(),
    });

    return newCount;
}

// ─── Transaction Query ───────────────────────────────────────────────────────

/**
 * Query transactions untuk customer dengan fallback strategy:
 * 1. Exact match by customerNumber (normalized)
 * 2. Fuzzy match by customerName
 * 3. Return empty array jika tidak ditemukan
 */
async function getCustomerTransactions(docId, customerName) {
    const db = admin.firestore();

    // Strategy 1: Exact match by customerNumber (normalized docId)
    let snap = await db.collection('transactions')
        .where('customerNumber', '==', docId)
        .orderBy('date', 'desc')
        .limit(50)
        .get();

    if (!snap.empty) {
        return snap.docs.map(d => d.data());
    }

    // Try with @c.us suffix
    snap = await db.collection('transactions')
        .where('customerNumber', '==', docId + '@c.us')
        .orderBy('date', 'desc')
        .limit(50)
        .get();

    if (!snap.empty) {
        return snap.docs.map(d => d.data());
    }

    // Try with 0-prefixed version (e.g. 628xxx -> 08xxx)
    if (docId.startsWith('62')) {
        const altNumber = '0' + docId.substring(2);
        snap = await db.collection('transactions')
            .where('customerNumber', '==', altNumber)
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        if (!snap.empty) {
            return snap.docs.map(d => d.data());
        }
    }

    // Strategy 2: Fuzzy match by customerName (case-insensitive check in-app)
    if (customerName && customerName.length > 2) {
        const allTxSnap = await db.collection('transactions')
            .where('customerName', '!=', null)
            .limit(200)
            .get();

        const nameLower = customerName.toLowerCase();
        const matched = allTxSnap.docs
            .filter(d => {
                const txName = (d.data().customerName || '').toLowerCase();
                return txName === nameLower || txName.includes(nameLower) || nameLower.includes(txName);
            })
            .map(d => d.data());

        if (matched.length > 0) {
            return matched;
        }
    }

    // Strategy 3: No transactions found
    return [];
}

// ─── Scoring Engine ──────────────────────────────────────────────────────────

/**
 * Rule-based scoring. No LLM, no token cost.
 */
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
    const lastChat = metadata.lastMessageAt?.toDate?.()
        || (metadata.lastMessageAt ? new Date(metadata.lastMessageAt) : null);
    const daysSinceLastChat = lastChat
        ? Math.floor((now - lastChat.getTime()) / 86400000)
        : 999;

    const completedTx = transactions.filter(t => t.type === 'income');
    const txCount = completedTx.length;

    // Get last tx date
    let daysSinceLastTx = 999;
    if (completedTx.length > 0) {
        const lastTxRaw = completedTx[0].date;
        const lastTxDate = lastTxRaw?.toDate?.()
            || (lastTxRaw ? new Date(lastTxRaw) : null);
        if (lastTxDate && !isNaN(lastTxDate.getTime())) {
            daysSinceLastTx = Math.floor((now - lastTxDate.getTime()) / 86400000);
        }
    }

    const ghosted = metadata.lastMessageSender === 'ai' && daysSinceLastChat > 2;
    const ghostedTimes = context.ghosted_times || (ghosted ? 1 : 0);

    // ── Transaction-based (prioritas tertinggi) ──
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

    // ── Lead scoring (hanya kalau 0 transaksi) ──
    if (txCount === 0) {
        // Dormant: ghosted berkali-kali
        if (ghostedTimes >= 2) {
            scores.dormant_lead += 100;
        }

        // Hot lead
        if (context.asked_availability) scores.hot_lead += 50;
        if (context.shared_photo) scores.hot_lead += 30;
        if (context.intent_level === 'hot') scores.hot_lead += 20;

        // Warm lead
        if (context.asked_price
            && !context.said_expensive) scores.warm_lead += 50;
        if (context.intent_level === 'warm') scores.warm_lead += 30;
        if (daysSinceLastChat <= 3) scores.warm_lead += 20;

        // Window shopper
        if (context.said_expensive) scores.window_shopper += 60;
        if (context.budget_signal === 'ketat') scores.window_shopper += 30;
        if (ghosted && ghostedTimes === 1) scores.window_shopper += 40;
    }

    // ── Label Reset Conditions ──
    // Hot lead yang tidak jadi → turun ke warm setelah 7 hari
    if (context.customer_label === 'hot_lead' && daysSinceLastChat > 7 && txCount === 0) {
        scores.hot_lead = 0;
        scores.warm_lead = Math.max(scores.warm_lead, 50);
    }

    // Warm lead yang ghosted → turun ke window_shopper
    if (context.customer_label === 'warm_lead' && ghostedTimes >= 1 && daysSinceLastChat > 14) {
        scores.warm_lead = 0;
        scores.window_shopper = Math.max(scores.window_shopper, 50);
    }

    // Existing yang lama tidak balik → churned
    if (context.customer_label === 'existing' && daysSinceLastTx > 90) {
        scores.existing = 0;
        scores.churned = Math.max(scores.churned, 80);
    }

    // Ambil label tertinggi
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topLabel, topScore] = sorted[0];
    const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
    const confidence = totalScore > 0
        ? Math.round((topScore / totalScore) * 100) / 100
        : 0;

    // Buat reason string untuk debugging
    const activeSignals = [];
    if (txCount > 0) activeSignals.push(`transactions=${txCount}`);
    if (context.asked_availability) activeSignals.push('asked_availability');
    if (context.asked_price) activeSignals.push('asked_price');
    if (context.said_expensive) activeSignals.push('said_expensive');
    if (ghostedTimes > 0) activeSignals.push(`ghosted=${ghostedTimes}x`);
    if (context.shared_photo) activeSignals.push('shared_photo');
    if (context.intent_level) activeSignals.push(`intent=${context.intent_level}`);

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

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Classify a customer and save results to Firestore.
 * Designed to be called fire & forget, chained after extractAndSaveContext.
 */
async function classifyAndSaveCustomer(senderNumber) {
    if (!senderNumber) return;

    const docId = senderNumber.replace(/[^0-9]/g, '');
    if (!docId) return;

    const db = admin.firestore();

    try {
        // 1. Fetch customerContext
        const ctxRef = db.collection('customerContext').doc(docId);
        const ctxDoc = await ctxRef.get();
        const context = ctxDoc.exists ? ctxDoc.data() : {};

        // 2. Fetch directMessages metadata
        const dmRef = db.collection('directMessages').doc(docId);
        const dmDoc = await dmRef.get();
        const metadata = dmDoc.exists ? dmDoc.data() : {};

        // 3. Fetch transactions (with fallback strategy)
        const customerName = metadata.name || context.customer_name || null;
        const transactions = await getCustomerTransactions(docId, customerName);

        // 4. Update ghost count
        const ghostedTimes = await updateGhostedCount(docId, context, metadata);
        context.ghosted_times = ghostedTimes;

        // 5. Score
        const result = scoreCustomer(context, metadata, transactions);

        // 6. Save to customerContext
        const update = {
            customer_label: result.label,
            label_confidence: result.confidence,
            label_reason: result.reason,
            label_scores: result.scores,
            follow_up_strategy: STRATEGY_MAP[result.label] || 'minimal',
            tx_count: result.txCount,
            days_since_last_chat: result.daysSinceLastChat,
            days_since_last_tx: result.daysSinceLastTx,
            label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
            labeled_by: 'classifier',
        };

        await ctxRef.set(update, { merge: true });

        // Synchronize to directMessages for dashboard labels
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
    // Exported for testing
    scoreCustomer,
    updateGhostedCount,
    getCustomerTransactions,
    STRATEGY_MAP,
};
