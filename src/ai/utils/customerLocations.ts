// @ts-ignore
import prisma from '../../lib/prisma';
// @ts-ignore
import { normalizeWhatsappNumber } from './humanHandover';

function toDocId(senderNumber?: string | null) {
  if (!senderNumber) return null;
  const normalized = normalizeWhatsappNumber(senderNumber);
  if (!normalized) return null;
  return normalized.replace(/@c\.us$/, '');
}

type CustomerLocation = {
  latitude: number;
  longitude: number;
  label?: string | null;
  address?: string | null;
  raw?: unknown;
  source?: string;
};

export async function saveCustomerLocation(
  senderNumber: string,
  location: CustomerLocation,
  options: { skipHistory?: boolean } = {}
) {
  const docId = toDocId(senderNumber);
  if (!docId) {
    console.warn('[customerLocations] Tidak dapat menyimpan lokasi, nomor tidak valid:', senderNumber);
    return null;
  }

  const { latitude, longitude, label = null, address = null, raw = null, source = 'whatsapp' } = location;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    console.warn('[customerLocations] Latitude atau longitude tidak valid untuk', senderNumber);
    return null;
  }

  // Find customer
  const normalizedPhone = docId.replace(/\D/g, '');
  const customer = await prisma.customer.findUnique({
    where: { phone: normalizedPhone }
  });

  if (!customer) {
    console.warn('[customerLocations] Customer tidak ditemukan:', normalizedPhone);
    return null;
  }

  // Save location to CustomerLocation table
  const savedLocation = await prisma.customerLocation.create({
    data: {
      customerId: customer.id,
      latitude,
      longitude,
      label,
      address,
      source,
    }
  });

  // Update customer with last known location
  await prisma.customer.update({
    where: { id: customer.id },
    data: { 
      // Store last location as JSON in notes or create a separate field
    }
  });

  return {
    latitude,
    longitude,
    label,
    address,
    source,
    updatedAt: savedLocation.createdAt.toISOString(),
  };
}

export async function getCustomerLocation(senderNumber: string) {
  const docId = toDocId(senderNumber);
  if (!docId) {
    return null;
  }

  const normalizedPhone = docId.replace(/\D/g, '');
  const customer = await prisma.customer.findUnique({
    where: { phone: normalizedPhone },
    include: {
      locations: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!customer || customer.locations.length === 0) return null;

  const latest = customer.locations[0];
  return {
    latitude: latest.latitude,
    longitude: latest.longitude,
    label: latest.label,
    address: latest.address,
    source: latest.source,
  };
}

export async function saveHomeServiceQuote(senderNumber: string, quote: Record<string, unknown>) {
  const docId = toDocId(senderNumber);
  if (!docId) return;

  const normalizedPhone = docId.replace(/\D/g, '');
  const customer = await prisma.customer.findUnique({
    where: { phone: normalizedPhone }
  });

  if (!customer) return;

  // Store home service quote in customer notes as JSON
  const existingNotes = customer.notes ? JSON.parse(customer.notes) : {};
  const homeServiceData = {
    ...quote,
    updatedAt: new Date().toISOString(),
  };

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      notes: JSON.stringify({
        ...existingNotes,
        homeService: homeServiceData
      })
    }
  });
}