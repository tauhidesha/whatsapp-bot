const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
const { normalizeWhatsappNumber } = require('./humanHandover.js');

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
}

function toDocId(senderNumber) {
  if (!senderNumber) return null;
  const normalized = normalizeWhatsappNumber(senderNumber);
  if (!normalized) return null;
  return normalized.replace(/@c\.us$/, '');
}

async function saveCustomerLocation(senderNumber, location, options = {}) {
  const firestore = ensureFirestore();
  const docId = toDocId(senderNumber);
  if (!docId) {
    console.warn('[customerLocations] Tidak dapat menyimpan lokasi, nomor tidak valid:', senderNumber);
    return null;
  }

  const {
    latitude,
    longitude,
    label = null,
    address = null,
    raw = null,
    source = 'whatsapp',
  } = location || {};

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    console.warn('[customerLocations] Latitude atau longitude tidak valid untuk', senderNumber);
    return null;
  }

  const payload = {
    lastKnownLocation: {
      latitude,
      longitude,
      label,
      address,
      source,
      raw,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await firestore.collection('directMessages').doc(docId).set(payload, { merge: true });

  if (!options.skipHistory) {
    const historyPayload = {
      latitude,
      longitude,
      label,
      address,
      source,
      raw,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await firestore
      .collection('directMessages')
      .doc(docId)
      .collection('locations')
      .add(historyPayload);
  }

  return payload.lastKnownLocation;
}

async function getCustomerLocation(senderNumber) {
  const firestore = ensureFirestore();
  const docId = toDocId(senderNumber);
  if (!docId) return null;

  const doc = await firestore.collection('directMessages').doc(docId).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  return data.lastKnownLocation || null;
}

async function saveHomeServiceQuote(senderNumber, quote) {
  const firestore = ensureFirestore();
  const docId = toDocId(senderNumber);
  if (!docId) return;

  const payload = {
    homeService: {
      ...quote,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await firestore.collection('directMessages').doc(docId).set(payload, { merge: true });
}

module.exports = {
  saveCustomerLocation,
  getCustomerLocation,
  saveHomeServiceQuote,
};
