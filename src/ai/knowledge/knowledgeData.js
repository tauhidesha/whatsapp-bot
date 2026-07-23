const studioMetadata = require('../constants/studioMetadata');

const serviceKnowledge = {
  "general": "Bosmat Repaint Studio adalah spesialis repaint dan detailing motor kelas premium.",
  "konsep_studio": "Bosmat mengusung konsep STUDIO CAT, BUKAN bengkel cat biasa. Lokasi studio memang berada di rumah Bosmat sendiri (Home Studio). Hal ini sengaja dirancang agar pengerjaan lebih eksklusif, detail, dan terpantau dengan baik. Jika ada customer yang bingung atau bertanya apakah benar lokasinya di rumah, konfirmasi bahwa itu BENAR. Semua pengerjaan cat dan detailing di-handle/dikerjakan langsung oleh Bosmat sendiri (Owner) tanpa dilempar ke teknisi lain, sehingga kualitasnya sangat terjaga dan konsisten.",
  "services": {
    "repaint": "Layanan cat ulang menggunakan bahan PU berkualitas.",
    "detailing": "Layanan pembersihan dan proteksi mendalam."
  },
  "faq": {
    "jam_buka": "Buka setiap hari jam 09.00 - 18.00 WIB.",
    "lokasi": `Lokasi lengkap: ${studioMetadata.location.address}. Google Maps: ${studioMetadata.location.googleMaps}. ${studioMetadata.location.landmark}. Konsepnya Home Studio, jadi jangan kaget kalau lokasinya memang di rumah.`
  }
};

module.exports = { serviceKnowledge };
