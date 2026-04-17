/**
 * File: src/ai/constants/studioMetadata.js
 * Single Source of Truth for Bosmat Studio information.
 * Ensure consistency across AI prompts, tools, and invoices.
 */

const studioMetadata = {
  name: 'Bosmat x Garasi 54',
  shortName: 'Bosmat',
  location: {
    address: 'Jl. Raden Sanim No.99, Tanah Baru, Kecamatan Beji, Kota Depok, Jawa Barat 16426',
    landmark: 'Dekat Sekolah Tunas Iblam',
    googleMaps: 'https://maps.app.goo.gl/m71ihhee1q9XVveu5',
    directions: 'Langsung menuju Jl. Raden Sanim No.99, Tanah Baru. Patokannya dekat dengan Sekolah Tunas Iblam.',
  },
  contact: {
    phone: '0895401527556',
    whatsapp: '089541527556', // User-facing preferred
    adminNumber: '081212345678', // Example placeholders or placeholders for logic
  },
  hours: {
    senin: '08.00–17.00',
    selasa: '08.00–17.00',
    rabu: '08.00–17.00',
    kamis: '08.00–17.00',
    jumat: '08.00–17.00',
    sabtu: '08.00–17.00',
    minggu: 'Libur',
  },
  bookingPolicy: {
    description: 'Sangat disarankan booking slot terlebih dahulu agar pengerjaan terjadwal dengan aman.',
    requirement: 'Wajib konfirmasi 1 hari sebelum kunjungan.'
  }
};

module.exports = studioMetadata;
