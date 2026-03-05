// File: src/ai/utils/auditSession.js
// State management untuk Customer Audit session.
// Firestore collection: auditSession/{adminNumber}

const admin = require('firebase-admin');

const TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

function getDocId(adminNumber) {
    return (adminNumber || '').replace(/[^0-9]/g, '');
}

function getRef(adminNumber) {
    const db = admin.firestore();
    return db.collection('auditSession').doc(getDocId(adminNumber));
}

/**
 * Buat session audit baru.
 * @param {string} adminNumber
 * @param {number} autoLabeledCount - Jumlah customer yang auto-labeled
 * @param {Array} pendingQueue - Array of { docId, name, lastMessageAt, motorModel, targetService, lastMessageSender }
 */
async function createSession(adminNumber, autoLabeledCount, pendingQueue) {
    const ref = getRef(adminNumber);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const session = {
        status: 'in_progress',
        startedAt: now,
        lastActivityAt: now,
        totalCustomers: autoLabeledCount + pendingQueue.length,
        autoLabeled: autoLabeledCount,
        pendingReview: pendingQueue,
        completedReview: [],
        currentIndex: 0,
        currentStep: 'awaiting_start',
        pausedAt: null,
    };

    await ref.set(session);
    console.log(`[Audit] Session created for ${getDocId(adminNumber)}: ${pendingQueue.length} pending, ${autoLabeledCount} auto-labeled`);
    return session;
}

/**
 * Ambil session aktif. Jika lastActivityAt > 30 menit → auto-pause.
 * @param {string} adminNumber
 * @returns {Object|null} session data atau null jika tidak ada / sudah selesai
 */
async function getSession(adminNumber) {
    const ref = getRef(adminNumber);
    const doc = await ref.get();

    if (!doc.exists) return null;

    const data = doc.data();

    if (data.status === 'completed') return null;

    // Lazy timeout check
    if (data.status === 'in_progress' && data.lastActivityAt) {
        const lastActivity = data.lastActivityAt.toDate ? data.lastActivityAt.toDate() : new Date(data.lastActivityAt);
        const elapsed = Date.now() - lastActivity.getTime();

        if (elapsed > TIMEOUT_MS) {
            console.log(`[Audit] Session auto-paused for ${getDocId(adminNumber)} (idle ${Math.round(elapsed / 60000)} min)`);
            await ref.update({
                status: 'paused',
                pausedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            data.status = 'paused';
            data.pausedAt = new Date();
        }
    }

    return data;
}

/**
 * Cek apakah admin punya session aktif (in_progress atau paused).
 */
async function hasActiveSession(adminNumber) {
    const session = await getSession(adminNumber);
    return session !== null && (session.status === 'in_progress' || session.status === 'paused');
}

/**
 * Tandai current customer selesai, geser index ke berikutnya.
 * @param {string} adminNumber
 * @param {{ docId: string, label: string }} reviewResult
 */
async function advanceSession(adminNumber, reviewResult) {
    const ref = getRef(adminNumber);
    const doc = await ref.get();
    if (!doc.exists) return null;

    const data = doc.data();
    const completedReview = [...(data.completedReview || []), reviewResult];
    const nextIndex = (data.currentIndex || 0) + 1;
    const isFinished = nextIndex >= (data.pendingReview || []).length;

    const update = {
        completedReview,
        currentIndex: nextIndex,
        currentStep: isFinished ? 'completed' : 'awaiting_classification',
        status: isFinished ? 'completed' : 'in_progress',
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isFinished) {
        update.completedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.update(update);

    console.log(`[Audit] Advanced session for ${getDocId(adminNumber)}: index ${nextIndex}, finished: ${isFinished}`);
    return { ...data, ...update, completedReview, currentIndex: nextIndex };
}

/**
 * Update step session saat ini (e.g. awaiting_classification → awaiting_detail).
 */
async function updateSessionStep(adminNumber, step) {
    const ref = getRef(adminNumber);
    await ref.update({
        currentStep: step,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Pause session (admin ketik escape keyword atau timeout).
 */
async function pauseSession(adminNumber) {
    const ref = getRef(adminNumber);
    await ref.update({
        status: 'paused',
        pausedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Audit] Session paused for ${getDocId(adminNumber)}`);
}

/**
 * Resume session yang di-pause.
 */
async function resumeSession(adminNumber) {
    const ref = getRef(adminNumber);
    await ref.update({
        status: 'in_progress',
        pausedAt: null,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Audit] Session resumed for ${getDocId(adminNumber)}`);
}

/**
 * Tandai session selesai.
 */
async function completeSession(adminNumber) {
    const ref = getRef(adminNumber);
    await ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[Audit] Session completed for ${getDocId(adminNumber)}`);
}

/**
 * Touch lastActivityAt — dipanggil setiap admin kirim pesan dalam konteks audit.
 */
async function touchSession(adminNumber) {
    const ref = getRef(adminNumber);
    await ref.update({
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

module.exports = {
    createSession,
    getSession,
    hasActiveSession,
    advanceSession,
    updateSessionStep,
    pauseSession,
    resumeSession,
    completeSession,
    touchSession,
};
