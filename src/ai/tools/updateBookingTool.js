// File: src/ai/tools/updateBookingTool.js
// Tool to modify existing booking records in Firestore.

const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { parseDateTime } = require('../utils/dateTime.js');
const { getServiceCategory } = require('./createBookingTool.js');
const { normalizeWhatsappNumber } = require('../utils/humanHandover.js');
const { calculateHomeServiceFee } = require('../utils/distanceMatrix.js');
const { saveCustomerLocation, saveHomeServiceQuote, getCustomerLocation } = require('../utils/customerLocations.js');

const STATUS_ALLOWLIST = ['pending', 'confirmed', 'in progress', 'completed', 'cancelled'];

const UpdateBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId wajib diisi'),
  bookingDate: z.string().optional(),
  bookingTime: z.string().optional(),
  serviceName: z.string().optional(),
  status: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  vehicleInfo: z.string().optional(),
  notes: z.string().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  subtotal: z.number().optional(),
  homeService: z
    .object({
      requested: z.boolean().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      address: z.string().optional(),
      label: z.string().optional(),
      subtotal: z.number().optional(),
      freeRadiusKm: z.number().optional(),
      feePerKm: z.number().optional(),
      baseFee: z.number().optional(),
    })
    .optional(),
});

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
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

const updateBookingTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'updateBooking',
      description: 'Memperbarui booking yang sudah ada (tanggal, jam, layanan, status, atau info pelanggan).',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string', description: 'ID booking di Firestore yang ingin diubah.' },
          bookingDate: { type: 'string', description: 'Tanggal baru (YYYY-MM-DD atau frasa natural).' },
          bookingTime: { type: 'string', description: 'Jam baru (HH:mm atau frasa natural).' },
          serviceName: { type: 'string', description: 'Nama layanan baru (bisa dipisah koma).' },
          status: { type: 'string', description: 'Status booking baru (pending, confirmed, in progress, completed, cancelled).' },
          customerName: { type: 'string', description: 'Nama pelanggan (opsional).' },
          customerPhone: { type: 'string', description: 'Nomor pelanggan (opsional).' },
          vehicleInfo: { type: 'string', description: 'Info kendaraan (opsional).' },
          notes: { type: 'string', description: 'Catatan tambahan (opsional).' },
          estimatedDurationMinutes: { type: 'number', description: 'Durasi estimasi baru (menit).' },
        },
        required: ['bookingId'],
      },
    },
  },
  implementation: async (args) => {
    try {
      const parsed = UpdateBookingSchema.parse(args || {});
      const { bookingId } = parsed;

      const firestore = ensureFirestore();
      const docRef = firestore.collection('bookings').doc(bookingId);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return {
          success: false,
          error: `Booking dengan ID ${bookingId} tidak ditemukan.`,
        };
      }

      const updatePayload = {};
      const existingData = snapshot.data() || {};

      if (parsed.customerName) updatePayload.customerName = parsed.customerName;
      let updatedNormalizedPhone = null;
      if (parsed.customerPhone) {
        updatePayload.customerPhone = parsed.customerPhone;
        updatedNormalizedPhone = normalizeWhatsappNumber(parsed.customerPhone);
        updatePayload.customerPhoneNormalized = updatedNormalizedPhone;
      }
      if (parsed.vehicleInfo) updatePayload.vehicleInfo = parsed.vehicleInfo;
      if (parsed.notes !== undefined) updatePayload.notes = parsed.notes;
      if (typeof parsed.estimatedDurationMinutes === 'number') {
        updatePayload.estimatedDurationMinutes = parsed.estimatedDurationMinutes;
      }

      const effectiveNormalizedPhone =
        updatedNormalizedPhone || existingData.customerPhoneNormalized || normalizeWhatsappNumber(existingData.customerPhone);

      if (parsed.homeService) {
        const homeServiceInput = parsed.homeService;
        const target = { ...existingData.homeService };

        if (typeof homeServiceInput.requested === 'boolean') {
          target.requested = homeServiceInput.requested;
        }

        let lat = homeServiceInput.latitude;
        let lng = homeServiceInput.longitude;
        let address = homeServiceInput.address;
        let label = homeServiceInput.label;
        const subtotalOverride = homeServiceInput.subtotal ?? parsed.subtotal;

        if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && effectiveNormalizedPhone) {
          const storedLocation = await getCustomerLocation(effectiveNormalizedPhone);
          if (storedLocation) {
            lat = lat ?? storedLocation.latitude;
            lng = lng ?? storedLocation.longitude;
            address = address || storedLocation.address || null;
            label = label || storedLocation.label || null;
          }
        }

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const calculation = await calculateHomeServiceFee({
            latitude: Number(lat),
            longitude: Number(lng),
            subtotal: subtotalOverride,
            freeRadiusKm: homeServiceInput.freeRadiusKm,
            feePerKm: homeServiceInput.feePerKm,
            baseFee: homeServiceInput.baseFee,
          });

          if (!calculation.success) {
            return {
              success: false,
              error: calculation.error || 'home_service_fee_failed',
              message: calculation.message || 'Gagal menghitung biaya home service saat update booking.',
            };
          }

          const merged = {
            ...target,
            requested: target.requested !== false,
            latitude: Number(lat),
            longitude: Number(lng),
            address: address || null,
            label: label || null,
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

          updatePayload.homeService = merged;

          if (effectiveNormalizedPhone) {
            try {
              await saveCustomerLocation(effectiveNormalizedPhone, {
                latitude: Number(lat),
                longitude: Number(lng),
                address: address || null,
                label: label || null,
                raw: homeServiceInput,
                source: 'booking-update',
              }, { skipHistory: false });
              await saveHomeServiceQuote(effectiveNormalizedPhone, merged);
            } catch (error) {
              console.warn('[updateBookingTool] Gagal menyimpan info home service ke Firestore:', error);
            }
          }
        } else if (typeof homeServiceInput.requested === 'boolean') {
          updatePayload.homeService = {
            ...target,
            requested: homeServiceInput.requested,
          };
        }
      }

      if (parsed.serviceName) {
        const servicesArray = parsed.serviceName.split(',').map(s => s.trim()).filter(Boolean);
        if (servicesArray.length > 0) {
          updatePayload.services = servicesArray;
          updatePayload.category = getServiceCategory(servicesArray[0]);
        }
      }

      let bookingDate = parsed.bookingDate;
      let bookingTime = parsed.bookingTime;

      if (bookingDate || bookingTime) {
        const existingDate = existingData.bookingDateTime?.toDate
          ? existingData.bookingDateTime.toDate()
          : existingData.bookingDateTime
            ? new Date(existingData.bookingDateTime)
            : new Date();

        let baseDate = existingDate;

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const timeRegex = /^\d{2}:\d{2}$/;

        if (bookingDate && !dateRegex.test(bookingDate)) {
          const parsedDate = parseDateTime(bookingDate);
          if (parsedDate.date) bookingDate = parsedDate.date;
        }

        if (bookingTime && !timeRegex.test(bookingTime)) {
          const parsedTime = parseDateTime(bookingTime);
          if (parsedTime.time) bookingTime = parsedTime.time;
        }

        const finalDate = bookingDate || formatDate(baseDate);
        const finalTime = bookingTime || formatTime(baseDate);
        const combined = new Date(`${finalDate}T${finalTime}:00`);

        if (Number.isNaN(combined.getTime())) {
          return {
            success: false,
            error: 'Format tanggal atau waktu tidak valid setelah parsing.',
          };
        }

        updatePayload.bookingDateTime = admin.firestore.Timestamp.fromDate(combined);
        updatePayload.bookingDate = formatDate(combined);
        updatePayload.bookingTime = formatTime(combined);
        updatePayload.reminderSent = false;
      }

      if (parsed.status) {
        const normalizedStatus = parsed.status.trim().toLowerCase();
        if (!STATUS_ALLOWLIST.includes(normalizedStatus)) {
          return {
            success: false,
            error: `Status tidak dikenali. Gunakan salah satu dari: ${STATUS_ALLOWLIST.join(', ')}`,
          };
        }
        updatePayload.status = normalizedStatus;
        if (normalizedStatus === 'cancelled') {
          updatePayload.reminderSent = true;
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return {
          success: false,
          error: 'Tidak ada field yang diubah. Sertakan minimal satu field yang ingin diperbarui.',
        };
      }

      updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await docRef.update(updatePayload);

      let summaryParts = [`Booking ${bookingId} berhasil diperbarui.`];
      if (updatePayload.bookingDateTime) {
        const updatedDate = updatePayload.bookingDateTime.toDate();
        summaryParts.push(`Jadwal baru: ${formatDate(updatedDate)} jam ${formatTime(updatedDate)}.`);
      }
      if (updatePayload.services) {
        summaryParts.push(`Layanan: ${updatePayload.services.join(', ')}.`);
      }
      if (updatePayload.status) {
        summaryParts.push(`Status: ${updatePayload.status}.`);
      }

      return {
        success: true,
        summary: summaryParts.join(' '),
      };
    } catch (error) {
      console.error('[updateBookingTool] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  },
};

module.exports = {
  updateBookingTool,
};
