// File: src/ai/tools/updateBookingTool.js
// Tool to modify existing booking records in Prisma.

const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { parseDateTime } = require('../utils/dateTime.js');
const { getServiceCategory } = require('./createBookingTool.js');
const { getIdentifier } = require('../utils/humanHandover.js');
const { calculateHomeServiceFee } = require('../utils/distanceMatrix.js');
const { saveCustomerLocation, saveHomeServiceQuote, getCustomerLocation } = require('../utils/customerLocations.js');
const { createOrUpdateVehicle, extractPlateFromText } = require('../../lib/vehicleService');

const STATUS_ALLOWLIST = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const UpdateBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId wajib diisi'),
  bookingDate: z.string().optional(),
  bookingTime: z.string().optional(),
  serviceName: z.string().optional(),
  status: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  vehicleInfo: z.string().optional(),
  motorModel: z.string().optional(),
  motorPlate: z.string().optional(),
  notes: z.string().optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  subtotal: z.number().optional(),
  totalAmount: z.number().optional(),
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
  realPhone: z.string().optional(),
});

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
          bookingId: { type: 'string', description: 'ID booking yang ingin diubah.' },
          bookingDate: { type: 'string', description: 'Tanggal baru (YYYY-MM-DD atau frasa natural).' },
          bookingTime: { type: 'string', description: 'Jam baru (HH:mm atau frasa natural).' },
          serviceName: { type: 'string', description: 'Nama layanan baru (bisa dipisah koma).' },
          status: { type: 'string', description: 'Status booking baru (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED).' },
          customerName: { type: 'string', description: 'Nama pelanggan (opsional).' },
          customerPhone: { type: 'string', description: 'Nomor pelanggan (opsional).' },
          vehicleInfo: { type: 'string', description: 'Info kendaraan (opsional).' },
          motorModel: { type: 'string', description: 'Model motor (opsional).' },
          motorPlate: { type: 'string', description: 'Plat nomor motor (opsional).' },
          notes: { type: 'string', description: 'Catatan tambahan (opsional).' },
          estimatedDurationMinutes: { type: 'number', description: 'Durasi estimasi baru (menit).' },
          totalAmount: { type: 'number', description: 'Total biaya jasa/deal harga (pilihan).' },
          realPhone: { type: 'string', description: 'Nomor WhatsApp asli (opsional).' },
        },
        required: ['bookingId'],
      },
    },
  },
  implementation: async (args) => {
    try {
      const parsed = UpdateBookingSchema.parse(args || {});
      const { bookingId } = parsed;

      const existing = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true, vehicle: true }
      });

      if (!existing) {
        return {
          success: false,
          error: `Booking dengan ID ${bookingId} tidak ditemukan.`,
        };
      }

      const updateData = {};

      if (parsed.customerName) updateData.customerName = parsed.customerName;
      if (parsed.customerPhone) {
        updateData.customerPhone = getIdentifier(parsed.customerPhone);
      }
      if (parsed.realPhone !== undefined) updateData.realPhone = parsed.realPhone;
      if (parsed.notes !== undefined) updateData.notes = parsed.notes;

      // Handle vehicle update
      let vehicleId = existing.vehicleId;
      let vehicleModel = parsed.motorModel || existing.vehicleModel;
      let vehiclePlate = parsed.motorPlate || existing.plateNumber;

      if (parsed.motorModel || parsed.motorPlate || parsed.vehicleInfo) {
        const modelToUse = parsed.motorModel || (parsed.vehicleInfo ? parsed.vehicleInfo.split('(')[0].trim() : null);
        const plateToUse = parsed.motorPlate || extractPlateFromText(parsed.vehicleInfo);

        if (modelToUse || plateToUse) {
          try {
            // Get customer phone from the customer relation
            const customer = await prisma.customer.findUnique({
              where: { id: existing.customerId },
              select: { phone: true }
            });
            
            if (customer?.phone) {
              const vehicle = await createOrUpdateVehicle({
                phone: customer.phone,
                modelName: modelToUse || existing.vehicleModel,
                plateNumber: plateToUse,
              });
              vehicleId = vehicle.id;
              vehicleModel = vehicle.modelName;
              vehiclePlate = vehicle.plateNumber;
            }
          } catch (err) {
            console.warn('[updateBookingTool] Vehicle update failed:', err.message);
          }
        }
      }

      updateData.vehicleId = vehicleId;
      updateData.vehicleModel = vehicleModel;
      updateData.plateNumber = vehiclePlate;

      // Handle home service
      const customerData = await prisma.customer.findUnique({
        where: { id: existing.customerId },
        select: { phone: true }
      });
      const effectiveNormalizedPhone = customerData?.phone;

      if (parsed.homeService) {
        const homeServiceInput = parsed.homeService;

        if (typeof homeServiceInput.requested === 'boolean') {
          updateData.homeService = homeServiceInput.requested;
        }

        if (homeServiceInput.requested && (Number.isFinite(homeServiceInput.latitude) || Number.isFinite(homeServiceInput.longitude))) {
          const calculation = await calculateHomeServiceFee({
            latitude: homeServiceInput.latitude,
            longitude: homeServiceInput.longitude,
            subtotal: homeServiceInput.subtotal ?? parsed.subtotal,
            freeRadiusKm: homeServiceInput.freeRadiusKm,
            feePerKm: homeServiceInput.feePerKm,
            baseFee: homeServiceInput.baseFee,
          });

          if (calculation.success) {
            // Store as JSON in notes or create separate tracking
            const homeServiceData = {
              ...calculation,
              latitude: homeServiceInput.latitude,
              longitude: homeServiceInput.longitude,
              address: homeServiceInput.address,
              label: homeServiceInput.label,
            };
            updateData.notes = (updateData.notes || existing.notes || '') + `\n[Home Service Update] ${JSON.stringify(homeServiceData)}`;
          }
        }
      }

      // Handle service update
      if (parsed.serviceName) {
        const servicesArray = parsed.serviceName.split(',').map(s => s.trim()).filter(Boolean);
        if (servicesArray.length > 0) {
          updateData.serviceType = servicesArray.join('\n');
          updateData.category = getServiceCategory(servicesArray[0]);
        }
      }

      // Handle date/time update
      let bookingDate = parsed.bookingDate;
      let bookingTime = parsed.bookingTime;

      if (bookingDate || bookingTime) {
        const existingDate = existing.bookingDate instanceof Date 
          ? existing.bookingDate 
          : new Date(existing.bookingDate);

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

        const finalDate = bookingDate || formatDate(existingDate);
        const finalTime = bookingTime || formatTime(existingDate);
        const combined = new Date(`${finalDate}T${finalTime}:00`);

        if (Number.isNaN(combined.getTime())) {
          return {
            success: false,
            error: 'Format tanggal atau waktu tidak valid setelah parsing.',
          };
        }

        updateData.bookingDate = combined;
      }

      // Handle status update
      if (parsed.status) {
        const normalizedStatus = parsed.status.trim().toUpperCase().replace(' ', '_');
        
        // Map common status variations
        const statusMap = {
          'PENDING': 'PENDING',
          'CONFIRMED': 'CONFIRMED',
          'IN_PROGRESS': 'IN_PROGRESS',
          'INPROGRESS': 'IN_PROGRESS',
          'IN_PROG': 'IN_PROGRESS',
          'DONE': 'COMPLETED',
          'COMPLETED': 'COMPLETED',
          'SELESAI': 'COMPLETED',
          'CANCELLED': 'CANCELLED',
          'CANCELED': 'CANCELLED',
          'BATAL': 'CANCELLED',
        };

        const mappedStatus = statusMap[normalizedStatus] || normalizedStatus;
        
        if (!STATUS_ALLOWLIST.includes(mappedStatus)) {
          return {
            success: false,
            error: `Status tidak dikenali. Gunakan salah satu dari: ${STATUS_ALLOWLIST.join(', ')}`,
          };
        }
        updateData.status = mappedStatus;
      }

      if (parsed.totalAmount !== undefined) updateData.totalAmount = parsed.totalAmount;

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'Tidak ada field yang diubah. Sertakan minimal satu field yang ingin diperbarui.',
        };
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
      });

      // Sync financial and customer statistics
      try {
        const { syncBookingFinance } = require('../utils/financeSync.js');
        const { syncCustomer } = require('../utils/customerSync.js');
        await syncBookingFinance(bookingId);
        await syncCustomer(updated.customerId);
      } catch (syncErr) {
        console.warn('[updateBookingTool] Sync failed:', syncErr.message);
      }

      let summaryParts = [`Booking ${bookingId} berhasil diperbarui.`];
      if (updateData.bookingDate) {
        const updatedDate = updated.bookingDate instanceof Date ? updated.bookingDate : new Date(updated.bookingDate);
        summaryParts.push(`Jadwal baru: ${formatDate(updatedDate)} jam ${formatTime(updatedDate)}.`);
      }
      if (updateData.serviceType) {
        summaryParts.push(`Layanan: ${updateData.serviceType}.`);
      }
      if (updateData.status) {
        summaryParts.push(`Status: ${updateData.status}.`);
      }
      if (updateData.vehicleModel || updateData.plateNumber) {
        summaryParts.push(`Kendaraan: ${updateData.vehicleModel || '-'}${updateData.plateNumber ? ` (${updateData.plateNumber})` : ''}.`);
      }

      return {
        success: true,
        summary: summaryParts.join(' '),
        booking: {
          id: updated.id,
          status: updated.status,
          bookingDate: updated.bookingDate,
          vehicleModel: updated.vehicleModel,
          plateNumber: updated.plateNumber,
        },
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
