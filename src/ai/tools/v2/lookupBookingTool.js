const BaseTool = require('./baseTool');
const prisma = require('../../../lib/prisma');

/**
 * LookupBookingTool — Cari booking aktif atau riwayat customer berdasarkan phone number.
 *
 * Dipakai ketika Zoya perlu tahu apakah customer sedang dalam pengerjaan,
 * punya booking aktif, atau hanya customer lama / baru konsultasi.
 *
 * Capability: 'lookup_booking'
 */

const STATUS_ACTIVE   = ['pending', 'waiting', 'confirmed', 'in_queue', 'in_progress'];
const STATUS_ONGOING  = ['in_progress', 'in_queue'];
const STATUS_LABEL_ID = {
    pending:     'Menunggu',
    waiting:     'Menunggu',
    confirmed:   'Sudah Dikonfirmasi',
    in_queue:    'Dalam Antrian',
    in_progress: 'Sedang Dikerjakan',
    done:        'Selesai',
    completed:   'Selesai',
    cancelled:   'Dibatalkan',
};

class LookupBookingTool extends BaseTool {
    constructor() {
        super();
        this.description = 'Cari booking aktif / riwayat customer. Gunakan untuk mengetahui apakah motor customer sedang dikerjakan, apakah ada booking aktif, atau apakah dia customer lama.';
        this.capability  = 'lookup_booking';
    }

    async _run(parameters, state) {
        const phone = state.metadata?.phoneReal || parameters?.phone;

        if (!phone) {
            return {
                rawText: { found: false, reason: 'No phone number available' },
                success: false
            };
        }

        try {
            // Cari customer
            const customer = await prisma.customer.findFirst({
                where: {
                    OR: [{ phone }, { whatsappLid: phone }]
                },
                select: { id: true, name: true, status: true, totalSpending: true }
            });

            if (!customer) {
                return {
                    rawText: {
                        found: false,
                        customerType: 'new',
                        reason: 'Customer belum terdaftar di database.'
                    },
                    success: true
                };
            }

            // Ambil booking aktif terbaru
            const activeBookings = await prisma.booking.findMany({
                where: {
                    customerId: customer.id,
                    status: { in: STATUS_ACTIVE }
                },
                orderBy: { bookingDate: 'asc' },
                take: 3,
                select: {
                    id: true,
                    status: true,
                    serviceType: true,
                    bookingDate: true,
                    vehicleModel: true,
                    plateNumber: true,
                    notes: true,
                    adminNotes: true,
                }
            });

            // Ambil booking terakhir (termasuk yang sudah selesai)
            const lastBooking = await prisma.booking.findFirst({
                where: { customerId: customer.id },
                orderBy: { bookingDate: 'desc' },
                select: {
                    id: true,
                    status: true,
                    serviceType: true,
                    bookingDate: true,
                    vehicleModel: true,
                    plateNumber: true,
                }
            });

            const isMotorBeingWorkedOn = activeBookings.some(b =>
                STATUS_ONGOING.includes(b.status)
            );

            const activeFormatted = activeBookings.map(b => ({
                bookingId: b.id.slice(-8).toUpperCase(),
                status: b.status,
                statusLabel: STATUS_LABEL_ID[b.status] || b.status,
                service: b.serviceType,
                date: b.bookingDate
                    ? new Date(b.bookingDate).toLocaleDateString('id-ID', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })
                    : 'Tanggal belum ditentukan',
                motor: b.vehicleModel || '-',
                plate: b.plateNumber || '-',
                adminNotes: b.adminNotes || null,
            }));

            // Cek apakah ada progress update terbaru untuk booking aktif
            let latestProgress = null;
            if (activeBookings.length > 0) {
                try {
                    const progressRecord = await prisma.progressUpdate.findFirst({
                        where: { bookingId: { in: activeBookings.map(b => b.id) } },
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            mediaUrls: true,
                            mediaTypes: true,
                            caption: true,
                            sentAt: true,
                            createdAt: true,
                            bookingId: true,
                        }
                    });

                    if (progressRecord) {
                        latestProgress = {
                            progressId: progressRecord.id,
                            bookingId:  progressRecord.bookingId,
                            mediaCount: progressRecord.mediaUrls.length,
                            caption:    progressRecord.caption,
                            sentAt:     progressRecord.sentAt,
                            updatedAt:  new Date(progressRecord.createdAt).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            }),
                        };
                    }
                } catch (progErr) {
                    console.warn('[LookupBookingTool] Progress lookup failed:', progErr.message);
                }
            }

            const customerType = isMotorBeingWorkedOn
                ? 'in_service'
                : activeBookings.length > 0
                ? 'has_active_booking'
                : lastBooking
                ? 'returning'
                : 'new';

            return {
                rawText: {
                    found: true,
                    customerType,          // 'new' | 'returning' | 'has_active_booking' | 'in_service'
                    customerName: customer.name || null,
                    isMotorBeingWorkedOn,
                    activeBookings: activeFormatted,
                    latestProgress,        // null jika belum ada update progress
                    totalPastBookings: lastBooking ? 1 : 0, // minimal proxy
                },
                success: true
            };


        } catch (err) {
            console.error('[LookupBookingTool] Error:', err.message);
            return {
                rawText: { found: false, reason: 'Database error: ' + err.message },
                success: false
            };
        }
    }
}

module.exports = new LookupBookingTool();
