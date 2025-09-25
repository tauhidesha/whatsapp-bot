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
    address: 'Bukit Cengkeh 1, Jl. Medan No. B3/2, Cimanggis – Depok, Jawa Barat',
    landmark: 'Dekat dari jalan raya Bogor atau tol Cijago',
    googleMaps: 'https://maps.app.goo.gl/do4DBYiMntyV7oqc7',
    description: 'Lokasi Bosmat – Detailing & Repainting Studio',
  },
  contact: {
    phone: '0895-4015-27556',
    whatsapp: '0895-4015-27556',
  },
  hours: {
    senin: '09.00–17.00',
    selasa: '09.00–17.00',
    rabu: '09.00–17.00',
    kamis: '09.00–17.00',
    jumat: 'Tutup',
    sabtu: '09.00–17.00',
    minggu: '09.00–17.00',
  },
  bookingPolicy: {
    walkIn: false,
    appointmentRequired: true,
    description: 'Wajib janjian atau booking, no walk-in',
  },
};

function buildResponse(infoType: Input['infoType']): string {
  switch (infoType) {
    case 'location':
      return `📍 *Lokasi Bosmat Detailing & Repainting Studio:*

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
      return `🏢 *Info Lengkap Bosmat Detailing & Repainting Studio*

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
      description: 'Dapatkan informasi lengkap tentang studio Bosmat: alamat, jam buka, kontak, dan kebijakan booking',
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
