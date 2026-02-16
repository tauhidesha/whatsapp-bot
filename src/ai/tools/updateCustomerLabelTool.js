// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { ensureFirestore } = require('../utils/adminAuth.js');
const { parseSenderIdentity } = require('../../lib/utils.js');

const VALID_LABELS = [
  'hot_lead',
  'cold_lead',
  'booking_process',
  'completed',
  'general',
  'follow_up',
];

const updateCustomerLabelSchema = z.object({
  label: z.enum(VALID_LABELS).describe('Label baru untuk pelanggan.'),
  reason: z.string().optional().describe('Alasan singkat mengapa label ini diberikan.'),
  senderNumber: z.string().describe('Nomor WA pelanggan yang akan diberi label.'),
});

// Display names for WA Business labels
const LABEL_DISPLAY_NAMES = {
  hot_lead: 'Hot Lead',
  cold_lead: 'Cold Lead',
  booking_process: 'Booking Process',
  completed: 'Completed',
  follow_up: 'Follow Up',
  general: 'General',
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const updateCustomerLabelTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'updateCustomerLabel',
      description: 'Memberikan label status pada percakapan pelanggan (misal: hot_lead, cold_lead, booking_process, completed).',
      parameters: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: VALID_LABELS,
            description: 'Label yang akan diberikan: hot_lead (prospek tinggi), cold_lead (kurang berminat), booking_process (sedang booking), completed (selesai), follow_up (perlu ditindaklanjuti), general (umum).',
          },
          reason: {
            type: 'string',
            description: 'Alasan singkat pemberian label (misal: "Nanya harga detail & cicilan", "Hanya tanya-tanya").',
          },
        },
        required: ['label'],
      },
    },
  },
  implementation: async (input) => {
    try {
      const { label, reason, senderNumber } = updateCustomerLabelSchema.parse(input);

      if (!senderNumber) {
        return { success: false, message: 'senderNumber tidak tersedia.' };
      }

      const { docId } = parseSenderIdentity(senderNumber);
      if (!docId) {
        return { success: false, message: 'Gagal mem-parsing nomor pelanggan.' };
      }

      const db = ensureFirestore();
      const docRef = db.collection('directMessages').doc(docId);

      const updatePayload = {
        customerLabel: label,
        labelReason: reason || null,
        labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(updatePayload, { merge: true });

      // --- Sync label ke WhatsApp Business via WPPConnect ---
      let waSynced = false;

      if (global.whatsappClient) {
        try {
          const { normalizedAddress } = parseSenderIdentity(senderNumber);
          const whatsappNumber = normalizedAddress || senderNumber;
          const labelName = LABEL_DISPLAY_NAMES[label] || label;

          // Step 1: Cari label yang sudah ada di WA by name
          let labelId = null;

          // 1a. Cek cache Firestore dulu
          try {
            const labelCacheRef = db.collection('_labelCache').doc(label);
            const cached = await labelCacheRef.get();
            if (cached.exists && cached.data().labelId) {
              labelId = cached.data().labelId;
              console.log(`[Label] Cache hit: "${labelName}" → ID ${labelId}`);

              // Verifikasi label masih ada di WA
              if (global.whatsappClient.getAllLabels) {
                const allLabels = await global.whatsappClient.getAllLabels();
                const stillExists = allLabels.find(l => l.id?.toString() === labelId);
                if (!stillExists) {
                  console.warn(`[Label] Cached ID ${labelId} no longer exists in WA, clearing cache...`);
                  labelId = null;
                }
              }
            }
          } catch (cacheErr) {
            console.warn('[Label] Cache lookup failed:', cacheErr.message);
          }

          // 1b. Cari di semua label WA yang sudah ada
          if (!labelId && global.whatsappClient.getAllLabels) {
            try {
              const allLabels = await global.whatsappClient.getAllLabels();
              console.log(`[Label] Searching "${labelName}" in ${allLabels.length} existing WA labels...`);
              const existing = allLabels.find(l => l.name === labelName);
              if (existing && existing.id) {
                labelId = existing.id.toString();
                console.log(`[Label] ✅ Found existing WA label "${labelName}" → ID ${labelId}`);

                // Cache it
                try {
                  await db.collection('_labelCache').doc(label).set({
                    labelId,
                    labelName,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                } catch { /* cache write fail is non-fatal */ }
              }
            } catch (listErr) {
              console.warn('[Label] getAllLabels failed:', listErr.message);
            }
          }

          // 1c. Bikin label baru jika belum ada
          if (!labelId && global.whatsappClient.addNewLabel) {
            try {
              // WPPConnect addNewLabel(name: string, options?: string)
              // wa-js addNewLabel(name: string, color: string)
              // Get a valid color from WA's palette
              let newColor = undefined;
              if (global.whatsappClient.getNewLabelColor) {
                try {
                  newColor = await global.whatsappClient.getNewLabelColor();
                  console.log(`[Label] Got palette color for new label: ${newColor}`);
                } catch (colorErr) {
                  console.warn('[Label] getNewLabelColor failed:', colorErr.message);
                }
              }

              // Create the label - pass color as a plain string (NOT an object)
              if (newColor) {
                await global.whatsappClient.addNewLabel(labelName, newColor);
              } else {
                await global.whatsappClient.addNewLabel(labelName);
              }
              console.log(`[Label] addNewLabel("${labelName}") called, waiting for WA to sync...`);

              // WA needs time to propagate the new label
              await delay(1500);

              // Now search for the newly created label
              if (global.whatsappClient.getAllLabels) {
                const allLabels = await global.whatsappClient.getAllLabels();
                console.log(`[Label] Post-create: ${allLabels.length} labels found. Names: ${allLabels.map(l => l.name).join(', ')}`);
                const created = allLabels.find(l => l.name === labelName);
                if (created && created.id) {
                  labelId = created.id.toString();
                  console.log(`[Label] ✅ New label "${labelName}" created → ID ${labelId}`);

                  // Cache it
                  try {
                    await db.collection('_labelCache').doc(label).set({
                      labelId,
                      labelName,
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                  } catch { /* non-fatal */ }
                } else {
                  console.warn(`[Label] ⚠️ Label "${labelName}" not found after creation. Available: ${allLabels.map(l => `${l.name}(${l.id})`).join(', ')}`);
                }
              }
            } catch (createError) {
              console.warn('[Label] addNewLabel error:', createError.message);
            }
          }

          // Step 2: Assign label ke chat (hapus label lama dulu)
          if (labelId && global.whatsappClient.addOrRemoveLabels) {
            try {
              const operations = [];

              // Hapus label lama dari chat jika ada
              const docSnapshot = await docRef.get();
              const prevLabelId = docSnapshot.data()?.whatsappLabelId;
              if (prevLabelId && prevLabelId !== labelId) {
                operations.push({ labelId: prevLabelId, type: 'remove' });
                console.log(`[Label] 🔄 Removing old label ID ${prevLabelId} from chat`);
              }

              // Tambah label baru
              operations.push({ labelId, type: 'add' });

              // chatIds HARUS array (sesuai WPPConnect API)
              await global.whatsappClient.addOrRemoveLabels([whatsappNumber], operations);
              console.log(`[Label] ✅ Label "${labelName}" (ID: ${labelId}) assigned to ${whatsappNumber}`);

              // Simpan labelId ke Firestore untuk tracking
              await docRef.set({ whatsappLabelId: labelId }, { merge: true });
              waSynced = true;

            } catch (assignError) {
              console.warn('[Label] addOrRemoveLabels failed:', assignError.message);
            }
          } else {
            if (!labelId) {
              console.warn('[Label] ⚠️ Tidak bisa mendapatkan label ID. Label hanya tersimpan di Firestore.');
            }
            if (!global.whatsappClient.addOrRemoveLabels) {
              console.warn('[Label] ⚠️ Method addOrRemoveLabels tidak tersedia.');
            }
          }

        } catch (waError) {
          console.warn('[Label] Gagal sync ke WhatsApp Business:', waError.message);
        }
      }

      return {
        success: true,
        message: waSynced
          ? `Label pelanggan berhasil diubah menjadi "${label}" dan di-sync ke WhatsApp Business.`
          : `Label pelanggan berhasil diubah menjadi "${label}" di Firestore (WA sync: gagal/tidak tersedia).`,
        data: {
          docId,
          waSynced,
          ...updatePayload,
        },
      };
    } catch (error) {
      console.error('[updateCustomerLabelTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengubah label.',
      };
    }
  },
};

module.exports = { updateCustomerLabelTool };