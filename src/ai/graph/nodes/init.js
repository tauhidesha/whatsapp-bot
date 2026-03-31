const { PrismaClient } = require('@prisma/client');
const { DateTime } = require('luxon');
const prisma = new PrismaClient();

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
    const adminNumber = (process.env.BOSMAT_ADMIN_NUMBER || '').replace(/\D/g, '');
    const senderNumber = (metadata?.fullSenderId || metadata?.phoneReal || '').replace(/\D/g, '');
    const isAdmin = !!(adminNumber && senderNumber.includes(adminNumber));

    if (isAdmin) {
        console.log('👑 [INIT_NODE] Admin detected! Switching to Admin Mode.');
    }

    // Default Date/Time for AI Reference
    const nowJkt = DateTime.now().setZone('Asia/Jakarta');
    const currentDateTime = {
        iso: nowJkt.toISO(),
        formatted: nowJkt.toFormat('dd MMMM yyyy, HH:mm'),
        dayName: nowJkt.toFormat('cccc'),
        date: nowJkt.toFormat('yyyy-MM-dd'),
        time: nowJkt.toFormat('HH:mm')
    };

    if (!phoneReal && !isAdmin) {
        console.log('[INIT_NODE] No phoneReal, using default Stranger.');
        return { 
            isAdmin: false,
            customer: { name: 'Stranger' },
            metadata: { ...metadata, currentDateTime }
        };
    }

    try {
        // Cari pelanggan di database
        const customer = await prisma.customer.findUnique({
            where: { phone: phoneReal || senderNumber },
            include: {
                vehicles: true,
                customerContext: true
            }
        });

        if (!customer) {
            return {
                isAdmin: isAdmin,
                customer: {
                    name: isAdmin ? 'Admin' : 'Guest',
                    status: 'new'
                },
                metadata: { ...metadata, currentDateTime }
            };
        }

        // Return state update
        return {
            isAdmin: isAdmin,
            customer: {
                id: customer.id,
                name: customer.name || (isAdmin ? 'Admin' : 'Sobat BosMat'),
                phone: customer.phone,
                status: customer.status,
                vehicles: customer.vehicles.map(v => ({
                    model: v.modelName,
                    plate: v.plateNumber
                }))
            },
            metadata: {
                ...metadata,
                currentDateTime: currentDateTime
            }
        };

    } catch (error) {
        console.error('[initNode] Error loading customer:', error);
        return { 
            isAdmin: isAdmin,
            customer: { name: 'Sobat BosMat' },
            metadata: { ...metadata, currentDateTime }
        };
    }
}

module.exports = { initNode };
