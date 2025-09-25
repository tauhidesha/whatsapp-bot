// File: src/ai/tools/getCurrentDateTimeTool.js
// Provides current date and time information for the AI agent.

const { DateTime } = require('luxon');

function buildDateTimePayload(timezone) {
  const now = timezone
    ? DateTime.now().setZone(timezone)
    : DateTime.now();

  const iso = now.toISO();
  const date = now.toISODate();
  const time = now.toFormat('HH:mm');
  const dayName = now.setLocale('id').toFormat('cccc');
  const human = now.setLocale('id').toFormat("cccc, d LLLL yyyy HH:mm 'WIB'");

  return {
    isoTimestamp: iso,
    date,
    time,
    dayName,
    humanReadable: human,
    timezone: now.zoneName,
    offsetMinutes: now.offset,
  };
}

const getCurrentDateTimeTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getCurrentDateTime',
      description: 'Mengambil informasi tanggal dan waktu saat ini (mengikuti timezone server).',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Opsional. Gunakan format IANA timezone (misal "Asia/Jakarta") untuk override.',
          },
        },
      },
    },
  },
  implementation: async (input = {}) => {
    try {
      const timezone = typeof input.timezone === 'string' && input.timezone.trim()
        ? input.timezone.trim()
        : undefined;

      const payload = buildDateTimePayload(timezone);
      return {
        success: true,
        ...payload,
        summary: `Saat ini ${payload.dayName}, ${payload.date} pukul ${payload.time} (${payload.timezone}).`,
      };
    } catch (error) {
      console.error('[getCurrentDateTimeTool] Error:', error);
      return {
        success: false,
        message: 'Gagal mendapatkan waktu sekarang.',
      };
    }
  },
};

module.exports = {
  getCurrentDateTimeTool,
};
