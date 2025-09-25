// File: src/ai/tools/triggerBosMatTool.js
// Tool to escalate questions to BosMat (human handoff).

const { z } = require('zod');
const { notifyBosMat, setSnoozeMode } = require('../utils/humanHandover.js');

const inputSchema = z.object({
  reason: z.string().describe('Alasan Zoya perlu tanya ke BosMat (misalnya: warna efek custom, motor langka, dsb)'),
  customerQuestion: z.string().describe('Pertanyaan asli dari customer yang perlu ditanyain ke BosMat'),
  senderNumber: z.string().optional(),
  senderName: z.string().optional(),
});

const jsonSchemaParameters = {
  type: 'object',
  properties: {
    reason: {
      type: 'string',
      description: 'Alasan Zoya perlu tanya ke BosMat (misalnya: warna efek custom, motor langka, dsb)',
    },
    customerQuestion: {
      type: 'string',
      description: 'Pertanyaan asli dari customer yang perlu ditanyain ke BosMat',
    },
  },
  required: ['reason', 'customerQuestion'],
};

const triggerBosMatTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'triggerBosMatTool',
      description: 'Digunakan saat Zoya butuh bantuan BosMat karena tidak yakin jawabannya atau pertanyaannya terlalu spesifik.',
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
          throw new Error('Argumen tool harus berupa JSON yang valid.');
        }
      }

      const validated = inputSchema.parse(parsedArgs);
      const { reason, customerQuestion, senderNumber } = validated;

      if (!senderNumber) {
        throw new Error('[triggerBosMatTool] senderNumber wajib tersedia untuk handover.');
      }

      console.log('[triggerBosMatTool] Mengirim handover ke BosMat:', {
        senderNumber,
        reason,
        customerQuestion,
      });

      await setSnoozeMode(senderNumber);
      await notifyBosMat(senderNumber, customerQuestion, reason);

      return {
        success: true,
        message: `Notifikasi untuk menanyakan "${customerQuestion}" telah berhasil dikirim ke BosMat.`,
      };
    } catch (error) {
      console.error('[triggerBosMatTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  },
};

module.exports = {
  triggerBosMatTool,
};
