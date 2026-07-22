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
