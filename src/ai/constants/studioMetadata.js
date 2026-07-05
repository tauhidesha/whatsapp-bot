/**
 * File: src/ai/constants/studioMetadata.js
 * Single Source of Truth for Bosmat Studio information.
 * Ensure consistency across AI prompts, tools, and invoices.
 */

const studioMetadata = {
  name: 'Bosmat Repaint Detailing Studio',
  shortName: 'Bosmat',
  location: {
    address: 'Bukit Cengkeh 1, Jl. Medan No.B3/2, Tugu, Kec. Cimanggis, Kota Depok, Jawa Barat 16451',
    landmark: 'Dekat gapura bukit cengkeh 1',
    googleMaps: 'https://maps.app.goo.gl/pBgpmG2EoGRrKX9v5',
    directions: 'patokan masuk gapura bukit cengkeh 1 ada gg pertama di sebelah kanan jl medan. masuk situ nanti workshop kita ada dirumah pertama warna hijau sebelah kiri. wa kita aja kalau udah didepan atau bisa panggil saja. Kalau portal jl.medan ditutup bisa masuk dari jl. padang/jl. bengkulu',
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
