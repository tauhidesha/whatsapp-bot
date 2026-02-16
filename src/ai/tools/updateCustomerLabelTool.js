// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { ensureFirestore } = require('../utils/adminAuth.js');
const { parseSenderIdentity } = require('../../lib/utils.js');
const {
  VALID_LABELS,
  LABEL_DISPLAY_NAMES,
  ensureWhatsAppLabel,
  assignWhatsAppLabel
} = require('../../lib/whatsappLabelUtils.js');

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
            description: 'Label yang akan diberikan: hot_lead (prospek tinggi), cold_lead (kurang berminat), booking_process (sedang booking), completed (selesai), follow_up (perlu ditindaklanjuti), general (umum), scheduling (penjadwalan), archive (arsip).',
          },
          reason: {
            type: 'string',
            description: 'Alasan singkat pemberian label (misal: "Nanya harga detail & cicilan", "Hanya tanya-tanya").',
          },
          senderNumber: {
            type: 'string',
            description: 'Nomor pengirim (otomatis diisi sistem).',
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

      const { docId, normalizedAddress } = parseSenderIdentity(senderNumber);
      if (!docId) {
        return { success: false, message: 'Gagal mem-parsing nomor pelanggan.' };
      }

      const db = ensureFirestore();
      const docRef = db.collection('directMessages').doc(docId);

      // Get current data to check for existing label
      const docSnapshot = await docRef.get();
      const prevLabelId = docSnapshot.exists ? docSnapshot.data()?.whatsappLabelId : null;

      const updatePayload = {
        customerLabel: label,
        labelReason: reason || null,
        labelUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(updatePayload, { merge: true });

      // --- Sync label ke WhatsApp Business via WPPConnect ---
      let waSynced = false;
      let syncMessage = 'WA sync: gagal/tidak tersedia';

      if (global.whatsappClient) {
        try {
          const whatsappNumber = normalizedAddress || senderNumber;

          // 1. Ensure label exists in WA
          const waLabel = await ensureWhatsAppLabel(global.whatsappClient, db, label);

          if (waLabel && waLabel.id) {
            // 2. Assign label to chat
            const assigned = await assignWhatsAppLabel(
              global.whatsappClient, // Pass client
              db, // Pass db (although assignWhatsAppLabel might not strictly need it if we pass docId, but current impl uses it) FIXME: check signature
              whatsappNumber, // Pass phone number for WPPConnect
              docId, // Pass docId for Firestore update inside? checks implementation
              waLabel.id, // labelId
              prevLabelId // oldLabelId
            );
            // Wait, let me double check assignWhatsAppLabel signature:
            // async function assignWhatsAppLabel(client, db, senderNumber, docId, labelId, prevLabelId = null)

            // So I should pass:
            const success = await assignWhatsAppLabel(
              global.whatsappClient,
              db,
              whatsappNumber, // This must be the phone number used by WPPConnect
              docId,
              waLabel.id,
              prevLabelId
            );

            if (success) {
              waSynced = true;
              syncMessage = 'ter-sync ke WhatsApp Business';
            } else {
              syncMessage = 'gagal assign label di WA';
            }

          } else {
            syncMessage = 'gagal membuat/menemukan label di WA';
          }

        } catch (waError) {
          console.warn('[Label] Gagal sync ke WhatsApp Business:', waError.message);
          syncMessage = `gagal sync (${waError.message})`;
        }
      }

      return {
        success: true,
        message: `Label pelanggan berhasil diubah menjadi "${label}" (${syncMessage}).`,
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