// File: src/ai/tools/crmManagementTool.js
const prisma = require('../../lib/prisma.js');
const { isAdmin } = require('../utils/adminAuth.js');
const { parseSenderIdentity } = require('../../lib/utils.js');
const {
    VALID_LABELS,
    LABEL_DISPLAY_NAMES,
    assignWhatsAppLabel
} = require('../../lib/whatsappLabelUtils.js');
const { traceable } = require('../utils/langsmith.js');
const { markBotMessage } = require('../utils/adminMessageSync.js');

/**
 * Tool CRM Komprehensif untuk AI Admin (Zoya) menggunakan PostgreSQL via Prisma.
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

        try {
            switch (action) {
                case 'crm_summary':
                    return await handleCrmSummary(daysLookback);
                case 'customer_deep_dive':
                    return await handleCustomerDeepDive(targetPhone);
                case 'find_followup':
                    return await handleFindFollowup(true);
                case 'execute_followup':
                    return await handleExecuteFollowup();
                case 'bulk_label':
                    return await handleBulkLabel(targetNumbers, label, reason);
                case 'update_notes':
                    return await handleUpdateNotes(targetPhone, notes);
                default:
                    return { success: false, message: 'Aksi tidak dikenal.' };
            }
        } catch (error) {
            console.error('[crmManagementTool] SQL Error:', error);
            return { success: false, message: `SQL Error: ${error.message}` };
        }
    }, { name: "crmManagementTool" }),
};

async function handleCrmSummary(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const [totalLeads, labelStats, bookingsCount, totalRevenue] = await Promise.all([
        prisma.customer.count({ where: { updatedAt: { gte: cutoff } } }),
        prisma.customer.groupBy({
            by: ['status'],
            where: { updatedAt: { gte: cutoff } },
            _count: { _all: true }
        }),
        prisma.booking.count({ where: { createdAt: { gte: cutoff } } }),
        prisma.transaction.aggregate({
            where: { 
                status: { in: ['PAID', 'SUCCESS'] }, 
                createdAt: { gte: cutoff } 
            },
            _sum: { amount: true }
        })
    ]);

    const stats = { hot: 0, cold: 0, booking: 0, completed: 0, follow_up: 0, unlabeled: 0 };
    labelStats.forEach(s => {
        if (stats[s.status] !== undefined) stats[s.status] = s._count._all;
        else stats.unlabeled += s._count._all;
    });

    const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

    return {
        success: true,
        formattedResponse: [
            `📊 *CRM SQL Summary (${days} Hari Terakhir)*`,
            `📈 *Pipeline Leads:*`,
            `- Total Leads Aktif: ${totalLeads}`,
            `- 🔥 Hot: ${stats.hot}, 🧊 Cold: ${stats.cold}`,
            `- ⏳ Follow Up: ${stats.follow_up}, 📅 Booking: ${stats.booking}`,
            ``,
            `💰 *Performance:*`,
            `- Booking Baru: ${bookingsCount}`,
            `- Omzet Lunas: *${formatIDR(totalRevenue._sum.amount)}*`,
        ].join('\n')
    };
}

async function handleCustomerDeepDive(phone) {
    if (!phone) return { success: false, message: 'Nomor telepon wajib diisi.' };
    const { getIdentifier } = require('../utils/humanHandover.js');
    const identifier = getIdentifier(phone) || phone;
    const docId = identifier.replace(/@c\.us$|@lid$/, '');
    
    const customer = await prisma.customer.findFirst({
        where: {
            OR: [
                { phone: docId },
                { whatsappLid: identifier }
            ]
        },
        include: {
            bookings: {
                orderBy: { bookingDate: 'desc' },
                take: 5
            },
            vehicles: true
        }
    });

    if (!customer) return { success: false, message: 'Data pelanggan tidak ditemukan di SQL.' };

    const bList = customer.bookings.map(d => {
        const date = d.bookingDate.toISOString().split('T')[0];
        return `- ${date}: ${d.serviceType} (${d.status})`;
    });

    const vList = customer.vehicles.map(v => `- ${v.modelName} (${v.plateNumber || 'No Plate'})`);

    return {
        success: true,
        formattedResponse: [
            `👤 *Profil CRM: ${customer.name || 'User'}*`,
            `📱 No: ${customer.phone}`,
            `🏷️ Status: *${customer.status.toUpperCase()}*`,
            `📝 Notes: ${customer.notes || '-'}`,
            `💰 Total Spending: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(customer.totalSpending)}`,
            ``,
            `🏍️ *Koleksi Kendaraan:*`,
            vList.length ? vList.join('\n') : '- Belum terdata',
            ``,
            `📅 *5 Booking Terakhir:*`,
            bList.length ? bList.join('\n') : '- Belum ada riwayat',
        ].join('\n')
    };
}

// Dummy for personalized draft, original function can be kept or simplified
async function generatePersonalizedDraft(name, label) {
    return `Halo ${name}, ada yang bisa Zoya bantu lagi terkait layanan ${label} BosMat?`;
}

async function handleFindFollowup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1); // Followup item from 24h ago

    const candidates = await prisma.customer.findMany({
        where: {
            status: { in: ['hot', 'follow_up'] },
            updatedAt: { lte: cutoff }
        },
        take: 10
    });

    if (candidates.length === 0) return { success: true, message: 'Tidak ada kandidat follow-up di SQL saat ini.' };

    const queueItems = await Promise.all(candidates.map(async (c) => {
        const draft = await generatePersonalizedDraft(c.name || 'Pelanggan', c.status);
        return { name: c.name, number: c.phone, cat: c.status, draft };
    }));

    // Simpan ke KeyValueStore sebagai queue
    await prisma.keyValueStore.upsert({
        where: { collection_key: { collection: 'settings', key: 'followup_queue' } },
        update: { value: { items: queueItems, updatedAt: new Date().toISOString() } },
        create: {
            collection: 'settings',
            key: 'followup_queue',
            value: { items: queueItems, updatedAt: new Date().toISOString() }
        }
    });

    const list = queueItems.map((c, i) => `${i + 1}. *${c.name}* (${c.cat})\n   📝 Draft: "${c.draft}"`).join('\n\n');
    return {
        success: true,
        formattedResponse: `🕵️ *Target SQL Follow-up (${queueItems.length} orang):*\n\n${list}\n\n💡 *Balas "acc follow up" untuk eksekusi via WhatsApp.*`
    };
}

async function handleExecuteFollowup() {
    const queueRow = await prisma.keyValueStore.findUnique({
        where: { collection_key: { collection: 'settings', key: 'followup_queue' } }
    });

    if (!queueRow || !queueRow.value?.items?.length) {
        return { success: false, message: 'Queue follow-up SQL kosong.' };
    }

    const { items } = queueRow.value;
    const client = global.whatsappClient;
    if (!client) return { success: false, message: 'Koneksi WhatsApp belum siap.' };

    let successCount = 0;
    for (const item of items) {
        try {
            let target = item.number.includes('@') ? item.number : `${item.number}@c.us`;
            // Mark before sending so onAnyMessage doesn't treat it as admin-from-HP
            markBotMessage(target, item.draft);
            
            try {
                await client.sendText(target, item.draft);
            } catch (initialError) {
                if (initialError.message && initialError.message.includes('No LID')) {
                    console.warn(`[CRM] Send failed with No LID for: ${target}`);
                    const cleanPhone = target.replace(/@c\.us$|@lid$/, '');
                    const customerFallback = await prisma.customer.findFirst({
                        where: {
                            OR: [
                                { whatsappLid: target },
                                { whatsappLid: cleanPhone },
                                { phone: target },
                                { phone: cleanPhone }
                            ]
                        },
                        select: { phone: true, whatsappLid: true }
                    });

                    let fallbackTarget = null;
                    if (target.endsWith('@c.us') && customerFallback?.whatsappLid) {
                        fallbackTarget = customerFallback.whatsappLid;
                    } else if (target.endsWith('@lid') && customerFallback?.phone) {
                        fallbackTarget = customerFallback.phone.includes('@') ? customerFallback.phone : `${customerFallback.phone}@c.us`;
                    }

                    // Brute-force flip if DB had no distinct alternative
                    if (!fallbackTarget || fallbackTarget === target) {
                        const rawDigits = cleanPhone.replace(/\D/g, '');
                        if (target.endsWith('@c.us')) {
                            fallbackTarget = `${rawDigits}@lid`;
                        } else if (target.endsWith('@lid')) {
                            fallbackTarget = `${rawDigits}@c.us`;
                        }
                        console.log(`[CRM] DB had no distinct alt, brute-force flip: ${fallbackTarget}`);
                    }

                    if (fallbackTarget && fallbackTarget !== target) {
                        console.log(`[CRM] Retrying with fallback: ${fallbackTarget}`);
                        markBotMessage(fallbackTarget, item.draft);
                        await client.sendText(fallbackTarget, item.draft);
                    } else {
                        throw initialError;
                    }
                } else {
                    throw initialError;
                }
            }
            successCount++;
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`[CRM] Gagal SQL follow up ke ${item.number}:`, e.message);
        }
    }

    await prisma.keyValueStore.update({
        where: { collection_key: { collection: 'settings', key: 'followup_queue' } },
        data: { value: { items: [], updatedAt: new Date().toISOString() } }
    });

    return {
        success: true,
        formattedResponse: `✅ *Eksekusi SQL Selesai!* Berhasil mengirim ${successCount} pesan. Queue dibersihkan.`
    };
}

async function handleBulkLabel(targetNumbers, label, reason) {
    if (!label || !targetNumbers?.length) return { success: false, message: 'Label/nomor wajib.' };
    
    let success = 0;
    for (const num of targetNumbers) {
        try {
            const { getIdentifier } = require('../utils/humanHandover.js');
            const identifier = getIdentifier(num) || num;
            const docId = identifier.replace(/@c\.us$|@lid$/, '');
            
            await prisma.customer.updateMany({
                where: {
                    OR: [
                        { phone: docId },
                        { whatsappLid: identifier }
                    ]
                },
                data: { 
                    status: label,
                    notes: reason ? { append: `\n[BulkLabel] ${reason}` } : undefined
                }
            });
            success++;
        } catch (e) { }
    }
    return { success: true, formattedResponse: `✅ Bulk SQL Label *${label}* Selesai! (${success}/${targetNumbers.length})` };
}

async function handleUpdateNotes(phone, notes) {
    if (!phone || !notes) return { success: false, message: 'Nomor/Catatan wajib.' };
    const { getIdentifier } = require('../utils/humanHandover.js');
    const identifier = getIdentifier(phone) || phone;
    const docId = identifier.replace(/@c\.us$|@lid$/, '');

    await prisma.customer.updateMany({
        where: {
            OR: [
                { phone: docId },
                { whatsappLid: identifier }
            ]
        },
        data: { notes, updatedAt: new Date() }
    });
    return { success: true, message: `Notes SQL berhasil diperbarui.` };
}

module.exports = { crmManagementTool };
