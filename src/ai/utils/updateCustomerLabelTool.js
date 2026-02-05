// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { parseSenderIdentity } = require('../../lib/utils.js'); // Asumsi ada helper ini

const VALID_LABELS = ['hot_lead', 'cold_lead', 'booking_process', 'completed', 'general', 'follow_up'];

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
      }
    } catch (e) {
      // Abaikan jika sudah diinisialisasi di tempat lain
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

      return {
        success: true,
        message: `Label pelanggan berhasil diubah menjadi "${label}".`,
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

