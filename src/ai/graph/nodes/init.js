const { PrismaClient } = require('@prisma/client');
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

    if (!phoneReal) {
        console.log('[INIT_NODE] No phoneReal, using default Stranger.');
        return { customer: { name: 'Stranger' } };
    }

    try {
        // Cari pelanggan di database
        const customer = await prisma.customer.findUnique({
            where: { phone: phoneReal },
            include: {
                vehicles: true,
                customerContext: true
            }
        });

        if (!customer) {
            return {
                customer: {
                    name: 'Guest',
                    status: 'new'
                }
            };
        }

        // Simpan data pelanggan yang relevan ke state
        return {
            customer: {
                id: customer.id,
                name: customer.name || 'Sobat BosMat',
                phone: customer.phone,
                status: customer.status,
                vehicles: customer.vehicles.map(v => ({
                    model: v.modelName,
                    plate: v.plateNumber
                }))
            }
        };

    } catch (error) {
        console.error('[initNode] Error loading customer:', error);
        return { customer: { name: 'Sobat BosMat' } };
    }
}

module.exports = { initNode };
