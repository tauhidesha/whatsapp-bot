// File: src/lib/firebaseAdmin.js
// [DEPRECATED] Migrated to Prisma (SQL)

module.exports = {
  getFirebaseAdmin: () => {
    console.warn('[Firebase] getFirebaseAdmin() is DEPRECATED. Use Prisma instead.');
    return { apps: [] };
  },
};
