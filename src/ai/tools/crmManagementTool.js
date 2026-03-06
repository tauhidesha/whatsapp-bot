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
const { generateFollowUpMessage } = require('../agents/followUpEngine/messageGenerator.js');

// getCustomerChatHistory — previously in followupPersonalizer.js, inlined here for CRM tool
async function getCustomerChatHistory(db, docId, limit = 5) {
    try {
        const snapshot = await db.collection('directMessages')
            .doc(docId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        const messages = [];
        snapshot.forEach(doc => messages.push(doc.data()));
        return messages.reverse();
    } catch (error) {
        console.error(`[CRM] Failed to fetch history for ${docId}:`, error.message);
        return [];
    }
}

// Wrapper to keep CRM tool's generatePersonalizedDraft interface working
async function generatePersonalizedDraft(name, label, chatHistory) {
    const historyText = chatHistory
        .map(m => `${m.sender === 'user' ? 'Customer' : 'AI'}: ${m.text}`)
        .join('\n');

    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return `Halo ${name}, ada yang bisa Zoya bantu lagi?`;

    const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        apiKey,
    });

    const prompt = `Buat 1 kalimat sapaan follow-up pendek (maks 20 kata) untuk "${name}" (${label}).
Riwayat: ${historyText || '(kosong)'}
Panggil "Mas/Mbak". Santai. Langsung teks, tanpa placeholder.`;

    try {
        const response = await model.invoke(prompt);
        return response.content.trim().replace(/^"(.*)"$/, '$1');
    } catch (err) {
        return `Halo ${name}, ada yang bisa Zoya bantu lagi?`;
    }
}

const { traceable } = require('../utils/langsmith.js');

/**
 * Tool CRM Komprehensif untuk AI Admin (Zoya).
 */
const crmManagementTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'crmManagement',
            description: 'CRM admin: crm_summary, customer_deep_dive, find_followup, execute_followup, bulk_label, update_notes.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['crm_summary', 'customer_deep_dive', 'find_followup', 'execute_followup', 'bulk_label', 'update_notes'],
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

    implementation: traceable(async (input) => {
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
                    return await handleFindFollowup(db, true); // true = save to queue
                case 'execute_followup':
                    return await handleExecuteFollowup(db);
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
    }, { name: "crmManagementTool" }),
};

/**
 * 📊 Laporan Summary CRM
 */
async function handleCrmSummary(db, days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

    const dmSnapshot = await db.collection('directMessages').where('updatedAt', '>=', cutoffTs).get();
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
            `📈 *Pipeline Leads:*`,
            `- Total Leads: ${stats.total_leads}`,
            `- 🔥 Hot: ${stats.hot}, 🧊 Cold: ${stats.cold}`,
            `- ⏳ Follow Up: ${stats.follow_up}, 📅 Booking: ${stats.booking}`,
            ``,
            `💰 *Performance:*`,
            `- Booking Dibuat: ${bookingSnapshot.size}`,
            `- Total Pemasukan: *${formatIDR(totalRevenue)}*`,
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
        ].join('\n')
    };
}

/**
 * 🕵️ Find Follow-up (Jemput Bola) & Draft Report
 */
async function handleFindFollowup(db, saveToQueue = false) {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const snapshot = await db.collection('directMessages').where('customerLabel', 'in', ['hot_lead', 'cold_lead', 'follow_up', 'completed']).get();
    const candidates = [];
    const queueItems = [];

    // Filter kandidat awal
    const targetGroups = [];
    snapshot.forEach(doc => {
        const d = doc.data();
        const l = d.customerLabel;
        const name = d.name || 'Mas';
        let lastAct = (d.labelUpdatedAt || d.updatedAt || d.lastMessageAt)?.toDate();
        if (!lastAct) return;

        let cat = null;
        if (l === 'hot_lead' && lastAct < twelveHoursAgo) cat = '🔥 Hot Lead';
        else if (l === 'cold_lead' && lastAct < oneDayAgo) cat = '🧊 Cold Lead';
        else if (l === 'follow_up' && lastAct < oneDayAgo) cat = '⏳ Pending';
        else if (l === 'completed' && lastAct < ninetyDaysAgo) cat = '💎 Loyal';

        if (cat) {
            targetGroups.push({
                docId: doc.id,
                name,
                label: l,
                cat,
                fullSenderId: d.fullSenderId || d.senderNumber || doc.id
            });
        }
    });

    if (targetGroups.length === 0) return { success: true, message: 'Tidak ada kandidat follow-up harian.' };

    // Proses personalisasi secara paralel (tapi terbatas biar nggak rate-limit)
    const BATCH_SIZE = 5;
    for (let i = 0; i < targetGroups.length; i += BATCH_SIZE) {
        const batch = targetGroups.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (tg) => {
            const history = await getCustomerChatHistory(db, tg.docId);
            const personalizedDraft = await generatePersonalizedDraft(tg.name, tg.cat, history);

            candidates.push({ name: tg.name, number: tg.fullSenderId, cat: tg.cat, draft: personalizedDraft });
            queueItems.push({
                targetPhone: tg.fullSenderId,
                name: tg.name,
                message: personalizedDraft,
                category: tg.cat
            });
        }));
    }

    if (saveToQueue && queueItems.length > 0) {
        await db.collection('settings').doc('followup_queue').set({
            items: queueItems,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    if (!candidates.length) return { success: true, message: 'Tidak ada kandidat follow-up harian.' };

    const list = candidates.map((c, i) => `${i + 1}. *${c.name}* (${c.cat})\n   📝 Draft: "${c.draft}"`).join('\n\n');
    return {
        success: true,
        data: queueItems,
        formattedResponse: `🕵️ *Target Jemput Bola Pagi Ini (${candidates.length} orang):*\n\n${list}\n\n💡 *Balas "acc follow up" atau "gas pol" untuk kirim semua pesan di atas.*`
    };
}

/**
 * 🚀 Execute Follow-up (Mass Send)
 */
async function handleExecuteFollowup(db) {
    const queueDoc = await db.collection('settings').doc('followup_queue').get();
    if (!queueDoc.exists || !queueDoc.data().items || queueDoc.data().items.length === 0) {
        return { success: false, message: 'Queue follow-up kosong atau tidak ditemukan. Scan dulu Bos!' };
    }

    const { items } = queueDoc.data();
    const client = global.whatsappClient;
    if (!client) return { success: false, message: 'Koneksi WhatsApp belum siap.' };

    let successCount = 0;
    for (const item of items) {
        try {
            await client.sendText(item.targetPhone, item.message);
            successCount++;
            // Sedikit delay agar tidak dianggap spam
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.error(`[CRM] Gagal kirim follow up ke ${item.targetPhone}:`, e.message);
        }
    }

    // Clear queue
    await db.collection('settings').doc('followup_queue').update({ items: [] });

    return {
        success: true,
        formattedResponse: `✅ *Eksekusi Selesai!* Berhasil mengirim ${successCount} dari ${items.length} pesan follow-up. Database queue sudah dibersihkan.`
    };
}

/**
 * 🏷️ Bulk Labeling
 */
async function handleBulkLabel(db, targetNumbers, label, reason) {
    if (!label || !targetNumbers || !targetNumbers.length) return { success: false, message: 'Label dan nomor wajib diisi.' };
    let waLabelId = null;
    if (global.whatsappClient) {
        try {
            const waLabel = await ensureWhatsAppLabel(global.whatsappClient, db, label);
            waLabelId = waLabel?.id;
        } catch (e) { }
    }

    let success = 0;
    for (const num of targetNumbers) {
        try {
            const { docId, normalizedAddress } = parseSenderIdentity(num);
            const docRef = db.collection('directMessages').doc(docId);
            const doc = await docRef.get();
            if (!doc.exists) continue;
            const prevLabelId = doc.data()?.whatsappLabelId;
            await docRef.set({ customerLabel: label, labelReason: reason || 'Bulk CRM', labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            if (global.whatsappClient && waLabelId) await assignWhatsAppLabel(global.whatsappClient, db, normalizedAddress || num, docId, waLabelId, prevLabelId);
            success++;
        } catch (e) { }
    }
    return { success: true, formattedResponse: `✅ Bulk Label *${LABEL_DISPLAY_NAMES[label] || label}* Selesai! (${success}/${targetNumbers.length} Berhasil)` };
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

module.exports = { crmManagementTool, handleFindFollowup };
