const prisma = require('../../lib/prisma.js');

/**
 * Mengelola state percakapan yang persisten di PostgreSQL via Prisma.
 */
async function updateState(senderNumber, data) {
    if (!senderNumber || !data || typeof data !== 'object') return;

    const phone = senderNumber.replace(/[^0-9]/g, '');
    
    try {
        await prisma.customerContext.upsert({
            where: { id: phone },
            update: {
                ...data,
                updatedAt: new Date()
            },
            create: {
                id: phone,
                phone: phone,
                ...data
            }
        });
        console.log(`[State] Updated SQL state for ${phone}:`, data);
    } catch (error) {
        console.error(`[State] Error updating SQL state for ${phone}:`, error);
    }
}

async function getState(senderNumber) {
    if (!senderNumber) return null;

    const phone = senderNumber.replace(/[^0-9]/g, '');
    
    try {
        const state = await prisma.customerContext.findUnique({
            where: { id: phone }
        });
        return state;
    } catch (error) {
        console.error(`[State] Error getting SQL state for ${phone}:`, error);
        return null;
    }
}

async function clearState(senderNumber) {
    if (!senderNumber) return;

    const phone = senderNumber.replace(/[^0-9]/g, '');
    
    try {
        await prisma.customerContext.delete({
            where: { id: phone }
        });
        console.log(`[State] Cleared SQL state for ${phone}`);
    } catch (error) {
        // Silently ignore if not exists
        if (!error.message?.includes('Record to delete does not exist')) {
            console.error(`[State] Error clearing SQL state for ${phone}:`, error);
        }
    }
}

module.exports = {
    updateState,
    getState,
    clearState
};

