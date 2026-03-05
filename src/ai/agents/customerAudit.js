// File: src/ai/agents/customerAudit.js
// Customer Audit Agent — deterministic multi-turn flow via WhatsApp.
// Scan customer historis yang belum punya label, auto-label yang jelas,
// dan tanya admin untuk yang ambigu.

const admin = require('firebase-admin');
const {
    createSession,
    getSession,
    hasActiveSession,
    advanceSession,
    updateSessionStep,
    pauseSession,
    resumeSession,
    touchSession,
} = require('../utils/auditSession.js');
const { mergeAndSaveContext } = require('../utils/mergeCustomerContext.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const PAUSE_KEYWORDS = ['pause', 'stop audit', 'nanti', 'bukan', 'cancel', 'batal'];

const LABEL_MAP = {
    '1_once': 'existing_customer',
    '1_multiple': 'loyal_customer',
    '1_unknown': 'existing_customer',
    '2': 'lead',
};

// ─── Scan Logic ───────────────────────────────────────────────────────────────

/**
 * Scan semua customer yang belum punya label.
 * Cross-reference directMessages, customerContext, dan transactions.
 * @returns {{ autoLabeled: Array, pendingReview: Array }}
 */
async function scanUnlabeledCustomers() {
    const db = admin.firestore();

    // 1. Ambil semua directMessages
    const dmSnap = await db.collection('directMessages').get();
    if (dmSnap.empty) {
        return { autoLabeled: [], pendingReview: [] };
    }

    // 2. Ambil semua customerContext (batch)
    const ctxSnap = await db.collection('customerContext').get();
    const ctxMap = new Map();
    ctxSnap.forEach(doc => ctxMap.set(doc.id, doc.data()));

    // 3. Ambil semua transactions → group by customerNumber
    const txSnap = await db.collection('transactions').get();
    const txByCustomer = new Map();
    txSnap.forEach(doc => {
        const data = doc.data();
        const custNum = (data.customerNumber || '').replace(/[^0-9]/g, '');
        if (custNum) {
            txByCustomer.set(custNum, (txByCustomer.get(custNum) || 0) + 1);
        }
    });

    const autoLabeled = [];
    const pendingReview = [];

    for (const dmDoc of dmSnap.docs) {
        const docId = dmDoc.id;
        const dm = dmDoc.data();
        const ctx = ctxMap.get(docId) || {};

        // Skip jika sudah punya label
        if (ctx.customer_label && ctx.customer_label !== 'unknown') {
            continue;
        }

        const txCount = txByCustomer.get(docId) || 0;
        const lastMessageAt = dm.lastMessageAt?.toDate ? dm.lastMessageAt.toDate() : null;
        const daysSinceLastMessage = lastMessageAt
            ? Math.floor((Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const customerInfo = {
            docId,
            name: dm.name || `Customer ${docId.slice(-4)}`,
            lastMessageAt: lastMessageAt?.toISOString() || null,
            daysSince: daysSinceLastMessage,
            motorModel: ctx.motor_model || null,
            targetService: ctx.target_service || null,
            lastMessageSender: dm.lastMessageSender || null,
            messageCount: dm.messageCount || 0,
            txCount,
            saidExpensive: ctx.said_expensive || false,
            budgetSignal: ctx.budget_signal || null,
            askedAvailability: ctx.asked_availability || false,
            intentLevel: ctx.intent_level || null,
        };

        // ─── Bucket YAKIN (auto-label) ───────────────────────────────────

        // DORMANT_LEAD: 0 transaksi, > 60 hari, ghosted (lastSender = ai)
        if (
            txCount === 0 &&
            daysSinceLastMessage !== null &&
            daysSinceLastMessage > 60 &&
            dm.lastMessageSender === 'ai'
        ) {
            autoLabeled.push({ ...customerInfo, label: 'dormant_lead' });
            continue;
        }

        // HOT_LEAD: asked_availability, < 7 hari, 0 transaksi
        if (
            ctx.asked_availability === true &&
            daysSinceLastMessage !== null &&
            daysSinceLastMessage < 7 &&
            txCount === 0
        ) {
            autoLabeled.push({ ...customerInfo, label: 'hot_lead' });
            continue;
        }

        // WINDOW_SHOPPER: said_expensive atau budget ketat
        if (ctx.said_expensive === true || ctx.budget_signal === 'ketat') {
            autoLabeled.push({ ...customerInfo, label: 'window_shopper' });
            continue;
        }

        // WARM_LEAD: pernah tanya harga tapi belum booking
        if (ctx.intent_level === 'warm' && txCount === 0) {
            autoLabeled.push({ ...customerInfo, label: 'warm_lead' });
            continue;
        }

        // ─── Bucket TIDAK YAKIN (perlu konfirmasi admin) ─────────────────
        pendingReview.push(customerInfo);
    }

    return { autoLabeled, pendingReview };
}

/**
 * Simpan auto-label ke customerContext.
 */
async function saveAutoLabels(autoLabeled) {
    let saved = 0;
    for (const item of autoLabeled) {
        try {
            await mergeAndSaveContext(item.docId + '@c.us', {
                customer_label: item.label,
                labeled_by: 'audit_auto',
                labeled_at: new Date().toISOString(),
            });
            saved++;
        } catch (err) {
            console.warn(`[Audit] Failed to save auto-label for ${item.docId}:`, err.message);
        }
    }
    return saved;
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatCustomerCard(customer, index, total) {
    const name = customer.name || 'Tidak diketahui';
    const motor = customer.motorModel || 'Tidak diketahui';
    const topik = customer.targetService || 'Lihat chat terakhir';
    const daysSince = customer.daysSince !== null ? `${customer.daysSince} hari lalu` : 'Tidak diketahui';
    const ghosted = customer.lastMessageSender === 'ai' ? ' (belum bales)' : '';

    return (
        `*Customer ${index + 1}/${total}*\n\n` +
        `📱 ${name}\n` +
        `🏍️ Motor: ${motor}\n` +
        `💬 Terakhir chat: ${daysSince}${ghosted}\n` +
        `🔧 Topik: ${topik}\n\n` +
        `Pertanyaan: *${name}* pernah servis di Bosmat sebelumnya?\n\n` +
        `Balas:\n` +
        `*1* → Pernah servis (existing/loyal)\n` +
        `*2* → Belum pernah (lead)\n` +
        `*3* → Skip customer ini`
    );
}

function formatAuditSummary(session) {
    const completed = session.completedReview || [];
    const labelCounts = {};
    for (const r of completed) {
        labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
    }

    const skipped = completed.filter(r => r.label === 'skipped').length;

    let summary = `*Audit selesai Bos!* Ringkasan:\n\n`;
    summary += `✅ Auto-labeled: ${session.autoLabeled || 0} customer\n`;
    summary += `📋 Manual review: ${completed.length} customer\n`;
    if (skipped > 0) summary += `⏭️ Di-skip: ${skipped} customer\n`;
    summary += `────────────────────────────\n`;

    for (const [label, count] of Object.entries(labelCounts)) {
        if (label !== 'skipped') {
            summary += `${label}: ${count} customer\n`;
        }
    }

    summary += `────────────────────────────\n`;
    summary += `Total: ${session.totalCustomers || 0} customer\n\n`;
    summary += `Data sudah tersimpan di Firestore.\n\n`;
    summary += `Langkah berikutnya:\n`;
    summary += `- Ketik *'generate follow up'* untuk buat daftar target follow up berdasarkan hasil audit\n`;
    summary += `- Atau langsung tanya Zoya soal customer tertentu`;

    return summary;
}

// ─── Main Flow Functions ──────────────────────────────────────────────────────

/**
 * Start audit — hanya dipanggil saat admin ketik trigger keyword.
 */
async function startAudit(adminNumber) {
    // Cek apakah ada session aktif yang belum selesai
    const existing = await getSession(adminNumber);
    if (existing && existing.status === 'paused') {
        const pending = existing.pendingReview || [];
        const idx = existing.currentIndex || 0;
        const remaining = pending.length - idx;
        return (
            `Bos, ada audit sebelumnya yang di-pause (${remaining} customer tersisa).\n\n` +
            `Ketik *'lanjut audit'* untuk lanjutkan, atau *'audit baru'* untuk mulai dari awal.`
        );
    }
    if (existing && existing.status === 'in_progress') {
        const pending = existing.pendingReview || [];
        const idx = existing.currentIndex || 0;
        const remaining = pending.length - idx;
        return `Bos, audit masih berjalan (${remaining} customer tersisa). Lanjut review ya?`;
    }

    console.log(`[Audit] Starting audit for ${adminNumber}...`);

    // Scan customer yang belum punya label
    const { autoLabeled, pendingReview } = await scanUnlabeledCustomers();

    if (autoLabeled.length === 0 && pendingReview.length === 0) {
        return `Semua customer sudah punya label, Bos. Tidak ada yang perlu diaudit. 👍`;
    }

    // Simpan auto-labels
    const savedCount = await saveAutoLabels(autoLabeled);
    console.log(`[Audit] Auto-labeled ${savedCount} customers`);

    if (pendingReview.length === 0) {
        return (
            `Audit selesai otomatis Bos!\n\n` +
            `✅ ${savedCount} customer auto-labeled.\n` +
            `Tidak ada customer yang perlu direview manual.`
        );
    }

    // Buat session
    await createSession(adminNumber, savedCount, pendingReview);

    return (
        `Siap Bos. Scan selesai!\n\n` +
        `✅ *${savedCount}* customer → auto-labeled (tidak perlu konfirmasi)\n` +
        `❓ *${pendingReview.length}* customer → butuh konfirmasi Bos\n\n` +
        `Mau mulai review ${pendingReview.length} customer ini sekarang?\n` +
        `Ketik *'mulai'* untuk lanjut, atau *'nanti'* untuk jadwal ulang.`
    );
}

/**
 * Handle setiap balasan admin dalam konteks audit.
 * Return null jika escape hatch triggered (pesan diteruskan ke getAIResponse).
 */
async function handleAuditResponse(adminNumber, userReply) {
    const reply = (userReply || '').trim().toLowerCase();

    // Escape hatch — pause dan return null untuk forward ke getAIResponse
    if (PAUSE_KEYWORDS.includes(reply)) {
        await pauseSession(adminNumber);
        return null; // Signal ke caller: forward ke getAIResponse
    }

    // Touch session (update lastActivityAt)
    await touchSession(adminNumber);

    const session = await getSession(adminNumber);
    if (!session) return null; // No active session

    // Resume jika paused
    if (session.status === 'paused') {
        await resumeSession(adminNumber);
        const pending = session.pendingReview || [];
        const idx = session.currentIndex || 0;
        const remaining = pending.length - idx;
        const card = formatCustomerCard(pending[idx], idx, pending.length);
        return `Audit dilanjutkan! Masih ada ${remaining} customer.\n\n${card}`;
    }

    const pending = session.pendingReview || [];
    const idx = session.currentIndex || 0;
    const step = session.currentStep || 'awaiting_start';

    // ─── State Machine ─────────────────────────────────────────────────

    if (step === 'awaiting_start') {
        if (reply === 'mulai' || reply === 'ya' || reply === 'lanjut' || reply === 'oke' || reply === 'ok') {
            if (pending.length === 0) {
                return `Tidak ada customer yang perlu direview, Bos!`;
            }
            await updateSessionStep(adminNumber, 'awaiting_classification');
            return formatCustomerCard(pending[idx], idx, pending.length);
        }

        if (reply === 'nanti') {
            await pauseSession(adminNumber);
            return `Oke Bos, audit di-pause. Ketik *'lanjut audit'* kapan saja untuk melanjutkan.`;
        }

        return `Balas *'mulai'* untuk review customer, atau *'nanti'* untuk pause.`;
    }

    if (step === 'awaiting_classification') {
        if (reply === '1') {
            // Pernah servis → tanya detail
            await updateSessionStep(adminNumber, 'awaiting_detail');
            const name = pending[idx]?.name || 'Customer';
            return (
                `Berapa kali kira-kira *${name}* servis di Bosmat?\n\n` +
                `*1* → Satu kali\n` +
                `*2* → Dua kali atau lebih\n` +
                `*3* → Tidak ingat`
            );
        }

        if (reply === '2') {
            // Belum pernah → label lead
            const customer = pending[idx];
            const label = 'lead';
            await saveLabelAndAdvance(adminNumber, customer, label);
            return await showNextOrFinish(adminNumber);
        }

        if (reply === '3' || reply === 'skip') {
            // Skip
            const customer = pending[idx];
            await saveLabelAndAdvance(adminNumber, customer, 'skipped');
            return await showNextOrFinish(adminNumber);
        }

        return `Bos, balas *1*, *2*, atau *3* ya.`;
    }

    if (step === 'awaiting_detail') {
        let label;
        if (reply === '1') {
            label = 'existing_customer';
        } else if (reply === '2') {
            label = 'loyal_customer';
        } else if (reply === '3') {
            label = 'existing_customer'; // tidak ingat tapi pernah servis
        } else {
            return `Bos, balas *1*, *2*, atau *3* ya.`;
        }

        const customer = pending[idx];
        await saveLabelAndAdvance(adminNumber, customer, label);
        return await showNextOrFinish(adminNumber);
    }

    return `Bos, sesi audit sedang berjalan. Balas sesuai instruksi, atau ketik *'stop audit'* untuk pause.`;
}

/**
 * Simpan label ke customerContext dan advance session.
 */
async function saveLabelAndAdvance(adminNumber, customer, label) {
    // Simpan label ke customerContext
    if (label !== 'skipped') {
        try {
            await mergeAndSaveContext(customer.docId + '@c.us', {
                customer_label: label,
                labeled_by: 'audit_manual',
                labeled_at: new Date().toISOString(),
            });
        } catch (err) {
            console.warn(`[Audit] Failed to save label for ${customer.docId}:`, err.message);
        }
    }

    // Advance session
    await advanceSession(adminNumber, { docId: customer.docId, label });
}

/**
 * Tampilkan customer berikutnya atau summary akhir.
 */
async function showNextOrFinish(adminNumber) {
    const session = await getSession(adminNumber);

    if (!session || session.status === 'completed') {
        // Ambil session terbaru untuk summary (session sudah completed)
        const db = admin.firestore();
        const docId = (adminNumber || '').replace(/[^0-9]/g, '');
        const ref = db.collection('auditSession').doc(docId);
        const doc = await ref.get();
        const finalSession = doc.exists ? doc.data() : session;
        return formatAuditSummary(finalSession);
    }

    const pending = session.pendingReview || [];
    const idx = session.currentIndex || 0;

    if (idx >= pending.length) {
        return formatAuditSummary(session);
    }

    const prevCustomer = pending[idx - 1];
    const prevLabel = session.completedReview?.[session.completedReview.length - 1]?.label || '';
    const name = prevCustomer?.name || 'Customer';
    const labelText = prevLabel === 'skipped' ? 'di-skip' : prevLabel;

    await updateSessionStep(adminNumber, 'awaiting_classification');

    return (
        `✅ Noted. *${name}* → ${labelText}\n\n` +
        formatCustomerCard(pending[idx], idx, pending.length)
    );
}

/**
 * Resume audit yang di-pause.
 */
async function handleResumeAudit(adminNumber) {
    const session = await getSession(adminNumber);
    if (!session) {
        return `Tidak ada audit yang di-pause, Bos. Ketik *'audit customer'* untuk mulai baru.`;
    }

    if (session.status === 'paused') {
        await resumeSession(adminNumber);
    }

    const pending = session.pendingReview || [];
    const idx = session.currentIndex || 0;

    if (idx >= pending.length) {
        return formatAuditSummary(session);
    }

    await updateSessionStep(adminNumber, 'awaiting_classification');

    const remaining = pending.length - idx;
    return (
        `Audit dilanjutkan! Masih ada *${remaining}* customer.\n\n` +
        formatCustomerCard(pending[idx], idx, pending.length)
    );
}

module.exports = {
    startAudit,
    handleAuditResponse,
    handleResumeAudit,
    hasActiveSession,
    // Exported for testing
    scanUnlabeledCustomers,
    formatCustomerCard,
    formatAuditSummary,
};
