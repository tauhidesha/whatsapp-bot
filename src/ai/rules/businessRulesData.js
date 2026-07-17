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
    "JIKA tool pricing sudah memberikan harga beserta Rincian/Surcharge, WAJIB sebutkan biaya tambahan (surcharge) tersebut secara spesifik di pesan (contoh: biaya tambahan untuk warna Candy, Paint Remover, dll).",
    "Jika customer menginformasikan velg sudah pernah direpaint/dicat ulang, WAJIB berikan info bahwa ada biaya tambahan (surcharge) untuk cairan 'Paint Remover' / rontok cat di luar harga dasar."
  ],
  "repair": [
    "Jika ada bagian yang retak, patah, atau rusak, sampaikan bahwa itu BISA di-repair dan sudah TERMASUK dalam paket repaint bodi halus.",
    "Beri tahu juga bahwa jika kerusakannya tergolong parah, akan ada biaya tambahan yang baru bisa dipastikan setelah melihat kondisi aslinya (real) di studio."
  ]
};

module.exports = { businessRules };
