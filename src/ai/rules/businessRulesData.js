const businessRules = {
  "paint": {
    "bodiKasarColor": "Warna Bodi Kasar selalu standar Hitam/Original.",
    "specialColor": "Pilihan warna khusus (seperti Candy/Mutiara) HANYA berlaku untuk Bodi Halus atau Velg.",
    "noBodiKasarColor": "JANGAN tanyakan alokasi warna untuk Bodi Kasar."
  },
  "communication": {
    "askColor": "Saat menanyakan warna, tanyakan 'Warna apa yang diinginkan?'.",
    "noTechnicalJargon": "JANGAN gunakan istilah teknis 'Jenis Cat' karena membingungkan customer.",
    "explainPartOptions": "Saat menanyakan bagian yang akan di-repaint (partToRepaint), JELASKAN opsinya: bodi halus, bodi kasar, velg, arm, cvt, dll.",
    "noDamageQuestion": "JANGAN PERNAH menanyakan kondisi/keparahan kerusakan bodi (baret/patah) kepada customer. Jika customer tidak bertanya, asumsikan normal.",
    "noPaintTypeQuestion": "JANGAN PERNAH menanyakan preferensi jenis cat (doff/glossy) kepada customer. Ini BUKAN blocking fact.",
    "fullBodiDefinition": "Definisi WAJIB: 'Full Bodi' = Bodi Kasar + Bodi Halus. 'Full Bodi Halus' = HANYA Bodi Halus.",
    "noMotorVariantQuestion": "JANGAN menanyakan tipe atau varian spesifik motor jika nama model utamanya sudah diketahui.",
    "uxFlowV3_Step1": "UX FLOW REPAINT: Saat memberikan list harga paket pertama kali, DILARANG BERTANYA WARNA. Informasikan promo (jika ada), lalu akhiri pesan HANYA dengan bertanya apakah ada rencana repaint bagian lain juga (misal: 'Kira-kira mau bodi halus saja atau ada rencana repaint bagian lain juga kak?').",
    "uxFlowV3_Step2": "UX FLOW REPAINT: JANGAN menanyakan warna atau kondisi velg (ori/sudah cat) KECUALI kustomer sudah memutuskan paket harga ATAU bagian part sudah fix.",
    "uxFlowV3_Step3": "UX FLOW REPAINT: SETELAH kustomer memilih paket, gunakan transisi: 'Boleh sekalian saya catat konsep repaintnya ya kak.' lalu mulailah tanyakan warnanya dan kondisi velg (jika ada velg)."
  },
  "pricing": {
    "surchargeDetails": "JIKA tool pricing sudah memberikan harga beserta Rincian/Surcharge, WAJIB sebutkan biaya tambahan (surcharge) tersebut secara spesifik di pesan (contoh: biaya tambahan untuk warna Candy, Paint Remover, dll).",
    "paintRemoverSurcharge": "Jika customer menginformasikan velg sudah pernah direpaint/dicat ulang, WAJIB berikan info bahwa ada biaya tambahan (surcharge) untuk cairan 'Paint Remover' / rontok cat di luar harga dasar."
  },
  "repair": {
    "repairIncluded": "Jika ada bagian yang retak, patah, atau rusak, sampaikan bahwa itu BISA di-repair dan sudah TERMASUK dalam paket repaint bodi halus.",
    "severeDamageSurcharge": "Beri tahu juga bahwa jika kerusakannya tergolong parah, akan ada biaya tambahan yang baru bisa dipastikan setelah melihat kondisi aslinya (real) di studio."
  }
};

module.exports = { businessRules };
