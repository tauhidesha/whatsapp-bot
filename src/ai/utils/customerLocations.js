const prisma = require('../../lib/prisma.js');
const { parseSenderIdentity } = require('../../lib/utils.js');

async function saveCustomerLocation(senderNumber, location, options = {}) {
  const { docId: phone } = parseSenderIdentity(senderNumber);
  if (!phone) return null;

  const {
    latitude,
    longitude,
    label = null,
    address = null,
    source = 'whatsapp',
  } = location || {};

  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  try {
    // 1. Save to Location History
    if (!options.skipHistory) {
      await prisma.customerLocation.create({
        data: {
          customerId: phone,
          latitude,
          longitude,
          address,
          label,
          source,
        }
      });
    }

    // 2. Update CustomerContext with latest location hint
    if (address || label) {
      await prisma.customerContext.upsert({
        where: { phone },
        update: { locationHint: address || label },
        create: { id: phone, phone, locationHint: address || label }
      });
    }

    return { latitude, longitude, label, address, source };
  } catch (err) {
    console.error('[customerLocations] SQL Error:', err.message);
    return null;
  }
}

async function getCustomerLocation(senderNumber) {
  const { docId: phone } = parseSenderIdentity(senderNumber);
  if (!phone) return null;

  try {
    const loc = await prisma.customerLocation.findFirst({
      where: { customerId: phone },
      orderBy: { createdAt: 'desc' }
    });
    return loc;
  } catch (err) {
    return null;
  }
}

async function saveHomeServiceQuote(senderNumber, quote) {
  const { docId: phone } = parseSenderIdentity(senderNumber);
  if (!phone) return;

  try {
    await prisma.customerContext.upsert({
      where: { phone },
      update: { quotedServices: quote },
      create: { id: phone, phone, quotedServices: quote }
    });
  } catch (err) {
    console.error('[customerLocations] Quote save failed:', err.message);
  }
}

module.exports = {
  saveCustomerLocation,
  getCustomerLocation,
  saveHomeServiceQuote,
};
