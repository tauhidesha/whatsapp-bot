// Data gabungan deskripsi dan harga layanan

const masterLayanan = [
  {
    name: "Repaint Bodi Halus",
    category: "repaint",
    subcategory: "bodi_halus",
    summary: "Cat ulang bodi motor pakai bahan premium (PU & HS) untuk hasil mulus seperti pabrikan.",
    description: "- Bahan cat menggunakan full PU\n- Untuk clear coat menggunakan clearcoat jenis HS\n- Harga untuk warna solid/metalik. Candy, bunglon, moonlight dikenakan tambahan 125–210rb.\n- Repaint hasil kulit jeruk tipis ala pabrik (bisa lebih halus dengan poles)\n- Estimasi: 3–4 hari kerja",
    price: 0,
    usesModelPricing: true,
  },
  {
    name: "Repaint Bodi Kasar",
    category: "repaint",
    subcategory: "bodi_kasar",
    summary: "Hitamkan kembali dek dan bodi kasar motormu yang sudah kusam atau tergores.",
    description: "Pengecatan ulang bagian bodi kasar atau dek motor. Menggunakan cat khusus PP Primer & Texture Paint.",
    price: 0,
    usesModelPricing: true,
  },
  {
    name: "Repaint Velg",
    category: "repaint",
    subcategory: "velg",
    summary: "Bikin tampilan kaki-kaki motormu jadi baru lagi dengan cat ulang velg.",
    description: "Pengecatan ulang sepasang velg (pelek) motor. Harga sudah termasuk jasa bongkar pasang ban.",
    price: 0,
    usesModelPricing: true,
  },
  {
    name: "Repaint Cover CVT / Arm",
    category: "repaint",
    summary: "Segarkan tampilan area mesin dan arm motormu dengan pengecatan ulang.",
    description: "Pengecatan ulang bagian cover CVT atau swing arm. Harga sama untuk kebanyakan motor.",
    price: 150000,
  },
  {
    name: "Detailing Mesin",
    category: "detailing",
    summary: "Membersihkan area mesin dari kerak oli dan kotoran membandel sampai ke sela-sela.",
    description: "Membersihkan area mesin sampai ke sela-sela yang susah dijangkau pas cuci biasa. Termasuk pelepasan roda belakang dan Cuci Premium + Wax.",
    price: 0,
    variants: [
      { name: "S", price: 100000 },
      { name: "M", price: 125000 },
      { name: "L", price: 150000 }
    ]
  },
  {
    name: "Cuci Komplit",
    category: "detailing",
    summary: "Motor 'dipreteli' untuk dibersihkan total hingga ke bagian rangka terdalam.",
    description: "Cuci 'telanjang'. Bodi dilepas agar bisa membersihkan rangka dan semua sudut terdalam. Termasuk paket Cuci Premium + Wax.",
    price: 0,
    variants: [
      { name: "S", price: 225000 },
      { name: "M", price: 275000 },
      { name: "L", price: 300000 },
      { name: "XL", price: 500000 }
    ]
  },
  {
    name: "Poles Bodi Glossy",
    category: "detailing",
    summary: "Menghilangkan baret-baret halus dan mengembalikan kilau asli cat motormu.",
    description: "Menghilangkan baret-baret halus (jaring laba-laba) dan kusam di bodi motor. Dilengkapi lapisan pelindung sealant wax.",
    price: 0,
    variants: [
      { name: "S", price: 250000 },
      { name: "M", price: 325000 },
      { name: "L", price: 400000 },
      { name: "XL", price: 600000 }
    ]
  },
  {
    name: "Full Detailing Glossy",
    category: "detailing",
    summary: "Paket restorasi total, gabungan cuci komplit dan poles untuk hasil kinclong maksimal.",
    description: "Gabungan \"Cuci Komplit\" dan \"Poles Bodi Glossy\". Motor dipreteli, dibersihkan total, dipoles sampai mulus dan dilindungi wax.",
    price: 0,
    variants: [
      { name: "S", price: 450000 },
      { name: "M", price: 550000 },
      { name: "L", price: 650000 },
      { name: "XL", price: 1000000 }
    ]
  },
  {
    name: "Coating Motor Doff",
    category: "coating",
    summary: "Memberi lapisan pelindung keramik agar warna doff makin pekat dan awet.",
    description: "Ngasih 'baju pelindung' super kuat buat cat doff biar awet berbulan-bulan tanpa bikin cat jadi mengkilap. Melindungi dari UV & polusi.",
    price: 0,
    variants: [
      { name: "S", price: 350000 },
      { name: "M", price: 450000 },
      { name: "L", price: 550000 },
      { name: "XL", price: 750000 }
    ]
  },
  {
    name: "Coating Motor Glossy",
    category: "coating",
    summary: "Proteksi cat tingkat tinggi dengan efek daun talas dan kilap kaca (wet look).",
    description: "Level proteksi dan kilap paling tinggi buat cat glossy dengan efek 'daun talas'. Melalui proses dekontaminasi dan poles sebelum coating.",
    price: 0,
    variants: [
      { name: "S", price: 550000 },
      { name: "M", price: 750000 },
      { name: "L", price: 850000 },
      { name: "XL", price: 1000000 }
    ]
  },
  {
    name: "Complete Service Doff",
    category: "coating",
    summary: "Paket restorasi & proteksi 'sultan' untuk motor doff, bersih sampai ke dalam.",
    description: "Gabungan dari \"Cuci Komplit\" sama \"Coating Motor Doff\". Dibongkar total, dibersihkan sampai rangka, lalu dilapis ceramic coating khusus doff.",
    price: 0,
    variants: [
      { name: "S", price: 650000 },
      { name: "M", price: 750000 },
      { name: "L", price: 850000 },
      { name: "XL", price: 1250000 }
    ]
  },
  {
    name: "Complete Service Glossy",
    category: "coating",
    summary: "Paket perawatan paling dewa untuk motor glossy, dari detailing sampai coating.",
    description: "Gabungan: \"Cuci Komplit\" + \"Poles Bodi\" + \"Coating Glossy\". Dibersihkan total, dibikin mulus, dikilapin, dan dilindungi coating super awet.",
    price: 0,
    variants: [
      { name: "S", price: 750000 },
      { name: "M", price: 875000 },
      { name: "L", price: 950000 },
      { name: "XL", price: 1500000 }
    ]
  }
];

export default masterLayanan;
