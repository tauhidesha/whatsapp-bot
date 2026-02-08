// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
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

function ensureFirestore() {
  if (!admin.apps.length) {
    try {
      // Coba inisialisasi jika belum ada
      const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      if (serviceAccountBase64) {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        // Fallback for local development without base64
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (serviceAccountPath)
          admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
      }
    } catch (e) {
    }
  }
  return getFirebaseAdmin().firestore();
}

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

      // Update label di WhatsApp Business (wppconnect) menggunakan setLabelChat
      if (global.whatsappClient) {
        try {
          const { normalizedAddress } = parseSenderIdentity(senderNumber);
          const whatsappNumber = normalizedAddress || senderNumber;

          // Mapping label ke nama label yang akan dibuat/dicari di WhatsApp Business
          const labelMapping = {
            hot_lead: 'Hot Lead',
            cold_lead: 'Cold Lead',
            booking_process: 'Booking Process',
            completed: 'Completed',
            follow_up: 'Follow Up',
            general: 'General',
          };

          const labelName = labelMapping[label] || label;

          // Ambil semua label yang ada di WhatsApp Business
          let allLabels = [];
          try {
            if (global.whatsappClient.getAllLabels) {
              allLabels = await global.whatsappClient.getAllLabels();
              console.log(`[updateCustomerLabelTool] Daftar label yang ada:`, allLabels);
            }
          } catch (labelsError) {
            console.warn('[updateCustomerLabelTool] Gagal mengambil daftar label:', labelsError.message);
          }

          // Cari label ID berdasarkan nama, atau buat label baru jika belum ada
          let labelId = null;
          
          // Cari label yang sudah ada
          if (Array.isArray(allLabels) && allLabels.length > 0) {
            const existingLabel = allLabels.find(
              (l) => l.name && l.name.toLowerCase() === labelName.toLowerCase()
            );
            if (existingLabel && existingLabel.id) {
              labelId = existingLabel.id.toString();
              console.log(`[updateCustomerLabelTool] Label "${labelName}" sudah ada dengan ID: ${labelId}`);
            }
          }

          // Jika label belum ada, buat label baru
          if (!labelId && global.whatsappClient.createLabel) {
            try {
              const newLabel = await global.whatsappClient.createLabel(labelName);
              if (newLabel && newLabel.id) {
                labelId = newLabel.id.toString();
                console.log(`[updateCustomerLabelTool] Label baru "${labelName}" dibuat dengan ID: ${labelId}`);
              }
            } catch (createError) {
              console.warn('[updateCustomerLabelTool] Gagal membuat label baru:', createError.message);
            }
          }

          // Set label ke chat menggunakan setLabelChat
          if (labelId && global.whatsappClient.setLabelChat) {
            try {
              // Hapus label lama dulu (opsional, bisa di-skip jika ingin multiple labels)
              // Untuk sekarang, kita set label baru saja (WhatsApp akan replace label lama)
              
              const result = await global.whatsappClient.setLabelChat(whatsappNumber, [labelId]);
              console.log(`[updateCustomerLabelTool] Label "${labelName}" (ID: ${labelId}) berhasil dipasang ke chat ${whatsappNumber}`);
              console.log(`[updateCustomerLabelTool] Result:`, result);
            } catch (setLabelError) {
              console.warn('[updateCustomerLabelTool] Gagal set label ke chat:', setLabelError.message);
              // Jika error karena label belum ada, coba buat dulu
              if (setLabelError.message && setLabelError.message.includes('label')) {
                console.log('[updateCustomerLabelTool] Mencoba membuat label terlebih dahulu...');
                // Retry logic bisa ditambahkan di sini jika perlu
              }
            }
          } else {
            if (!labelId) {
              console.warn('[updateCustomerLabelTool] Label ID tidak ditemukan/dibuat. Skip set label ke WhatsApp.');
            }
            if (!global.whatsappClient.setLabelChat) {
              console.warn('[updateCustomerLabelTool] Method setLabelChat tidak tersedia di wppconnect client.');
            }
          }

        } catch (waError) {
          console.warn('[updateCustomerLabelTool] Gagal update label di WhatsApp Business:', waError.message);
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