/**
 * File: src/ai/constants/studioMetadata.js
 * Single Source of Truth for Bosmat Studio information.
 * Ensure consistency across AI prompts, tools, and invoices.
 */

const studioMetadata = {
  name: 'Bosmat Repaint and Detailing',
  shortName: 'Bosmat',
  location: {
    address: 'Jl. Medan B3/2 Tugu Kecamatan Cimanggis Kota Depok',
    landmark: 'masuk gapura bukit cengkeh 1 gang pertama di sebelah kanan belok kanan rumah hijau pertama sebelah kiri b3/2. sudah di depan rumah bisa panggil atau call wa. portal jalan medan kadang ditutup. bisa masuk dari jalan padang/bengkulu.',
    googleMaps: 'https://maps.app.goo.gl/u29Z4pEC4ukk9cWDA',
    directions: 'masuk gapura bukit cengkeh 1 gang pertama di sebelah kanan belok kanan rumah hijau pertama sebelah kiri b3/2. sudah di depan rumah bisa panggil atau call wa. portal jalan medan kadang ditutup. bisa masuk dari jalan padang/bengkulu.',
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
