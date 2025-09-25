// File: src/data/deskripsiLayanan.ts
// Data ini di-convert dari docs/deskripsi_layanan.json agar bisa di-import langsung di Next.js/Vercel

const deskripsiLayanan = [
  {
    "name": "Repaint Bodi Halus",
    "category": "repaint",
    "summary": "Cat ulang bodi motor pakai bahan premium (PU & HS) untuk hasil mulus seperti pabrikan.",
    "description": "- Bahan cat menggunakan full PU - Untuk clear coat menggunakan clearcoat jenis HS - Harga untuk warna solid/metalik. Candy, bunglon, moonlight dikenakan tambahan 150–350rb tergantung motor. - Repaint hasil kulit jeruk tipis ala pabrik (bisa lebih halus dengan tambahan poles) - Estimasi pengerjaan repaint: 5–6 hari kerja tergantung kondisi dan antrian"
  },
  {
    "name": "Repaint Bodi Kasar",
    "category": "repaint",
    "summary": "Hitamkan kembali dek dan bodi kasar motormu yang sudah kusam atau tergores.",
    "description": "Pengecatan ulang bagian bodi kasar atau dek motor."
  },
  {
    "name": "Repaint Velg",
    "category": "repaint",
    "summary": "Bikin tampilan kaki-kaki motormu jadi baru lagi dengan cat ulang velg.",
    "description": "Pengecatan ulang sepasang velg (pelek) motor."
  },
  {
    "name": "Repaint Cover CVT / Arm",
    "category": "repaint",
    "summary": "Segarkan tampilan area mesin dan arm motormu dengan pengecatan ulang.",
    "description": "Pengecatan ulang bagian cover CVT atau swing arm. Harga sama untuk kebanyakan motor."
  },
  {
    "name": "Detailing Mesin",
    "category": "detailing",
    "summary": "Membersihkan area mesin dari kerak oli dan kotoran membandel sampai ke sela-sela.",
    "description": "Buat apa sih? Membersihkan area mesin sampai ke sela-sela yang susah dijangkau pas cuci biasa. Biar ruang mesin kelihatan rapi dan kalau ada rembesan oli bisa cepat ketahuan.\n\nGimana prosesnya? Kita fokus bersihin area mesin dan crankcase dari kerak oli dan kotoran. Ban belakang dilepas biar bersihnya maksimal. Servis ini udah termasuk paket Cuci Premium juga, lho.\n\nLayanan Termasuk:\n- Pelepasan roda belakang untuk akses maksimal.\n- Pembersihan mendalam pada mesin & crankcase dari oli dan kotoran.\n- Termasuk paket Cuci Premium + Wax.\n- Dressing bodi kasar & kaki-kaki."
  },
  {
    "name": "Cuci Komplit",
    "category": "detailing",
    "summary": "Motor 'dipreteli' untuk dibersihkan total hingga ke bagian rangka terdalam.",
    "description": "Buat apa sih? Biar motor bersih total sampai ke bagian dalam yang biasanya nggak kelihatan. Dijamin berasa kayak motor baru keluar dari dealer!\n\nGimana prosesnya? Ini cuci 'telanjang'. Beberapa bagian bodi kita lepas biar bisa bersihin rangka dan semua sudut terdalam. Udah pasti termasuk paket Cuci Premium.\n\nLayanan Termasuk:\n- Pelepasan roda & bodi motor.\n- Detailing mesin dan pembersihan rangka secara menyeluruh.\n- Termasuk paket Cuci Premium + Wax.\n- Dressing bodi kasar & kaki-kaki"
  },
  {
    "name": "Poles Bodi Glossy",
    "category": "detailing",
    "summary": "Menghilangkan baret-baret halus dan mengembalikan kilau asli cat motormu.",
    "description": "Buat apa sih? Buat ngilangin baret-baret halus (jaring laba-laba) dan kusam di bodi motor kamu. Kilau aslinya bakal balik lagi.\n\nGimana prosesnya? Cat motor kamu kita 'treatment' buat mulusin lagi permukaannya. Setelah dipoles, kita kasih lapisan pelindung wax biar kilaunya awet.\n\nLayanan Termasuk:\n- Cuci + proses amplas halus & poles bodi untuk menghilangkan baret.\n- Aplikasi sealant wax sebagai lapisan proteksi dan kilau.\n- Dressing bodi kasar & kaki-kaki."
  },
  {
    "name": "Full Detailing Glossy",
    "category": "detailing",
    "summary": "Paket restorasi total, gabungan cuci komplit dan poles untuk hasil kinclong maksimal.",
    "description": "Buat apa sih? Ini paket 'pamungkas' buat restorasi motor. Tujuannya bikin motor kamu balik ke kondisi terbaiknya, bersih sampai ke tulang-tulangnya dan kinclong maksimal.\n\nGimana prosesnya? Bayangin aja layanan \"Cuci Komplit\" digabung sama \"Poles Bodi Glossy\". Motor kamu kita 'pretelin', bersihin total, terus bodinya kita poles sampai mulus dan dilindungi wax. Luar-dalam kinclong!\n\nLayanan Termasuk:\n- Pelepasan roda & bodi.\n- Detailing mesin, rangka, serta poles bodi untuk koreksi cat.\n- Proteksi menggunakan sealant wax.\n- Dressing bodi kasar & kaki-kaki."
  },
  {
    "name": "Coating Motor Doff",
    "category": "coating",
    "summary": "Memberi lapisan pelindung keramik agar warna doff makin pekat dan awet.",
    "description": "Buat apa sih? Buat ngasih 'baju pelindung' super kuat buat cat doff kamu biar awet berbulan-bulan, bahkan tahunan. Melindungi dari sinar matahari, polusi, dan kotoran bandel, tanpa bikin cat jadi mengkilap.\n\nGimana prosesnya? Setelah dicuci dan dibersihkan dari jamur, cat doff motor kamu kita lapisi pakai cairan keramik khusus. Hasilnya, cat doff kamu bakal terlindungi lapisan keras.\n\nLayanan Termasuk:\n- Cuci + proses dekontaminasi cat untuk membersihkan permukaan.\n- Aplikasi Matte Ceramic Coating.\n- Dressing bodi kasar & kaki-kaki."
  },
  {
    "name": "Coating Motor Glossy",
    "category": "coating",
    "summary": "Proteksi cat tingkat tinggi dengan efek daun talas dan kilap kaca (wet look).",
    "description": "Buat apa sih? Ini level proteksi dan kilap paling tinggi buat cat glossy. Bikin motor jadi punya efek 'daun talas', jadi air dan kotoran ogah nempel. Nyucinya jadi gampang banget!\n\nGimana Prosesnya? Prosesnya lumayan panjang: cuci, bersih-bersih mendalam (dekontaminasi), poles, baru deh dilapisin ceramic coating. Hasilnya, kilap super dan terlindungi lama.\n\nLayanan Termasuk:\n- Cuci + dekontaminasi + poles bodi.\n- Aplikasi Glossy Ceramic Coating.\n- Dressing bodi kasar & kaki-kaki"
  },
  {
    "name": "Complete Service Doff",
    "category": "coating",
    "summary": "Paket restorasi & proteksi 'sultan' untuk motor doff, bersih sampai ke dalam.",
    "description": "Buat apa sih? Paket 'sultan' buat motor doff. Tujuannya buat ngerestorasi total motor kamu, dari bagian terdalam sampai lapisan pelindung paling luar. Biar kelihatan kayak baru lagi dan terlindungi maksimal.\n\nGimana prosesnya? Ini gabungan dari \"Cuci Komplit\" sama \"Coating Motor Doff\". Motor kamu kita bongkar, bersihin semua bagian sampai rangka, terus kita kasih lapisan pelindung ceramic coating khusus doff. Pokoknya paket lengkap!\n\nLayanan Termasuk:\n- Lepas ban belakang dan bodi motor.\n- Detailing mesin & crankcase.\n- Detailing rangka motor.\n- Cuci premium dengan sabun khusus doff.\n- Dekontaminasi bodi dari jamur & kerak.\n- Aplikasi Matte ceramic coating untuk proteksi cat doff.\n- Dressing bodi kasar agar hitam kembali.\n- Dressing kaki-kaki & ban untuk proteksi kerak dan tampilan bersih."
  },
  {
    "name": "Complete Service Glossy",
    "category": "coating",
    "summary": "Paket perawatan paling dewa untuk motor glossy, dari detailing sampai coating.",
    "description": "Buat apa sih? Ini paket perawatan paling dewa buat motor glossy. Tujuannya buat balikin kilau motor kamu jadi lebih dari sekadar baru keluar pabrik, plus dilindungi biar awet banget.\n\nGimana prosesnya? Bayangin aja tiga layanan jadi satu: \"Cuci Komplit\" + \"Poles Bodi\" + \"Coating Glossy\". Motor kamu kita urus total dari A sampai Z. Dibersihin, dibikin mulus, dikilapin, terus dilindungi pake coating dan wax. Ultimate!\n\nLayanan Termasuk:\n- Lepas ban belakang dan bodi motor.\n- Detailing mesin & crankcase.\n- Detailing rangka motor.\n- Cuci premium dengan sabun khusus.\n- Dekontaminasi bodi dari jamur & kerak.\n- Amplas & poles bodi (opsional, tergantung kondisi).\n- Aplikasi Glossy ceramic coating untuk proteksi dan kilap maksimal.\n- Aplikasi Sealant wax agar kilap awet dan tahan gores.\n- Dressing bodi kasar agar hitam dan terlindungi.\n- Dressing kaki-kaki & ban untuk tampilan dan perlindungan menyeluruh."
  }
];

export default deskripsiLayanan;
