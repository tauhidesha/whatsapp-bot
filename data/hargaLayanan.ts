// File: src/data/hargaLayanan.ts
// Data ini di-convert dari docs/harga_layanan.json agar bisa di-import langsung di Next.js/Vercel

const hargaLayanan = [
  {
    "name": "Repaint Bodi Halus",
    "category": "repaint",
    "price": 0,
    "estimatedDuration": "2400",
    "variants": [
      { "name": "S", "price": 1000000 },
      { "name": "M", "price": 1250000 },
      { "name": "L", "price": 1400000 },
      { "name": "XL", "price": 1900000 }
    ]
  },
  {
    "name": "Repaint Bodi Kasar",
    "category": "repaint",
	"estimatedDuration": "960",
    "price": 0,
    "variants": [
      { "name": "S", "price": 300000 },
      { "name": "M", "price": 350000 },
      { "name": "L", "price": 450000 },
      { "name": "XL", "price": 600000 }
    ]
  },
  {
    "name": "Repaint Velg",
    "category": "repaint",
    "estimatedDuration": "960",
	"price": 0,
    "variants": [
      { "name": "S", "price": 350000 },
      { "name": "M", "price": 400000 },
      { "name": "L", "price": 400000 },
	  { "name": "XL", "price": 500000 }
    ]
  },
  {
    "name": "Repaint Cover CVT / Arm",
	"estimatedDuration": "480",
    "category": "repaint",
    "price": 150000
  },
  {
    "name": "Detailing Mesin",
    "category": "detailing",
    "price": 0,
    "estimatedDuration": "90",
    "variants": [
      { "name": "S", "price": 100000 },
      { "name": "M", "price": 125000 },
      { "name": "L", "price": 150000 }
    ]
  },
  {
    "name": "Cuci Komplit",
    "category": "detailing",
    "price": 0,
    "estimatedDuration": "240",
    "variants": [
      { "name": "S", "price": 225000 },
      { "name": "M", "price": 275000 },
      { "name": "L", "price": 300000 },
      { "name": "XL", "price": 500000 }
    ]
  },
  {
    "name": "Poles Bodi Glossy",
    "category": "detailing",
    "price": 0,
    "estimatedDuration": "300",
    "variants": [
      { "name": "S", "price": 250000 },
      { "name": "M", "price": 325000 },
      { "name": "L", "price": 400000 },
      { "name": "XL", "price": 600000 }
    ]
  },
  {
    "name": "Full Detailing Glossy",
    "category": "detailing",
    "price": 0,
    "estimatedDuration": "420",
    "variants": [
      { "name": "S", "price": 450000 },
      { "name": "M", "price": 550000 },
      { "name": "L", "price": 650000 },
      { "name": "XL", "price": 1000000 }
    ]
  },
  {
    "name": "Coating Motor Doff",
    "category": "coating",
    "price": 0,
    "estimatedDuration": "240",
    "variants": [
      { "name": "S", "price": 350000 },
      { "name": "M", "price": 450000 },
      { "name": "L", "price": 550000 },
      { "name": "XL", "price": 750000 }
    ]
  },
  {
    "name": "Coating Motor Glossy",
    "category": "coating",
    "price": 0,
    "estimatedDuration": "420",
    "variants": [
      { "name": "S", "price": 550000 },
      { "name": "M", "price": 750000 },
      { "name": "L", "price": 850000 },
      { "name": "XL", "price": 1000000 }
    ]
  },
  {
    "name": "Complete Service Doff",
    "category": "coating",
    "price": 0,
    "estimatedDuration": "600",
    "variants": [
      { "name": "S", "price": 650000 },
      { "name": "M", "price": 750000 },
      { "name": "L", "price": 850000 },
      { "name": "XL", "price": 1250000 }
    ]
  },
  {
    "name": "Complete Service Glossy",
    "category": "coating",
    "price": 0,
    "estimatedDuration": "600",
    "variants": [
      { "name": "S", "price": 750000 },
      { "name": "M", "price": 875000 },
      { "name": "L", "price": 950000 },
      { "name": "XL", "price": 1500000 }
    ]
  }
];

export default hargaLayanan;
