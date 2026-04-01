/**
 * File: src/ai/constants/studioMetadata.js
 * Single Source of Truth for Bosmat Studio information.
 * Ensure consistency across AI prompts, tools, and invoices.
 */

const studioMetadata = {
  name: 'Bosmat Repaint Detailing Motor',
  shortName: 'Bosmat',
  location: {
    address: 'Bukit Cengkeh 1, Jl. Medan No.B3/2, Kota Depok, Jawa Barat 16451',
    landmark: 'Dekat perempatan pertama setelah gapura Bukit Cengkeh 1',
    googleMaps: 'https://maps.app.goo.gl/JrH7TxyfPtGxBjW19',
    directions: 'Dari gapura Bukit Cengkeh 1 lurus sedikit, di perempatan pertama belok kanan. Rumah pertama cat hijau pagar hitam (dekat portal). Kalau portal ditutup, bisa masuk dari Jl. Padang atau Jl. Bengkulu. Langsung ketok atau panggil orang di dalam saja.',
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
    jumat: 'Tutup',
    sabtu: '08.00–17.00',
    minggu: '08.00–17.00',
  },
  bookingPolicy: {
    description: 'Sangat disarankan booking slot terlebih dahulu agar pengerjaan terjadwal dengan aman.',
    requirement: 'Wajib konfirmasi 1 hari sebelum kunjungan.'
  }
};

module.exports = studioMetadata;
