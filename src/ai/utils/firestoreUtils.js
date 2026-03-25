// File: src/ai/utils/firestoreUtils.js
// Transitioned to Prisma! Keeping filename temporarily.
const prisma = require('../../lib/prisma.js');
const { parseSenderIdentity } = require('../../lib/utils.js');

/**
 * Save a message to Supabase DirectMessage table.
 * @param {string} senderNumber - Raw sender number (@c.us or @lid)
 * @param {string} message - Message text
 * @param {string} senderType - 'user', 'assistant', or 'admin'
 */
async function saveMessageToFirestore(senderNumber, message, senderType) {
    const role = senderType === 'ai' ? 'assistant' : senderType;
    const { docId } = parseSenderIdentity(senderNumber);
    if (!docId) return;

    try {
        let customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: docId },
                    { whatsappLid: senderNumber }
                ]
            }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    phone: docId,
                    whatsappLid: senderNumber.includes('@lid') ? senderNumber : null,
                    status: 'new'
                }
            });
        }

        await prisma.directMessage.create({
            data: {
                customerId: customer.id,
                senderId: senderNumber,
                role: role,
                content: typeof message === 'string' ? message : JSON.stringify(message)
            }
        });
        
        await prisma.customer.update({
             where: { id: customer.id },
             data: { updatedAt: new Date() }
        });

    } catch (error) {
        console.error('Error saving to Prisma DB:', error);
    }
}

module.exports = { saveMessageToFirestore };
