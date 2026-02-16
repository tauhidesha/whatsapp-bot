// File: src/ai/tools/adminLabelingTool.js
// Tool admin AI untuk bantu labeling pelanggan dan filter DM berdasarkan periode waktu.
const admin = require('firebase-admin');
const { isAdmin, ensureFirestore } = require('../utils/adminAuth.js');
const { parseSenderIdentity } = require('../../lib/utils.js');

const VALID_LABELS = [
    'hot_lead',
    'cold_lead',
    'booking_process',
    'completed',
    'general',
    'follow_up',
];

const LABEL_DISPLAY_NAMES = {
    hot_lead: 'Hot Lead 🔥',
    cold_lead: 'Cold Lead ❄️',
    booking_process: 'Booking 📅',
    completed: 'Completed ✅',
    follow_up: 'Follow Up 📞',
    general: 'General 📋',
};

// Mapping period presets ke jumlah hari
const PERIOD_MAP = {
    '1_week': 7,
    '2_weeks': 14,
    '1_month': 30,
};

const adminLabelingTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'adminLabeling',
            description:
                'KHUSUS ADMIN. Tool untuk membantu admin mengelola label pelanggan. Bisa: (1) list_leads — melihat daftar DM dengan filter waktu (1 minggu/2 minggu/1 bulan) dan filter label. (2) bulk_label — memberikan label ke beberapa pelanggan sekaligus.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['list_leads', 'bulk_label'],
                        description:
                            'Pilih "list_leads" untuk melihat daftar leads/DM dengan filter waktu dan label, atau "bulk_label" untuk memberi label ke beberapa pelanggan sekaligus.',
                    },
                    period: {
                        type: 'string',
                        enum: ['1_week', '2_weeks', '1_month'],
                        description:
                            'Filter periode waktu (untuk list_leads). "1_week" = 7 hari, "2_weeks" = 14 hari, "1_month" = 30 hari.',
                    },
                    filterLabel: {
                        type: 'string',
                        enum: VALID_LABELS,
                        description:
                            'Filter berdasarkan label tertentu (untuk list_leads). Kosongkan untuk melihat semua label.',
                    },
                    targetNumbers: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Daftar nomor WA pelanggan yang mau diberi label (untuk bulk_label). Contoh: ["6281234567890", "6289876543210"].',
                    },
                    label: {
                        type: 'string',
                        enum: VALID_LABELS,
                        description:
                            'Label yang akan diberikan (untuk bulk_label): hot_lead, cold_lead, booking_process, completed, follow_up, general.',
                    },
                    reason: {
                        type: 'string',
                        description: 'Alasan pemberian label (opsional, untuk bulk_label).',
                    },
                    senderNumber: {
                        type: 'string',
                        description: 'Nomor pengirim (otomatis diisi sistem).',
                    },
                },
                required: ['action', 'senderNumber'],
            },
        },
    },

    implementation: async (input) => {
        const {
            action,
            period,
            filterLabel,
            targetNumbers,
            label,
            reason,
            senderNumber,
        } = input;

        // 1. Security Check — ADMIN ONLY
        if (!isAdmin(senderNumber)) {
            return {
                success: false,
                message: '⛔ Akses Ditolak. Tool ini hanya untuk Admin.',
            };
        }

        const db = ensureFirestore();

        try {
            // ============================
            // ACTION: list_leads
            // ============================
            if (action === 'list_leads') {
                const days = PERIOD_MAP[period] || 7; // Default 1 minggu
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);

                // Query Firestore directMessages
                const snapshot = await db
                    .collection('directMessages')
                    .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
                    .orderBy('updatedAt', 'desc')
                    .get();

                if (snapshot.empty) {
                    const periodLabel = period
                        ? period.replace('_', ' ')
                        : `${days} hari`;
                    return {
                        success: true,
                        message: `Tidak ada DM aktif dalam ${periodLabel} terakhir.`,
                        data: [],
                    };
                }

                let conversations = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();

                    // Format sender ID
                    let senderId = data.fullSenderId || doc.id;
                    if (
                        !data.fullSenderId &&
                        /^\d{15,}$/.test(doc.id) &&
                        !doc.id.startsWith('62')
                    ) {
                        senderId = `${doc.id}@lid`;
                    }

                    conversations.push({
                        number: senderId,
                        name: data.name || 'Tanpa Nama',
                        label: data.customerLabel || null,
                        labelReason: data.labelReason || null,
                        lastMessage: data.lastMessage || '-',
                        time: data.updatedAt
                            ? data.updatedAt
                                .toDate()
                                .toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                            : '-',
                    });
                });

                // Filter by label jika ada
                if (filterLabel) {
                    conversations = conversations.filter(
                        (c) => c.label === filterLabel
                    );
                }

                if (conversations.length === 0) {
                    const periodLabel = period
                        ? period.replace('_', ' ')
                        : `${days} hari`;
                    const labelInfo = filterLabel
                        ? ` dengan label "${LABEL_DISPLAY_NAMES[filterLabel] || filterLabel}"`
                        : '';
                    return {
                        success: true,
                        message: `Tidak ada DM${labelInfo} dalam ${periodLabel} terakhir.`,
                        data: [],
                    };
                }

                // Hitung statistik label
                const labelStats = {};
                conversations.forEach((c) => {
                    const lbl = c.label || 'belum_dilabel';
                    labelStats[lbl] = (labelStats[lbl] || 0) + 1;
                });

                const statsText = Object.entries(labelStats)
                    .map(([lbl, count]) => {
                        const displayName =
                            LABEL_DISPLAY_NAMES[lbl] || lbl.replace('_', ' ');
                        return `${displayName}: ${count}`;
                    })
                    .join(', ');

                // Format output
                const periodLabel = period
                    ? period.replace('_', ' ')
                    : `${days} hari`;
                const labelInfo = filterLabel
                    ? ` (filter: ${LABEL_DISPLAY_NAMES[filterLabel] || filterLabel})`
                    : '';

                const summaryList = conversations
                    .map((c, i) => {
                        const labelBadge = c.label
                            ? ` [${LABEL_DISPLAY_NAMES[c.label] || c.label}]`
                            : ' [Belum Dilabel]';
                        return `${i + 1}. ${c.name} (${c.number})${labelBadge}\n   🕒 ${c.time}\n   💬 "${(c.lastMessage || '').substring(0, 60)}..."`;
                    })
                    .join('\n\n');

                return {
                    success: true,
                    data: conversations,
                    stats: labelStats,
                    formattedResponse: `📊 Daftar ${conversations.length} DM dalam ${periodLabel} terakhir${labelInfo}:\n\nStatistik: ${statsText}\n\n${summaryList}`,
                };
            }

            // ============================
            // ACTION: bulk_label
            // ============================
            if (action === 'bulk_label') {
                if (!label) {
                    return {
                        success: false,
                        message:
                            'Parameter "label" wajib diisi untuk bulk_label. Pilih: hot_lead, cold_lead, booking_process, completed, follow_up, general.',
                    };
                }

                if (
                    !targetNumbers ||
                    !Array.isArray(targetNumbers) ||
                    targetNumbers.length === 0
                ) {
                    return {
                        success: false,
                        message:
                            'Parameter "targetNumbers" wajib diisi dengan array nomor pelanggan.',
                    };
                }

                const results = [];
                let successCount = 0;
                let failCount = 0;

                for (const number of targetNumbers) {
                    try {
                        const { docId } = parseSenderIdentity(number);
                        if (!docId) {
                            results.push({
                                number,
                                success: false,
                                message: 'Gagal parsing nomor.',
                            });
                            failCount++;
                            continue;
                        }

                        const docRef = db.collection('directMessages').doc(docId);

                        // Cek apakah doc ada
                        const docSnapshot = await docRef.get();
                        if (!docSnapshot.exists) {
                            results.push({
                                number,
                                success: false,
                                message: 'Pelanggan tidak ditemukan di database.',
                            });
                            failCount++;
                            continue;
                        }

                        const customerName = docSnapshot.data()?.name || 'Tanpa Nama';

                        const updatePayload = {
                            customerLabel: label,
                            labelReason: reason || `Bulk label oleh admin`,
                            labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        };

                        await docRef.set(updatePayload, { merge: true });

                        // Sync ke WA jika client tersedia
                        let waSynced = false;
                        if (global.whatsappClient && global.whatsappClient.addOrRemoveLabels) {
                            try {
                                const { normalizedAddress } = parseSenderIdentity(number);
                                const whatsappNumber = normalizedAddress || number;
                                const labelName = (LABEL_DISPLAY_NAMES[label] || label).replace(/[🔥❄️📅✅📞📋]/g, '').trim();

                                // Cari atau buat label di WA
                                let labelId = null;

                                // Cek cache
                                try {
                                    const cached = await db.collection('_labelCache').doc(label).get();
                                    if (cached.exists && cached.data().labelId) {
                                        labelId = cached.data().labelId;
                                    }
                                } catch { /* non-fatal */ }

                                // Cari di WA labels
                                if (!labelId && global.whatsappClient.getAllLabels) {
                                    try {
                                        const allLabels = await global.whatsappClient.getAllLabels();
                                        const existing = allLabels.find((l) => l.name === labelName);
                                        if (existing && existing.id) {
                                            labelId = existing.id.toString();
                                        }
                                    } catch { /* non-fatal */ }
                                }

                                if (labelId) {
                                    // Remove old label if different
                                    const prevLabelId = docSnapshot.data()?.whatsappLabelId;
                                    const operations = [];
                                    if (prevLabelId && prevLabelId !== labelId) {
                                        operations.push({ labelId: prevLabelId, type: 'remove' });
                                    }
                                    operations.push({ labelId, type: 'add' });

                                    await global.whatsappClient.addOrRemoveLabels(
                                        [whatsappNumber],
                                        operations
                                    );
                                    await docRef.set({ whatsappLabelId: labelId }, { merge: true });
                                    waSynced = true;
                                }
                            } catch (waErr) {
                                console.warn(`[AdminLabeling] WA sync failed for ${number}:`, waErr.message);
                            }
                        }

                        results.push({
                            number,
                            name: customerName,
                            success: true,
                            waSynced,
                        });
                        successCount++;
                    } catch (err) {
                        results.push({
                            number,
                            success: false,
                            message: err.message,
                        });
                        failCount++;
                    }
                }

                const labelDisplay = LABEL_DISPLAY_NAMES[label] || label;
                const resultSummary = results
                    .map((r) => {
                        const waNote = r.waSynced ? ' (WA ✅)' : '';
                        if (r.success) {
                            return `✅ ${r.name || r.number}${waNote}`;
                        }
                        return `❌ ${r.number}: ${r.message}`;
                    })
                    .join('\n');

                return {
                    success: true,
                    message: `Bulk label "${labelDisplay}" selesai: ${successCount} berhasil, ${failCount} gagal.`,
                    data: results,
                    formattedResponse: `🏷️ Hasil Bulk Label → *${labelDisplay}*\n\n${resultSummary}\n\nTotal: ${successCount} berhasil, ${failCount} gagal.`,
                };
            }

            return { success: false, message: 'Action tidak dikenali. Gunakan "list_leads" atau "bulk_label".' };
        } catch (error) {
            console.error('[adminLabelingTool] Error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan.',
            };
        }
    },
};

module.exports = { adminLabelingTool };
