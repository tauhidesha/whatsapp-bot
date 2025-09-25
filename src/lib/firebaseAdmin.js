// File: src/lib/firebaseAdmin.js
// Minimal helper to access a singleton firebase-admin instance.

const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin;
}

module.exports = {
  getFirebaseAdmin,
};
