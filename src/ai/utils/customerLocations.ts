import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../../lib/firebaseAdmin';
import { normalizeWhatsappNumber } from './humanHandover';

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
}

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
  const firestore = ensureFirestore();
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

  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  const payload = {
    lastKnownLocation: {
      latitude,
      longitude,
      label,
      address,
      source,
      raw,
      updatedAt: timestamp,
    },
    updatedAt: timestamp,
  };

  await firestore.collection('directMessages').doc(docId).set(payload, { merge: true });

  if (!options.skipHistory) {
    await firestore
      .collection('directMessages')
      .doc(docId)
      .collection('locations')
      .add({
        latitude,
        longitude,
        label,
        address,
        source,
        raw,
        createdAt: timestamp,
      });
  }

  return payload.lastKnownLocation;
}

export async function getCustomerLocation(senderNumber: string) {
  const firestore = ensureFirestore();
  const docId = toDocId(senderNumber);
  if (!docId) {
    return null;
  }

  const doc = await firestore.collection('directMessages').doc(docId).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  return data.lastKnownLocation ?? null;
}

export async function saveHomeServiceQuote(senderNumber: string, quote: Record<string, unknown>) {
  const firestore = ensureFirestore();
  const docId = toDocId(senderNumber);
  if (!docId) return;

  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  await firestore
    .collection('directMessages')
    .doc(docId)
    .set(
      {
        homeService: {
          ...quote,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      },
      { merge: true }
    );
}
