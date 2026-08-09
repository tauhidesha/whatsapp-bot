const prisma = require('../../../lib/prisma');
const { DateTime } = require('luxon');
const studioMetadata = require('../../constants/studioMetadata');

/**
 * Node: init
 * Me-load context pelanggan dari CRM untuk dipergunakan di seluruh graf.
 * @param {Object} state - State saat ini
 * @returns {Object} State update (customer data)
 */
async function initNode(state) {
    console.log('--- [INIT_NODE] Starting ---');
    const { messages, metadata } = state;
    const phoneReal = metadata?.phoneReal;
    
    // Admin Detection (Always check at start)
    const isAdmin = metadata?.isAdmin || false;

    if (isAdmin) {
        console.log('👑 [INIT_NODE] Admin detected! Switching to Admin Mode.');
    }

    // Default Date/Time for AI Reference
    const nowJkt = DateTime.now().setZone('Asia/Jakarta').setLocale('id');
    const currentDateTime = {
        iso: nowJkt.toISO(),
        formatted: nowJkt.toFormat('dd MMMM yyyy, HH:mm') + ' WIB',
        dayName: nowJkt.toFormat('cccc'),
        date: nowJkt.toFormat('yyyy-MM-dd'),
        time: nowJkt.toFormat('HH:mm')
    };

    if (!phoneReal && !isAdmin) {
        console.log('[INIT_NODE] No phoneReal, using default fallback.');
        return { 
            isAdmin: false,
            customer: { name: metadata?.senderName || `Sobat ${studioMetadata.shortName}` },
            metadata: { ...metadata, currentDateTime }
        };
    }

    try {
        if (!phoneReal) {
            return {
                isAdmin: isAdmin,
                customer: {
                    name: isAdmin ? 'Admin' : (metadata?.senderName || `Sobat ${studioMetadata.shortName}`),
                    status: 'new'
                },
                metadata: { ...metadata, currentDateTime }
            };
        }

        // Cari pelanggan di database - phoneReal pasti ada di sini
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: phoneReal },
                    { whatsappLid: phoneReal }
                ]
            },
            include: {
                vehicles: true,
                customerContext: true
            }
        });

        if (!customer) {
            return {
                isAdmin: isAdmin,
                customer: {
                    name: metadata?.senderName || (isAdmin ? 'Admin' : `Sobat ${studioMetadata.shortName}`),
                    status: 'new'
                },
                metadata: { ...metadata, currentDateTime }
            };
        }

        const dbCtx = customer.customerContext || {};

        // Return state update
        const result = {
            isAdmin: isAdmin,
            customer: {
                id: customer.id,
                name: customer.name || metadata?.senderName || (isAdmin ? 'Admin' : `Sobat ${studioMetadata.shortName}`),
                phone: customer.phone,
                status: customer.status,
                vehicles: customer.vehicles.map(v => ({
                    model: v.modelName,
                    plate: v.plateNumber
                }))
            },
            // Push CRM context into LangGraph V2 State
            vehicle: {
                brand: dbCtx.motorBrand || null,
                model: dbCtx.motorModel || null,
                paintType: dbCtx.paintType || null,
                currentCondition: null // We don't have this in dbCtx yet
            },
            consultation: {
                requestedServices: dbCtx.targetServices || [],
                knownFacts: {
                    colorChoice: dbCtx.motorColor || null,
                    isBongkarTotal: dbCtx.isBongkarTotal ?? null,
                    serviceDetail: dbCtx.serviceDetail || null
                }
            },
            metadata: {
                ...metadata,
                currentDateTime: currentDateTime
            }
        };
        // ── Active Booking Lookup ─────────────────────────────────────────────────
        // Detect customer type so Zoya knows from turn 1 whether the motor is
        // currently being worked on, has an upcoming booking, or is a returning customer.
        try {
            const STATUS_ACTIVE  = ['PENDING', 'CONFIRMED', 'IN_QUEUE', 'IN_PROGRESS'];
            const STATUS_ONGOING = ['IN_PROGRESS', 'IN_QUEUE'];
            const STATUS_LABEL   = {
                PENDING: 'Menunggu Konfirmasi', CONFIRMED: 'Sudah Dikonfirmasi',
                IN_QUEUE: 'Dalam Antrian', IN_PROGRESS: 'Sedang Dikerjakan',
                COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
            };

            const activeBookings = await prisma.booking.findMany({
                where: { customerId: customer.id, status: { in: STATUS_ACTIVE } },
                orderBy: { bookingDate: 'asc' },
                take: 3,
                select: {
                    id: true, status: true, serviceType: true,
                    bookingDate: true, vehicleModel: true, plateNumber: true, adminNotes: true
                }
            });

            const isMotorBeingWorkedOn = activeBookings.some(b => STATUS_ONGOING.includes(b.status));
            const customerType = isMotorBeingWorkedOn ? 'in_service'
                : activeBookings.length > 0 ? 'has_active_booking'
                : customer.status !== 'new' ? 'returning'
                : 'new';

            result.customerBookingContext = {
                customerType,
                isMotorBeingWorkedOn,
                activeBookings: activeBookings.map(b => ({
                    bookingId: b.id.slice(-8).toUpperCase(),
                    status: b.status,
                    statusLabel: STATUS_LABEL[b.status] || b.status,
                    service: b.serviceType,
                    date: b.bookingDate
                        ? new Date(b.bookingDate).toLocaleDateString('id-ID', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                          })
                        : 'Tanggal belum ditentukan',
                    motor: b.vehicleModel || '-',
                    plate: b.plateNumber || '-',
                    adminNotes: b.adminNotes || null,
                }))
            };
        } catch (bookingErr) {
            console.warn('[initNode] Booking lookup failed (non-fatal):', bookingErr.message);
            result.customerBookingContext = { customerType: 'unknown', isMotorBeingWorkedOn: false, activeBookings: [] };
        }
        // ─────────────────────────────────────────────────────────────────────────

        console.log('[initNode] Output:', JSON.stringify(result, null, 2));
        return result;


    } catch (error) {
        console.error('[initNode] Error loading customer:', error);
        return { 
            isAdmin: isAdmin,
            customer: { name: `Sobat ${studioMetadata.shortName}` },
            metadata: { ...metadata, currentDateTime }
        };
    }
}

module.exports = { initNode };
