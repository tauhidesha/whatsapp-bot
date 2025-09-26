// File: src/ai/tools/createBookingTool.js
// Tool to create a new booking entry in Firestore.

const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { notifyNewBooking, normalizeWhatsappNumber } = require('../utils/humanHandover.js');
const { calculateHomeServiceFee, formatCurrency } = require('../utils/distanceMatrix.js');
const { saveCustomerLocation, getCustomerLocation, saveHomeServiceQuote } = require('../utils/customerLocations.js');

function stringSimilarity(a, b) {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  let matches = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] === b[i]) matches += 1;
  }
  if (length === 0) return 0;
  return matches / Math.max(a.length, b.length);
}

function getServiceCategory(serviceName) {
  const name = (serviceName || '').toLowerCase();
  if (name.includes('detailing') || name.includes('poles')) return 'detailing';
  if (name.includes('coating')) return 'coating';
  if (name.includes('repaint')) return 'repaint';
  return 'other';
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const d = new Date(date);
  const hours = `${d.getHours()}`.padStart(2, '0');
  const minutes = `${d.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  label: z.string().optional(),
});

const BookingArgsSchema = z.object({
  customerPhone: z.string(),
  customerName: z.string(),
  serviceName: z.string(),
  bookingDate: z.string(),
  bookingTime: z.string(),
  vehicleInfo: z.string(),
  clientId: z.string().optional(),
  notes: z.string().optional(),
  subtotal: z.number().optional(),
  homeService: z.boolean().optional(),
  customerLocation: LocationSchema.optional(),
});

const createBookingTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'createBooking',
      description: 'Membuat booking baru di sistem setelah ketersediaan dikonfirmasi.',
      parameters: {
        type: 'object',
        properties: {
          customerPhone: { type: 'string', description: 'Nomor telepon pelanggan' },
          customerName: { type: 'string', description: 'Nama pelanggan' },
          serviceName: { type: 'string', description: 'Nama layanan yang dibooking (bisa lebih dari satu, dipisah koma)' },
          bookingDate: { type: 'string', description: 'Tanggal booking, format YYYY-MM-DD' },
          bookingTime: { type: 'string', description: 'Jam booking, format HH:mm' },
          vehicleInfo: { type: 'string', description: "Informasi kendaraan, misalnya 'Vario 160 Merah'" },
        },
        required: ['customerPhone', 'customerName', 'serviceName', 'bookingDate', 'bookingTime', 'vehicleInfo'],
      },
    },
  },
  implementation: async (args) => {
    try {
      const parsed = BookingArgsSchema.parse(args);
      const {
        customerName,
        customerPhone,
        serviceName,
        bookingDate,
        bookingTime,
        vehicleInfo,
        notes,
        subtotal,
        homeService,
        customerLocation,
      } = parsed;

      const servicesArray = serviceName.split(',').map(s => s.trim()).filter(Boolean);
      if (servicesArray.length === 0) {
        return {
          success: false,
          error: 'Nama layanan tidak boleh kosong.',
        };
      }

      const dateTimeString = `${bookingDate}T${bookingTime}:00`;
      const bookingDateTime = new Date(dateTimeString);
      if (Number.isNaN(bookingDateTime.getTime())) {
        return {
          success: false,
          error: `Format tanggal atau waktu tidak valid: ${dateTimeString}`,
        };
      }

      if (!admin.apps.length) {
        admin.initializeApp();
      }
      const firestore = getFirebaseAdmin().firestore();

      const bookingData = {
        customerName,
        customerPhone,
        vehicleInfo,
        bookingDateTime: admin.firestore.Timestamp.fromDate(bookingDateTime),
        customerPhoneNormalized: normalizeWhatsappNumber(customerPhone),
        bookingDate: formatDate(bookingDateTime),
        bookingTime: formatTime(bookingDateTime),
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        services: servicesArray,
        category: getServiceCategory(servicesArray[0]),
        reminderSent: false,
      };

      if (notes) {
        bookingData.notes = notes;
      }

      let homeServiceDetails = null;
      const normalizedPhone = normalizeWhatsappNumber(customerPhone);

      if (homeService || customerLocation) {
        const effectiveLocation = customerLocation || (normalizedPhone ? await getCustomerLocation(normalizedPhone) : null);

        if (!effectiveLocation) {
          return {
            success: false,
            error: 'home_service_location_missing',
            message: 'Lokasi pelanggan belum tersedia untuk menghitung biaya home service. Minta pelanggan kirim share location.',
          };
        }

        const { latitude, longitude } = effectiveLocation;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return {
            success: false,
            error: 'invalid_coordinates',
            message: 'Koordinat lokasi pelanggan tidak valid.',
          };
        }

        if (normalizedPhone) {
          await saveCustomerLocation(normalizedPhone, {
            latitude,
            longitude,
            address: effectiveLocation.address || customerLocation?.address || null,
            label: effectiveLocation.label || customerLocation?.label || null,
            raw: effectiveLocation.raw || customerLocation || { latitude, longitude },
            source: 'booking-tool',
          }, { skipHistory: Boolean(effectiveLocation.raw) });
        }

        const calculation = await calculateHomeServiceFee({
          latitude,
          longitude,
          subtotal,
        });

        if (!calculation.success) {
          return {
            success: false,
            error: calculation.error || 'home_service_fee_failed',
            message: calculation.message || 'Gagal menghitung biaya home service.',
          };
        }

        homeServiceDetails = {
          requested: true,
          latitude,
          longitude,
          address: effectiveLocation.address || customerLocation?.address || null,
          label: effectiveLocation.label || customerLocation?.label || null,
          distanceKm: calculation.distanceKm,
          distanceText: calculation.distanceText,
          durationText: calculation.durationText,
          additionalFee: calculation.additionalFee,
          freeRadiusKm: calculation.freeRadiusKm,
          extraDistanceKm: calculation.extraDistanceKm,
          feePerKm: calculation.feePerKm,
          baseFee: calculation.baseFee,
          subtotal: calculation.subtotal,
          totalWithFee: calculation.totalWithFee,
          summary: calculation.summary,
        };

        bookingData.homeService = homeServiceDetails;

        if (normalizedPhone) {
          await saveHomeServiceQuote(normalizedPhone, homeServiceDetails);
        }
      } else if (homeService === false) {
        bookingData.homeService = {
          requested: false,
        };
      }

      const bookingRef = await firestore.collection('bookings').add(bookingData);
      console.log(`[createBookingTool] Booking berhasil dibuat dengan ID: ${bookingRef.id}`);

      await notifyNewBooking(bookingData);

      let successMessage = `Booking untuk ${customerName} pada ${bookingData.bookingDate} jam ${bookingData.bookingTime} berhasil dibuat.`;
      if (homeServiceDetails && homeServiceDetails.additionalFee > 0) {
        successMessage += ` Biaya home service tambahan: ${formatCurrency(homeServiceDetails.additionalFee)}.`;
      }

      return {
        success: true,
        bookingId: bookingRef.id,
        message: successMessage,
        homeService: homeServiceDetails,
      };
    } catch (error) {
      console.error('[createBookingTool] Gagal menyimpan booking:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  },
};

module.exports = {
  createBookingTool,
  getServiceCategory,
  stringSimilarity,
};
