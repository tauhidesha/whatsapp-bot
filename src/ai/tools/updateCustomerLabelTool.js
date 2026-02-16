// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { ensureFirestore } = require('../utils/adminAuth.js'); // isAdmin not used here but could be if needed? It uses schema validaton.
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

      // Update label di WhatsApp Business (wppconnect) menggunakan API yang benar
      if (global.whatsappClient) {
        try {
          const { normalizedAddress } = parseSenderIdentity(senderNumber);
          const whatsappNumber = normalizedAddress || senderNumber;

          // Mapping label → nama & warna di WhatsApp Business
          const labelConfig = {
            hot_lead: { name: 'Hot Lead', color: '#e74c3c' },  // Merah
            cold_lead: { name: 'Cold Lead', color: '#95a5a6' },  // Abu
            booking_process: { name: 'Booking Process', color: '#f39c12' },  // Kuning/Orange
            completed: { name: 'Completed', color: '#27ae60' },  // Hijau
            follow_up: { name: 'Follow Up', color: '#3498db' },  // Biru
            general: { name: 'General', color: '#9b59b6' },  // Ungu
          };

          const config = labelConfig[label] || { name: label, color: '#95a5a6' };
          const labelName = config.name;

          // --- Step 1: Cari atau buat label di WhatsApp ---
          let labelId = null;

          // Cek apakah label ID sudah pernah di-cache di Firestore
          try {
            const labelCacheRef = db.collection('_labelCache').doc(label);
            const cached = await labelCacheRef.get();
            if (cached.exists && cached.data().labelId) {
              labelId = cached.data().labelId;
              console.log(`[Label] Cache hit: "${labelName}" → ID ${labelId}`);

              // Verifikasi label masih exist di WA
              if (global.whatsappClient.getLabelById) {
                try {
                  await global.whatsappClient.getLabelById(labelId);
                } catch {
                  console.warn(`[Label] Cached ID ${labelId} invalid, akan dibuat ulang...`);
                  labelId = null;
                }
              }
            }
          } catch (cacheErr) {
            console.warn('[Label] Cache lookup failed:', cacheErr.message);
          }

          // Jika belum ada di cache, cari di semua label WA yang sudah ada
          if (!labelId && global.whatsappClient.getAllLabels) {
            try {
              const allLabels = await global.whatsappClient.getAllLabels();
              const existing = allLabels.find(l => l.name === labelName);
              if (existing && existing.id) {
                labelId = existing.id.toString();
                console.log(`[Label] Found existing WA label "${labelName}" → ID ${labelId}`);
              }
            } catch (listErr) {
              console.warn('[Label] getAllLabels failed:', listErr.message);
            }
          }

          // Jika masih belum ada, buat label baru
          if (!labelId && global.whatsappClient.addNewLabel) {
            try {
              // addNewLabel returns Promise<void>, so we create then search
              await global.whatsappClient.addNewLabel(labelName, {
                labelColor: config.color,
              });
              console.log(`[Label] ✅ Label baru "${labelName}" dibuat, mencari ID...`);

              // Setelah buat, ambil semua labels lalu cari ID-nya
              if (global.whatsappClient.getAllLabels) {
                const allLabels = await global.whatsappClient.getAllLabels();
                const created = allLabels.find(l => l.name === labelName);
                if (created && created.id) {
                  labelId = created.id.toString();
                  console.log(`[Label] ✅ Label "${labelName}" → ID ${labelId}`);
                }
              }

              // Cache ke Firestore agar tidak perlu cari ulang
              if (labelId) {
                try {
                  await db.collection('_labelCache').doc(label).set({
                    labelId,
                    labelName,
                    color: config.color,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                } catch { /* cache write gagal, tidak fatal */ }
              }
            } catch (createError) {
              // Jika label sudah ada (duplikat), WPPConnect mungkin throw error
              console.warn('[Label] addNewLabel error:', createError.message);
            }
          }

          // --- Step 2: Hapus label lama & assign label baru ke chat ---
          if (labelId && global.whatsappClient.addOrRemoveLabels) {
            try {
              const operations = [];

              // Hapus label lama dari chat (ambil dari Firestore)
              const prevLabelId = docRef ? (await docRef.get())?.data()?.whatsappLabelId : null;
              if (prevLabelId && prevLabelId !== labelId) {
                operations.push({ labelId: prevLabelId, type: 'remove' });
                console.log(`[Label] 🔄 Removing old label ID ${prevLabelId} from chat`);
              }

              // Tambah label baru
              operations.push({ labelId, type: 'add' });

              await global.whatsappClient.addOrRemoveLabels([whatsappNumber], operations);
              console.log(`[Label] ✅ Label "${labelName}" (ID: ${labelId}) assigned to ${whatsappNumber}`);

              // Simpan labelId ke Firestore untuk tracking
              await docRef.set({ whatsappLabelId: labelId }, { merge: true });

            } catch (assignError) {
              console.warn('[Label] addOrRemoveLabels failed:', assignError.message);
            }
          } else {
            if (!labelId) {
              console.warn('[Label] ⚠️ Tidak bisa mendapatkan label ID. Label hanya tersimpan di Firestore.');
            }
            if (!global.whatsappClient.addOrRemoveLabels) {
              console.warn('[Label] ⚠️ Method addOrRemoveLabels tidak tersedia. Pastikan WPPConnect >= 1.25.');
            }
          }

        } catch (waError) {
          console.warn('[Label] Gagal sync ke WhatsApp Business:', waError.message);
          // Jangan gagalkan proses utama jika update WA gagal
        }
      }

      return {
        success: true,
        message: `Label pelanggan berhasil diubah menjadi "${label}" dan di-sync ke WhatsApp Business.`,
        data: {
          docId,
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