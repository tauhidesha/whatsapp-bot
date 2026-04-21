// File: src/ai/tools/getStudioInfoTool.js
// Menyediakan informasi studio Bosmat (lokasi, jam, kontak, kebijakan booking)

const { z } = require('zod');

const getStudioInfoSchema = z.object({
  infoType: z
    .enum(['location', 'hours', 'contact', 'booking_policy', 'all'])
    .optional()
    .default('all'),
});

const studioMetadata = require('../constants/studioMetadata.js');

async function implementation(input) {
  try {
    const { infoType } = getStudioInfoSchema.parse(input);

    console.log('[getStudioInfo] Getting studio information:', infoType);

    const studioInfo = studioMetadata; // Use Single Source of Truth

    let response = '';

    switch (infoType) {
      case 'location':
        response = `📍 *Lokasi Bosmat x Garasi 54 Studio:*

${studioInfo.location.address}
${studioInfo.location.landmark}

Google Maps: ${studioInfo.location.googleMaps}

Ancer-ancer: ${studioInfo.location.directions}

⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'hours':
        response = `🕒 *Jam Operasional Bosmat x Garasi 54 Studio:*

• Senin-Sabtu: ${studioInfo.hours.senin}
• Minggu: ${studioInfo.hours.minggu}

⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'contact':
        response = `📞 *Kontak Bosmat x Garasi 54 Studio:*

Telepon/WhatsApp: ${studioInfo.contact.phone}

📍 Alamat: ${studioInfo.location.address}

⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'booking_policy':
        response = `📋 *Kebijakan Kunjungan Bosmat x Garasi 54 Studio:*

⚠️ *${studioInfo.bookingPolicy.description.toUpperCase()}*

Untuk datang ke studio, mas harus:
• Booking slot dulu via WhatsApp
• Tentukan tanggal & jam kunjungan
• Konfirmasi 1 hari sebelumnya
• Penjadwalan pengerjaan menyusul sesuai ketersediaan slot (TBA)

Kontak booking: ${studioInfo.contact.phone}`;
        break;
      case 'all':
      default:
        response = `🏢 *Info Lengkap Bosmat x Garasi 54 Studio*

📍 *Alamat:*
${studioInfo.location.address}
${studioInfo.location.landmark}
Google Maps: ${studioInfo.location.googleMaps}
Ancer-ancer: ${studioInfo.location.directions}

📞 *Kontak:*
Telepon/WhatsApp: ${studioInfo.contact.phone}

🕒 *Jam Operasional:*
• Senin-Sabtu: ${studioInfo.hours.senin}
• Minggu: ${studioInfo.hours.minggu}

⚠️ *PENTING - Kebijakan Kunjungan:*
${studioInfo.bookingPolicy.description.toUpperCase()}
Wajib booking slot dulu sebelum datang ke studio!`;
        break;
    }

    console.log('[getStudioInfo] Studio info retrieved successfully');

    return {
      success: true,
      infoType,
      studioInfo,
      formattedResponse: response,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[getStudioInfo] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil info studio.',
    };
  }
}

const getStudioInfoTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getStudioInfo',
      description: 'Dapatkan informasi lengkap tentang Bosmat: alamat terkini, jam buka, kontak, dan kebijakan booking',
      parameters: {
        type: 'object',
        properties: {
          infoType: {
            type: 'string',
            enum: ['location', 'hours', 'contact', 'booking_policy', 'all'],
            description: 'Jenis informasi yang diminta: lokasi, jam buka, kontak, kebijakan booking, atau semua',
          },
        },
        required: ['infoType'],
      },
    },
  },
  implementation,
};

module.exports = { getStudioInfoTool };
