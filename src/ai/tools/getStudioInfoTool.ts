// @file: src/ai/tools/getStudioInfoTool.ts

import { z } from 'zod';

const getStudioInfoSchema = z.object({
  infoType: z
    .enum(['location', 'hours', 'contact', 'booking_policy', 'all'])
    .describe('Jenis informasi yang diminta: lokasi, jam buka, kontak, kebijakan booking, atau semua'),
});

type Input = z.infer<typeof getStudioInfoSchema>;

type SuccessResponse = {
  success: true;
  message: string;
  data: {
    success: true;
    infoType: Input['infoType'];
    studioInfo: typeof studioInfoData;
    response: string;
    timestamp: string;
  };
  response: string;
};

type FailResponse = {
  success: false;
  message: string;
};

type Output = SuccessResponse | FailResponse;

const studioInfoData = {
  location: {
    address: 'Jl. R. Sanim No.99, Tanah Baru, Kecamatan Beji, Kota Depok, Jawa Barat 16426',
    landmark: 'Bertempat di area GARASI 54 Moto Division – patokan jalur Margonda / pintu Tol Cijago',
    googleMaps: 'https://maps.app.goo.gl/garasi54moto',
    description: 'Lokasi Bosmat (beroperasi di GARASI 54 Moto Division)',
  },
  contact: {
    phone: '0895-4015-27556',
    whatsapp: '0895-4015-27556',
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
    description: 'Walk-in diperbolehkan, namun disarankan booking dulu agar slot aman',
  },
};

function buildResponse(infoType: Input['infoType']): string {
  switch (infoType) {
    case 'location':
      return `📍 *Lokasi Bosmat Repainting & Detailing Studio:*

${studioInfoData.location.address}
${studioInfoData.location.landmark}

Google Maps: ${studioInfoData.location.googleMaps}

⚠️ *Penting:* ${studioInfoData.bookingPolicy.description}`;
    case 'hours':
      return `🕒 *Jam Operasional Bosmat Studio:*

• Senin: ${studioInfoData.hours.senin}
• Selasa: ${studioInfoData.hours.selasa}
• Rabu: ${studioInfoData.hours.rabu}
• Kamis: ${studioInfoData.hours.kamis}
• Jumat: ${studioInfoData.hours.jumat}
• Sabtu: ${studioInfoData.hours.sabtu}
• Minggu: ${studioInfoData.hours.minggu}

⚠️ *Penting:* ${studioInfoData.bookingPolicy.description}`;
    case 'contact':
      return `📞 *Kontak Bosmat Studio:*

Telepon/WhatsApp: ${studioInfoData.contact.phone}

📍 Alamat: ${studioInfoData.location.address}

⚠️ *Penting:* ${studioInfoData.bookingPolicy.description}`;
    case 'booking_policy':
      return `📋 *Kebijakan Kunjungan Bosmat Studio:*

⚠️ *${studioInfoData.bookingPolicy.description.toUpperCase()}*

Untuk datang ke studio, mas harus:
• Booking slot dulu via WhatsApp
• Tentukan tanggal & jam kunjungan
• Konfirmasi 1 hari sebelumnya

Kontak booking: ${studioInfoData.contact.phone}`;
    case 'all':
    default:
      return `🏢 *Info Lengkap Bosmat Repainting & Detailing Studio*

📍 *Alamat:*
${studioInfoData.location.address}
${studioInfoData.location.landmark}
Google Maps: ${studioInfoData.location.googleMaps}

📞 *Kontak:*
Telepon/WhatsApp: ${studioInfoData.contact.phone}

🕒 *Jam Operasional:*
• Senin-Kamis: ${studioInfoData.hours.senin}
• Jumat: ${studioInfoData.hours.jumat}
• Sabtu-Minggu: ${studioInfoData.hours.sabtu}

⚠️ *PENTING - Kebijakan Kunjungan:*
${studioInfoData.bookingPolicy.description.toUpperCase()}
Wajib booking slot dulu sebelum datang ke studio!`;
  }
}

async function implementation(input: Input): Promise<Output> {
  try {
    const { infoType } = getStudioInfoSchema.parse(input);
    console.log('[getStudioInfo] Getting studio information:', infoType);

    const response = buildResponse(infoType);
    const result = {
      success: true as const,
      infoType,
      studioInfo: studioInfoData,
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

export const getStudioInfoTool = {
  toolDefinition: {
    type: 'function' as const,
    function: {
      name: 'getStudioInfo',
      description: 'Dapatkan informasi lengkap tentang Bosmat: alamat terbaru, jam buka, kontak, dan kebijakan booking',
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

export default getStudioInfoTool;
