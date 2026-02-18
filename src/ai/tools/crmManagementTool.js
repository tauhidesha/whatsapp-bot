// File: src/ai/tools/crmManagementTool.js
const admin = require('firebase-admin');
const { isAdmin, ensureFirestore } = require('../utils/adminAuth.js');
const { parseSenderIdentity } = require('../../lib/utils.js');
const {
    VALID_LABELS,
    LABEL_DISPLAY_NAMES,
    ensureWhatsAppLabel,
    assignWhatsAppLabel
} = require('../../lib/whatsappLabelUtils.js');

/**
 * Tool CRM Komprehensif untuk AI Admin (Zoya).
 * Memberikan analytics, deep dive pelanggan, manajemen leads, dan bulk operations.
 */
const crmManagementTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'crmManagement',
            description: 'KHUSUS ADMIN. Tool CRM untuk (1) crm_summary: analytics, (2) customer_deep_dive: riwayat 360, (3) find_followup: cari target jemput bola, (4) bulk_label: label massal, (5) update_notes: catatan internal.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['crm_summary', 'customer_deep_dive', 'find_followup', 'bulk_label', 'update_notes'],
                        description: 'Aksi CRM yang ingin dijalankan.',
                    },
                    targetPhone: {
                        type: 'string',
                        description: 'Nomor WhatsApp pelanggan (wajib untuk customer_deep_dive & update_notes).',
                    },
                    targetNumbers: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Daftar nomor untuk bulk_label.',
                    },
                    label: {
                        type: 'string',
                        enum: VALID_LABELS,
                        description: 'Label untuk bulk_label.',
                    },
                    notes: {
                        type: 'string',
                        description: 'Catatan internal untuk pelanggan (wajib untuk update_notes).',
                    },
                    reason: {
                        type: 'string',
                        description: 'Alasan pemberian label (untuk bulk_label).',
                    },
                    daysLookback: {
                        type: 'number',
                        description: 'Jumlah hari ke belakang (default 30).',
                    },
                    senderNumber: {
                        type: 'string',
                        description: 'Nomor pengirim (otomatis).',
                    },
                },
                required: ['action', 'senderNumber'],
            },
        },
    },

    implementation: async (input) => {
        const {
            action,
            targetPhone,
            targetNumbers,
            label,
            notes,
            reason,
            daysLookback = 30,
            senderNumber
        } = input;

        if (!isAdmin(senderNumber)) {
            return { success: false, message: '⛔ Akses Ditolak.' };
        }

        const db = ensureFirestore();

        try {
            switch (action) {
                case 'crm_summary':
                    return await handleCrmSummary(db, daysLookback);
                case 'customer_deep_dive':
                    return await handleCustomerDeepDive(db, targetPhone);
                case 'find_followup':
                    return await handleFindFollowup(db);
                case 'bulk_label':
                    return await handleBulkLabel(db, targetNumbers, label, reason);
                case 'update_notes':
                    return await handleUpdateNotes(db, targetPhone, notes);
                default:
                    return { success: false, message: 'Aksi tidak dikenal.' };
            }
        } catch (error) {
            console.error('[crmManagementTool] Error:', error);
            return { success: false, message: `Error: ${error.message}` };
        }
    },
};

/**
 * 📊 Laporan Summary CRM
 */
async function handleCrmSummary(db, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

    const dmSnapshot = await db.collection('directMessages')
        .where('updatedAt', '>=', cutoffTs)
        .get();

    const stats = { total_leads: dmSnapshot.size, hot: 0, cold: 0, booking: 0, completed: 0, follow_up: 0, unlabeled: 0 };
    dmSnapshot.forEach(doc => {
        const l = doc.data().customerLabel;
        if (l && stats[l] !== undefined) stats[l]++;
        else if (l === 'booking_process') stats.booking++;
        else if (!l) stats.unlabeled++;
    });

    const bookingSnapshot = await db.collection('bookings').where('createdAt', '>=', cutoffTs).get();
    const transSnapshot = await db.collection('transactions').where('type', '==', 'income').where('date', '>=', cutoffTs).get();

    let totalRevenue = 0;
    transSnapshot.forEach(doc => totalRevenue += (doc.data().amount || 0));
    const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

    return {
        success: true,
        formattedResponse: [
            `📊 *CRM Summary (${days} Hari Terakhir)*`,
            `--------------------------------`,
            `📈 *Pipeline Leads:*`,
            `- Total Leads: ${stats.total_leads}`,
            `- 🔥 Hot: ${stats.hot}, 🧊 Cold: ${stats.cold}`,
            `- ⏳ Follow Up: ${stats.follow_up}, 📅 Booking: ${stats.booking}`,
            ``,
            `💰 *Performance:*`,
            `- Booking Dibuat: ${bookingSnapshot.size}`,
            `- Total Pemasukan: *${formatIDR(totalRevenue)}*`,
            `--------------------------------`,
            `💡 *Insight:* Konversi: ${stats.total_leads ? ((bookingSnapshot.size / stats.total_leads) * 100).toFixed(1) : 0}%`
        ].join('\n')
    };
}

/**
 * 🔍 Deep Dive Pelanggan
 */
async function handleCustomerDeepDive(db, phone) {
    if (!phone) return { success: false, message: 'Nomor telepon wajib diisi.' };
    const { docId, normalizedAddress } = parseSenderIdentity(phone);
    const docRef = db.collection('directMessages').doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) return { success: false, message: 'Data pelanggan tidak ditemukan.' };

    const data = doc.data();
    const bookings = await db.collection('bookings').where('customerPhoneNormalized', '==', normalizedAddress).orderBy('bookingDateTime', 'desc').limit(5).get();
    let bList = [];
    bookings.forEach(b => {
        const d = b.data();
        bList.push(`- ${d.bookingDate}: ${d.services?.join(', ')} (${d.status})`);
    });

    const msgs = await docRef.collection('messages').orderBy('timestamp', 'desc').limit(3).get();
    let rChats = [];
    msgs.forEach(m => rChats.push(`> ${m.data().text.substring(0, 50)}...`));

    return {
        success: true,
        formattedResponse: [
            `👤 *Profil CRM: ${data.name || 'User'}*`,
            `📱 No: ${normalizedAddress}`,
            `🏷️ Label: *${LABEL_DISPLAY_NAMES[data.customerLabel] || 'Belum Ada'}*`,
            `📝 Notes: ${data.adminNotes || '-'}`,
            ``,
            `📅 *5 Booking Terakhir:*`,
            bList.length ? bList.join('\n') : '- Belum ada riwayat',
            ``,
            `💬 *Chat Terakhir:*`,
            rChats.reverse().join('\n')
        ].join('\n')
    };
}

/**
 * 🕵️ Find Follow-up (Jemput Bola)
 */
async function handleFindFollowup(db) {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const snapshot = await db.collection('directMessages').where('customerLabel', 'in', ['hot_lead', 'cold_lead', 'follow_up', 'completed']).get();
    const candidates = [];

    snapshot.forEach(doc => {
        const d = doc.data();
        const l = d.customerLabel;
        let lastAct = (d.labelUpdatedAt || d.updatedAt || d.lastMessageAt)?.toDate();
        if (!lastAct) return;

        let cat = null, strat = null;
        if (l === 'hot_lead' && lastAct < twelveHoursAgo) {
            cat = '🔥 Hot Lead (PRIORITAS)';
            strat = 'Segera follow up, tawarkan slot/promo eksklusif.';
        } else if (l === 'cold_lead' && lastAct < oneDayAgo) {
            cat = '🧊 Cold Lead';
            strat = 'Sapa kembali, tawarkan bantuan/info promo.';
        } else if (l === 'follow_up' && lastAct < oneDayAgo) {
            cat = '⏳ Pending/Follow-Up';
            strat = 'Ingatkan janji halus, tanyakan kendalanya apa.';
        } else if (l === 'completed' && lastAct < ninetyDaysAgo) {
            cat = '💎 Loyal (Retention)';
            strat = 'Tawarkan perawatan ulang (Maintenance/Coating).';
        }

        if (cat) candidates.push({ name: d.name || doc.id, number: d.senderNumber || doc.id, cat, strat, days: Math.floor((now - lastAct) / 86400000) });
    });

    if (!candidates.length) return { success: true, message: 'Tidak ada kandidat follow-up yang memenuhi kriteria waktu saat ini.' };

    const list = candidates.map((c, i) => `${i + 1}. ${c.name} (${c.number})\n   Kategori: ${c.cat} (${c.days} hari)\n   Tips: ${c.strat}`).join('\n\n');
    return { success: true, formattedResponse: `🕵️ *Target Jemput Bola (${candidates.length} orang):*\n\n${list}` };
}

/**
 * 🏷️ Bulk Labeling
 */
async function handleBulkLabel(db, targetNumbers, label, reason) {
    if (!label || !targetNumbers || !targetNumbers.length) return { success: false, message: 'Label dan daftar nomor wajib diisi.' };

    let waLabelId = null;
    if (global.whatsappClient) {
        try {
            const waLabel = await ensureWhatsAppLabel(global.whatsappClient, db, label);
            waLabelId = waLabel?.id;
        } catch (e) {
            console.warn('[CRM] WA Label Error:', e.message);
        }
    }

    let success = 0, fail = 0;
    for (const num of targetNumbers) {
        try {
            const { docId, normalizedAddress } = parseSenderIdentity(num);
            const docRef = db.collection('directMessages').doc(docId);
            const doc = await docRef.get();
            if (!doc.exists) { fail++; continue; }

            const prevLabelId = doc.data()?.whatsappLabelId;
            await docRef.set({ customerLabel: label, labelReason: reason || 'Bulk CRM', labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

            if (global.whatsappClient && waLabelId) await assignWhatsAppLabel(global.whatsappClient, db, normalizedAddress || num, docId, waLabelId, prevLabelId);
            success++;
        } catch (e) { fail++; }
    }

    return { success: true, formattedResponse: `✅ Bulk Label *${LABEL_DISPLAY_NAMES[label] || label}* Selesai!\n- Berhasil: ${success}\n- Gagal: ${fail}` };
}

/**
 * 📝 Update Catatan Internal
 */
async function handleUpdateNotes(db, phone, notes) {
    if (!phone || !notes) return { success: false, message: 'Nomor dan Catatan wajib diisi.' };
    const { docId } = parseSenderIdentity(phone);
    await db.collection('directMessages').doc(docId).set({ adminNotes: notes, notesUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { success: true, message: `Notes berhasil diperbarui.` };
}

module.exports = { crmManagementTool };
