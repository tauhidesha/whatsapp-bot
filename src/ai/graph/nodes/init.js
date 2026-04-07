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
    const { messages, metadata, context } = state;
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
        console.log('[INIT_NODE] No phoneReal, using default Stranger.');
        return { 
            isAdmin: false,
            customer: { name: 'Stranger' },
            metadata: { ...metadata, currentDateTime }
        };
    }

    try {
        if (!phoneReal) {
            return {
                isAdmin: isAdmin,
                customer: {
                    name: isAdmin ? 'Admin' : 'Guest',
                    status: 'new'
                },
                metadata: { ...metadata, currentDateTime }
            };
        }

        // Cari pelanggan di database - phoneReal pasti ada di sini
        const customer = await prisma.customer.findUnique({
            where: { phone: phoneReal },
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

        const dbCtx = customer.customerContext || {};

        // Return state update
        return {
            isAdmin: isAdmin,
            customer: {
                id: customer.id,
                name: customer.name || (isAdmin ? 'Admin' : `Sobat ${studioMetadata.shortName}`),
                phone: customer.phone,
                status: customer.status,
                vehicles: customer.vehicles.map(v => ({
                    model: v.modelName,
                    plate: v.plateNumber
                }))
            },
            // Push CRM context into LangGraph context if state is currently empty for those fields
            context: {
                ...context,
                vehicleType: context.vehicleType || dbCtx.motorModel || null,
                visualSummary: context.visualSummary || dbCtx.visualSummary || null,
                customerLabel: dbCtx.customerLabel || 'stranger',
                explicitlyRejected: dbCtx.explicitlyRejected || false,
                serviceTypes: context.serviceTypes?.length > 0 ? context.serviceTypes : (dbCtx.targetServices || []),
                colorChoice: context.colorChoice || dbCtx.motorColor || null,
                paintType: context.paintType || dbCtx.paintType || null,
                isBongkarTotal: context.isBongkarTotal !== null ? context.isBongkarTotal : (dbCtx.isBongkarTotal ?? null),
                serviceDetail: context.serviceDetail || dbCtx.serviceDetail || null,
                isReadyForTools: context.isReadyForTools || (dbCtx.conversationStage === 'ready')
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
            customer: { name: `Sobat ${studioMetadata.shortName}` },
            metadata: { ...metadata, currentDateTime }
        };
    }
}

module.exports = { initNode };
