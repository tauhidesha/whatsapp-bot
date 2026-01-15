// File: src/ai/tools/getStudioInfoTool.js
// Menyediakan informasi studio Bosmat (lokasi, jam, kontak, kebijakan booking)

const { z } = require('zod');

const getStudioInfoSchema = z.object({
  infoType: z
    .enum(['location', 'hours', 'contact', 'booking_policy', 'all'])
    .describe('Jenis informasi yang diminta: lokasi, jam buka, kontak, kebijakan booking, atau semua'),
});

async function implementation(input) {
  try {
    const { infoType } = getStudioInfoSchema.parse(input);

    console.log('[getStudioInfo] Getting studio information:', infoType);

    const studioInfo = {
      location: {
        address: 'Bukit Cengkeh 1, Jl. Medan No.B3/2, Kota Depok, Jawa Barat 16451',
        landmark: 'Bosmat Repaint Detailing Motor',
        googleMaps: 'https://maps.app.goo.gl/JrH7TxyfPtGxBjW19',
        description: 'Lokasi Bosmat Repaint Detailing Motor',
        exteriorPhoto: 'data/c46dbcbe-7d71-45b7-bdd6-5eeb99b4c2f4.jpg',
      },
      contact: {
        phone: '0895401527556',
        whatsapp: '0895401527556',
      },
      hours: {
        senin: '08.00–17.00',
        selasa: '08.00–17.00',
        rabu: '08.00–17.00',
        kamis: '08.00–17.00',
        jumat: 'Tutup',
        sabtu: '08.00–17.00',
        minggu: '08.00–17.00',
      },
      bookingPolicy: {
        walkIn: true,
        appointmentRequired: false,
        description: 'Walk-in diterima, tetapi disarankan booking terlebih dahulu agar slot aman',
      },
    };

    let response = '';

    switch (infoType) {
      case 'location':
        response = `📍 *Lokasi Bosmat Repainting & Detailing Studio:*

${studioInfo.location.address}
${studioInfo.location.landmark}

Google Maps: ${studioInfo.location.googleMaps}

        ⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'hours':
        response = `🕒 *Jam Operasional Bosmat Studio:*

• Senin: ${studioInfo.hours.senin}
• Selasa: ${studioInfo.hours.selasa}
• Rabu: ${studioInfo.hours.rabu}
• Kamis: ${studioInfo.hours.kamis}
• Jumat: ${studioInfo.hours.jumat}
• Sabtu: ${studioInfo.hours.sabtu}
• Minggu: ${studioInfo.hours.minggu}

⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'contact':
        response = `📞 *Kontak Bosmat Studio:*

Telepon/WhatsApp: ${studioInfo.contact.phone}

📍 Alamat: ${studioInfo.location.address}

⚠️ *Penting:* ${studioInfo.bookingPolicy.description}`;
        break;
      case 'booking_policy':
        response = `📋 *Kebijakan Kunjungan Bosmat Studio:*

⚠️ *${studioInfo.bookingPolicy.description.toUpperCase()}*

Untuk datang ke studio, mas harus:
• Booking slot dulu via WhatsApp
• Tentukan tanggal & jam kunjungan
• Konfirmasi 1 hari sebelumnya

Kontak booking: ${studioInfo.contact.phone}`;
        break;
      case 'all':
      default:
        response = `🏢 *Info Lengkap Bosmat Repainting & Detailing Studio*

📍 *Alamat:*
${studioInfo.location.address}
${studioInfo.location.landmark}
Google Maps: ${studioInfo.location.googleMaps}

📞 *Kontak:*
Telepon/WhatsApp: ${studioInfo.contact.phone}

🕒 *Jam Operasional:*
• Senin-Kamis: ${studioInfo.hours.senin}
• Jumat: ${studioInfo.hours.jumat}
• Sabtu-Minggu: ${studioInfo.hours.sabtu}

⚠️ *PENTING - Kebijakan Kunjungan:*
${studioInfo.bookingPolicy.description.toUpperCase()}
Wajib booking slot dulu sebelum datang ke studio!`;
        break;
    }

    const result = {
      success: true,
      infoType,
      studioInfo,
      response,
      timestamp: new Date().toISOString(),
    };

    console.log('[getStudioInfo] Studio info retrieved successfully');

    return {
      success: true,
      message: `Info studio ${infoType} berhasil diambil`,
      data: result,
      response,
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
