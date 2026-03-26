// File: src/ai/utils/auditSession.js
// State management untuk Customer Audit session.
// Using Prisma KeyValueStore for session data.

const prisma = require('../../lib/prisma');

const TIMEOUT_MS = 30 * 60 * 1000; // 30 menit

function getDocId(adminNumber) {
    return (adminNumber || '').replace(/[^0-9]/g, '');
}

async function getSessionKey(adminNumber) {
    return `audit_session_${getDocId(adminNumber)}`;
}

/**
 * Buat session audit baru.
 */
async function createSession(adminNumber, autoLabeledCount, pendingQueue) {
    const key = await getSessionKey(adminNumber);
    const session = {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        totalCustomers: autoLabeledCount + pendingQueue.length,
        autoLabeled: autoLabeledCount,
        pendingReview: pendingQueue,
        completedReview: [],
        currentIndex: 0,
        currentStep: 'awaiting_start',
        pausedAt: null,
    };

    await prisma.keyValueStore.upsert({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        create: {
            collection: 'auditSessions',
            key: getDocId(adminNumber),
            value: session
        },
        update: {
            value: session
        }
    });

    console.log(`[Audit] Session created for ${getDocId(adminNumber)}: ${pendingQueue.length} pending, ${autoLabeledCount} auto-labeled`);
    return session;
}

/**
 * Ambil session aktif. Jika lastActivityAt > 30 menit → auto-pause.
 */
async function getSession(adminNumber) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });

    if (!kv) return null;
    const data = kv.value;

    if (data.status === 'completed') return null;

    // Lazy timeout check
    if (data.status === 'in_progress' && data.lastActivityAt) {
        const lastActivity = new Date(data.lastActivityAt);
        const elapsed = Date.now() - lastActivity.getTime();

        if (elapsed > TIMEOUT_MS) {
            console.log(`[Audit] Session auto-paused for ${getDocId(adminNumber)} (idle ${Math.round(elapsed / 60000)} min)`);
            data.status = 'paused';
            data.pausedAt = new Date().toISOString();
            
            await prisma.keyValueStore.update({
                where: {
                    collection_key: {
                        collection: 'auditSessions',
                        key: getDocId(adminNumber)
                    }
                },
                data: { value: data }
            });
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
 */
async function advanceSession(adminNumber, reviewResult) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return null;

    const data = kv.value;
    const completedReview = [...(data.completedReview || []), reviewResult];
    const nextIndex = (data.currentIndex || 0) + 1;
    const isFinished = nextIndex >= (data.pendingReview || []).length;

    const update = {
        completedReview,
        currentIndex: nextIndex,
        currentStep: isFinished ? 'completed' : 'awaiting_classification',
        status: isFinished ? 'completed' : 'in_progress',
        lastActivityAt: new Date().toISOString(),
    };

    if (isFinished) {
        update.completedAt = new Date().toISOString();
    }

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: { ...data, ...update } }
    });

    console.log(`[Audit] Advanced session for ${getDocId(adminNumber)}: index ${nextIndex}, finished: ${isFinished}`);
    return { ...data, ...update };
}

/**
 * Update step session saat ini
 */
async function updateSessionStep(adminNumber, step) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return;

    kv.value.currentStep = step;
    kv.value.lastActivityAt = new Date().toISOString();

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: kv.value }
    });
}

/**
 * Pause session
 */
async function pauseSession(adminNumber) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return;

    kv.value.status = 'paused';
    kv.value.pausedAt = new Date().toISOString();

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: kv.value }
    });
    console.log(`[Audit] Session paused for ${getDocId(adminNumber)}`);
}

/**
 * Resume session
 */
async function resumeSession(adminNumber) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return;

    kv.value.status = 'in_progress';
    kv.value.pausedAt = null;
    kv.value.lastActivityAt = new Date().toISOString();

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: kv.value }
    });
    console.log(`[Audit] Session resumed for ${getDocId(adminNumber)}`);
}

/**
 * Tandai session selesai
 */
async function completeSession(adminNumber) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return;

    kv.value.status = 'completed';
    kv.value.completedAt = new Date().toISOString();

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: kv.value }
    });
    console.log(`[Audit] Session completed for ${getDocId(adminNumber)}`);
}

/**
 * Touch lastActivityAt
 */
async function touchSession(adminNumber) {
    const kv = await prisma.keyValueStore.findUnique({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        }
    });
    if (!kv) return;

    kv.value.lastActivityAt = new Date().toISOString();

    await prisma.keyValueStore.update({
        where: {
            collection_key: {
                collection: 'auditSessions',
                key: getDocId(adminNumber)
            }
        },
        data: { value: kv.value }
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