const studioMetadata = require('../constants/studioMetadata');

const serviceKnowledge = {
  "general": "Bosmat STUDIO adalah spesialis repaint dan detailing motor kelas premium.",
  "services": {
    "repaint": "Layanan cat ulang menggunakan bahan PU berkualitas.",
    "detailing": "Layanan pembersihan dan proteksi mendalam."
  },
  "faq": {
    "jam_buka": "Buka setiap hari jam 09.00 - 18.00 WIB.",
    "lokasi": `Lokasi lengkap: ${studioMetadata.location.address}. Google Maps: ${studioMetadata.location.googleMaps}. ${studioMetadata.location.landmark}.`
  }
};

module.exports = { serviceKnowledge };
