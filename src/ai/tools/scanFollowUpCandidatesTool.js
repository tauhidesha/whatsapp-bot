
const { z } = require('zod');
const { ensureFirestore } = require('../utils/adminAuth.js');
const {
    parseSenderIdentity,
    toSenderNumberWithSuffix
} = require('../../lib/utils.js');

const scanFollowUpSchema = z.object({}); // No input needed, but good practice to have schema

const scanFollowUpCandidatesTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'scanFollowUpCandidates',
            description: 'Memindai database percakapan untuk mencari pelanggan yang perlu di-follow up berdasarkan kriteria: Hot Lead (>12 jam, PRIORITAS), Cold Lead (>24 jam), Follow Up (>24 jam), dan Retention/Completed (>90 hari).',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    implementation: async () => {
        try {
            const db = ensureFirestore();
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

            // We can't easily do OR queries across different fields/conditions in Firestore in one go.
            // Strategy: Fetch candidates by label, then filter by date in memory. 
            // This is efficient enough for typical SME volume. 
            // If volume is huge, we'd need compound indexes or separate queries.

            const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

            const labelsOfInterest = ['hot_lead', 'cold_lead', 'follow_up', 'completed'];
            const snapshot = await db.collection('directMessages')
                .where('customerLabel', 'in', labelsOfInterest)
                .get();

            if (snapshot.empty) {
                return 'Tidak ada kandidat follow-up saat ini (0 percakapan dengan label relevan).';
            }

            const candidates = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const label = data.customerLabel;

                // Determine "Last Interaction": specific labelUpdatedAt or generic updatedAt
                // Ideally use labelUpdatedAt because that's when we defined the status
                // But fallback to updatedAt or lastMessageAt
                let lastActivity = data.labelUpdatedAt ? data.labelUpdatedAt.toDate() : null;
                if (!lastActivity && data.updatedAt) lastActivity = data.updatedAt.toDate();
                if (!lastActivity && data.lastMessageAt) lastActivity = data.lastMessageAt.toDate();

                if (!lastActivity) return; // Skip if no time reference

                let category = null;
                let strategy = null;

                // 0. Hot Lead (> 12 hours) - PRIORITAS TERTINGGI, paling dekat closing!
                if (label === 'hot_lead' && lastActivity < twelveHoursAgo) {
                    category = '🔥 Hot Lead (Prospek Tinggi)';
                    strategy = 'PRIORITAS! Segera follow up, tawarkan slot/promo eksklusif. Mereka sudah minat tinggal di-push dikit.';
                }
                // 1. Cold Lead (> 24 hours)
                else if (label === 'cold_lead' && lastActivity < oneDayAgo) {
                    category = '👻 The Ghost (Cold Lead)';
                    strategy = 'Pancing respon ("Say Hello"), tawarkan slot terbatas.';
                }
                // 2. Follow Up (> 24 hours)
                // Check if there is a specific 'followUpDate' field (future implementation), 
                // for now use 24h rule as per plan.
                else if (label === 'follow_up' && lastActivity < oneDayAgo) {
                    category = '⏳ The Pending (Janji/Ragu)';
                    strategy = 'Ingatkan janji secara halus, tawarkan bantuan/diskon kecil.';
                }
                // 3. Retention (> 90 days)
                else if (label === 'completed' && lastActivity < ninetyDaysAgo) {
                    category = 'The Retention (Loyal)';
                    strategy = 'Tawarkan perawatan ulang (Maintenance/Coating).';
                }

                if (category) {
                    candidates.push({
                        name: data.name || data.pushName || 'Pelanggan',
                        number: data.senderNumber || doc.id,
                        label: label,
                        category: category,
                        lastActivity: lastActivity.toISOString(),
                        daysSince: Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24)) + ' hari',
                        suggestedStrategy: strategy
                    });
                }
            });

            if (candidates.length === 0) {
                return 'Scan selesai. Tidak ditemukan kandidat yang memenuhi kriteria waktu (Cold/FollowUp > 24jam, Completed > 90hari).';
            }

            // Sort by days waiting (descending) - priority to those waiting longest? 
            // Or maybe mixed. Let's sort by Category first then Days.
            candidates.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                return b.lastActivity.localeCompare(a.lastActivity); // Newest activity first? Or oldest?
                // Let's do oldest first (longest wait) for 'cold_lead'/'follow_up'
                // For 'completed', also oldest first means they are most due for maintenance.
                // So Oldest Last Activity (smallest date) should be first?
                // b.lastActivity - a.lastActivity = Newest first (Descending)
                // a.lastActivity - b.lastActivity = Oldest first (Ascending)
                // Let's go with Oldest First (Ascending) so we catch those we ignored longest.
                // return new Date(a.lastActivity) - new Date(b.lastActivity); 
            });

            // Format output for LLM
            const summary = `Ditemukan ${candidates.length} kandidat follow-up:\n` +
                candidates.map((c, i) =>
                    `${i + 1}. ${c.name} (${c.number})\n` +
                    `   - Kategori: ${c.category}\n` +
                    `   - Label: ${c.label} (sejak ${c.daysSince} lalu)\n` +
                    `   - Saran: ${c.suggestedStrategy}`
                ).join('\n\n');

            return summary;

        } catch (error) {
            console.error('[scanFollowUpCandidates] Error:', error);
            return `Gagal melakukan scanning: ${error.message}`;
        }
    },
};

module.exports = { scanFollowUpCandidatesTool };
