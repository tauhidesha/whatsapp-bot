const businessRules = {
  "paint": [
    "Warna Bodi Kasar selalu standar Hitam/Original.",
    "Pilihan warna khusus (seperti Candy/Mutiara) HANYA berlaku untuk Bodi Halus atau Velg.",
    "JANGAN tanyakan alokasi warna untuk Bodi Kasar."
  ],
  "communication": [
    "Saat menanyakan warna, tanyakan 'Warna apa yang diinginkan?'.",
    "JANGAN gunakan istilah teknis 'Jenis Cat' karena membingungkan customer.",
    "Saat menanyakan bagian yang akan di-repaint (partToRepaint), JELASKAN opsinya: bodi halus, bodi kasar, velg, arm, cvt, dll."
  ],
  "pricing": [
    // Tambahkan aturan harga default di sini jika ada
  ]
};

module.exports = { businessRules };
