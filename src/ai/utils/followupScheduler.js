// File: src/ai/utils/followupScheduler.js
const { DateTime } = require('luxon');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { handleFindFollowup } = require('../tools/crmManagementTool.js');

const FOLLOWUP_ENABLED = process.env.FOLLOWUP_SCHEDULER_ENABLED !== 'false';
const FOLLOWUP_HOUR = 8; // Selalu jam 8 pagi
const FOLLOWUP_MINUTE = 0;
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';
const ADMIN_NUMBER = process.env.BOSMAT_ADMIN_NUMBER;

let followupIntervalHandle = null;

function ensureFirestore() {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    return getFirebaseAdmin().firestore();
}

async function sendDailyFollowupReport(force = false) {
    if (!FOLLOWUP_ENABLED || !ADMIN_NUMBER) return;

    const now = DateTime.now().setZone(TIMEZONE);
    // Reaksi normal: hanya jam 8:00 - 8:15
    if (!force && (now.hour !== FOLLOWUP_HOUR || now.minute >= 15)) return;

    console.log(`[followupScheduler] Memicu laporan follow-up harian jam ${FOLLOWUP_HOUR}:00`);

    const client = global.whatsappClient;
    if (!client || typeof client.sendText !== 'function') {
        console.warn('[followupScheduler] whatsappClient belum tersedia, report ditunda');
        return;
    }

    const firestore = ensureFirestore();

    try {
        // Jalankan logika find_followup dan simpan ke queue
        const result = await handleFindFollowup(firestore, true);

        if (result.success && result.formattedResponse) {
            const reportMessage = [
                `Selamat pagi Bos! 👋`,
                `Ini laporan target jemput bola (follow-up) hari ini.`,
                ``,
                result.formattedResponse
            ].join('\n');

            await client.sendText(`${ADMIN_NUMBER}@c.us`, reportMessage);
            console.log('[followupScheduler] Laporan follow-up berhasil dikirim ke Admin');
        }
    } catch (error) {
        console.error('[followupScheduler] Error saat generate report:', error);
    }
}

function startFollowupScheduler() {
    if (!FOLLOWUP_ENABLED) {
        console.log('[followupScheduler] Scheduler follow-up dimatikan (FOLLOWUP_SCHEDULER_ENABLED=false)');
        return;
    }

    if (followupIntervalHandle) return;

    // Cek setiap 15 menit
    const intervalMs = 15 * 60 * 1000;
    followupIntervalHandle = setInterval(() => {
        sendDailyFollowupReport().catch(error => {
            console.error('[followupScheduler] Error execution:', error);
        });
    }, intervalMs);

    console.log(`[followupScheduler] Scheduler dimulai. Monitoring setiap 15 menit untuk jam ${FOLLOWUP_HOUR}:00 ${TIMEZONE}`);

    // Run initial check (force true agar tetap lapor meski server baru nyala lewat jam 8)
    sendDailyFollowupReport(true).catch(error => {
        console.error('[followupScheduler] Initial run error:', error);
    });
}

module.exports = { startFollowupScheduler };
