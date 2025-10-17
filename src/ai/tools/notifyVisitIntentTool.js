// File: src/ai/tools/notifyVisitIntentTool.js
// Tool for notifying BosMat about customers planning to consult at the studio without a booking.

const { z } = require('zod');
const { notifyVisitIntent } = require('../utils/humanHandover.js');

const inputSchema = z.object({
  visitTime: z.string().min(1).max(120).optional(),
  purpose: z.string().min(1).max(200).optional(),
  additionalNotes: z.string().min(1).max(500).optional(),
  senderNumber: z.string().min(1),
  senderName: z.string().optional(),
});

const jsonSchemaParameters = {
  type: 'object',
  properties: {
    visitTime: {
      type: 'string',
      description: 'Perkiraan waktu kunjungan pelanggan ke studio (contoh: "hari ini jam 15.00").',
    },
    purpose: {
      type: 'string',
      description: 'Tujuan konsultasi (contoh: "Diskusi opsi repaint merah metalik").',
    },
    additionalNotes: {
      type: 'string',
      description: 'Catatan tambahan yang perlu diketahui BosMat sebelum kedatangan.',
    },
  },
};

const notifyVisitIntentTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'notifyVisitIntent',
      description: 'Kirim notifikasi WhatsApp ke BosMat bahwa pelanggan akan datang ke studio untuk konsultasi tanpa booking.',
      parameters: jsonSchemaParameters,
    },
  },
  implementation: async (rawArgs = {}) => {
    try {
      let parsedArgs = rawArgs;
      if (typeof parsedArgs === 'string') {
        try {
          parsedArgs = JSON.parse(parsedArgs);
        } catch (error) {
          throw new Error('Argumen tool notifyVisitIntent harus berupa JSON yang valid.');
        }
      }

      const validated = inputSchema.parse(parsedArgs);

      await notifyVisitIntent({
        senderNumber: validated.senderNumber,
        senderName: validated.senderName,
        visitTime: validated.visitTime,
        purpose: validated.purpose,
        additionalNotes: validated.additionalNotes,
      });

      return {
        success: true,
        message: 'Notifikasi kedatangan pelanggan telah dikirim ke BosMat.',
      };
    } catch (error) {
      console.error('[notifyVisitIntentTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  },
};

module.exports = { notifyVisitIntentTool };
