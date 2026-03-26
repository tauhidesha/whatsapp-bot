// File: src/ai/tools/updateCustomerLabelTool.js
const { z } = require('zod');
const prisma = require('../../lib/prisma');
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

      // Get customer from Prisma
      const normalizedPhone = docId.replace(/\D/g, '');
      const customer = await prisma.customer.findUnique({
        where: { phone: normalizedPhone }
      });

      if (!customer) {
        return { success: false, message: 'Pelanggan tidak ditemukan.' };
      }

      // Get previous label from customerContext
      const customerContext = await prisma.customerContext.findUnique({
        where: { id: normalizedPhone }
      });
      const prevLabelId = customerContext?.customerLabel || null;

      // Update customerContext
      await prisma.customerContext.upsert({
        where: { id: normalizedPhone },
        create: {
          id: normalizedPhone,
          phone: normalizedPhone,
          customerLabel: label,
          labelReason: reason || null,
        },
        update: {
          customerLabel: label,
          labelReason: reason || null,
        }
      });

      // --- Sync label ke WhatsApp Business via WPPConnect ---
      let waSynced = false;
      let syncMessage = 'WA sync: gagal/tidak tersedia';

      if (global.whatsappClient) {
        try {
          const whatsappNumber = normalizedAddress || senderNumber;

          // Need to pass a mock db for WhatsApp label functions - they still use WA SDK
          const mockDb = { collection: () => ({ doc: () => ({ set: () => {} }) }) };
          
          // 1. Ensure label exists in WA
          const waLabel = await ensureWhatsAppLabel(global.whatsappClient, mockDb, label);

          if (waLabel && waLabel.id) {
            const success = await assignWhatsAppLabel(
              global.whatsappClient,
              mockDb,
              whatsappNumber,
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
          customerLabel: label,
          labelReason: reason || null,
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