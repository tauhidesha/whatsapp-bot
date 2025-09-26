import { z } from 'zod';
import { calculateHomeServiceFee, formatCurrency } from '../utils/distanceMatrix';
import { saveCustomerLocation, saveHomeServiceQuote } from '../utils/customerLocations';

const CalculateHomeServiceSchema = z.object({
  latitude: z.number({ description: 'Latitude pelanggan' }),
  longitude: z.number({ description: 'Longitude pelanggan' }),
  address: z.string().optional(),
  label: z.string().optional(),
  subtotal: z.number().optional(),
  freeRadiusKm: z.number().optional(),
  feePerKm: z.number().optional(),
  baseFee: z.number().optional(),
  senderNumber: z.string().optional(),
});

export const calculateHomeServiceFeeTool = {
  toolDefinition: {
    type: 'function' as const,
    function: {
      name: 'calculateHomeServiceFee',
      description:
        'Hitung jarak dan biaya tambahan home service berdasarkan lokasi pelanggan menggunakan Google Distance Matrix API.',
      parameters: {
        type: 'object',
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude pelanggan (format desimal)',
          },
          longitude: {
            type: 'number',
            description: 'Longitude pelanggan (format desimal)',
          },
          address: {
            type: 'string',
            description: 'Alamat atau catatan lokasi jika tersedia',
          },
          label: {
            type: 'string',
            description: 'Nama lokasi yang dibagikan pelanggan',
          },
          subtotal: {
            type: 'number',
            description: 'Subtotal layanan sebelum biaya home service (opsional)',
          },
          freeRadiusKm: {
            type: 'number',
            description: 'Radius gratis dalam KM (opsional, default dari env HOME_SERVICE_FREE_RADIUS_KM)',
          },
          feePerKm: {
            type: 'number',
            description: 'Tarif per km di luar radius gratis (opsional, default dari env HOME_SERVICE_FEE_PER_KM)',
          },
          baseFee: {
            type: 'number',
            description: 'Biaya dasar jika jarak melebihi radius gratis (opsional, default dari env HOME_SERVICE_BASE_FEE)',
          },
          senderNumber: {
            type: 'string',
            description: 'Nomor pelanggan (otomatis diisi oleh sistem)',
          },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
  implementation: async (input: unknown) => {
    try {
      const parsed = CalculateHomeServiceSchema.parse(input || {});
      const { latitude, longitude, address, label, subtotal, freeRadiusKm, feePerKm, baseFee, senderNumber } = parsed;

      const calculation = await calculateHomeServiceFee({
        latitude,
        longitude,
        subtotal,
        freeRadiusKm,
        feePerKm,
        baseFee,
      });

      if (!calculation.success) {
        return calculation;
      }

      const responsePayload = {
        ...calculation,
        address: address || null,
        label: label || null,
      };

      if (senderNumber) {
        try {
          await saveCustomerLocation(senderNumber, {
            latitude,
            longitude,
            address: address || null,
            label: label || null,
            raw: { latitude, longitude, address, label },
            source: 'distance-tool',
          });
          await saveHomeServiceQuote(senderNumber, responsePayload as Record<string, unknown>);
        } catch (error) {
          console.warn('[calculateHomeServiceFeeTool] Gagal menyimpan lokasi / quote ke Firestore:', error);
        }
      }

      const messageParts = [calculation.summary];
      if (calculation.additionalFee > 0) {
        messageParts.push(`Biaya tambahan: ${formatCurrency(calculation.additionalFee)}.`);
      } else {
        messageParts.push('Tidak ada biaya tambahan untuk home service.');
      }

      return {
        success: true as const,
        ...responsePayload,
        message: messageParts.join(' '),
      };
    } catch (error) {
      console.error('[calculateHomeServiceFeeTool] Gagal memproses input:', error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'unknown_error',
        message: 'Tidak dapat menghitung biaya home service.',
      };
    }
  },
};
