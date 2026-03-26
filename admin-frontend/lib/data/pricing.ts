// Consolidated pricing data for POS booking form
// Source: src/data/masterLayanan.js, daftarUkuranMotor.js, repaintPrices.js

export type MotorSize = 'S' | 'M' | 'L' | 'XL';

export interface MotorModel {
  model: string;
  service_size: MotorSize;
  repaint_size: MotorSize;
}

export interface ServiceItem {
  name: string;
  category: 'repaint' | 'detailing' | 'coating';
  pricingType: 'variant' | 'model' | 'fixed' | 'manual';
  fixedPrice?: number;
  variants?: Record<MotorSize, number>;
}

// ─── MOTOR DATABASE ───
export const MOTOR_DATABASE: MotorModel[] = [
  // Honda - Small
  { model: "Beat", service_size: "S", repaint_size: "S" },
  { model: "Scoopy", service_size: "S", repaint_size: "M" },
  { model: "Spacy", service_size: "S", repaint_size: "S" },
  { model: "Supra", service_size: "S", repaint_size: "S" },
  { model: "Revo", service_size: "S", repaint_size: "S" },
  { model: "Blade", service_size: "S", repaint_size: "S" },
  { model: "Genio", service_size: "S", repaint_size: "M" },
  // Honda - Medium
  { model: "Vario 110", service_size: "S", repaint_size: "M" },
  { model: "Vario 125/150/160", service_size: "M", repaint_size: "M" },
  { model: "PCX 150/160", service_size: "M", repaint_size: "L" },
  { model: "ADV 150/160", service_size: "M", repaint_size: "L" },
  { model: "Supra GTR 150", service_size: "M", repaint_size: "XL" },
  { model: "Sonic 150R", service_size: "M", repaint_size: "XL" },
  // Honda - Large
  { model: "CBR 150R", service_size: "L", repaint_size: "XL" },
  { model: "CBR 250RR", service_size: "L", repaint_size: "XL" },
  { model: "CB 150R", service_size: "L", repaint_size: "XL" },
  { model: "Verza", service_size: "L", repaint_size: "XL" },
  { model: "CRF 150", service_size: "L", repaint_size: "XL" },
  { model: "CRF 250 Rally", service_size: "L", repaint_size: "XL" },
  { model: "Megapro", service_size: "L", repaint_size: "XL" },
  { model: "Tiger", service_size: "L", repaint_size: "XL" },
  { model: "GL Pro", service_size: "L", repaint_size: "XL" },
  { model: "CB 100", service_size: "L", repaint_size: "XL" },
  { model: "Win 100", service_size: "L", repaint_size: "XL" },
  // Honda - Classic
  { model: "C70 / Pitung", service_size: "S", repaint_size: "L" },
  { model: "Astrea Grand", service_size: "S", repaint_size: "L" },

  // Yamaha - Small
  { model: "Mio / Mio M3", service_size: "S", repaint_size: "S" },
  { model: "Fino", service_size: "S", repaint_size: "M" },
  { model: "Soul GT", service_size: "S", repaint_size: "S" },
  { model: "Vega / Vega ZR", service_size: "S", repaint_size: "S" },
  { model: "X-Ride", service_size: "S", repaint_size: "S" },
  { model: "Jupiter Z", service_size: "S", repaint_size: "S" },
  { model: "Gear 125", service_size: "S", repaint_size: "S" },
  { model: "Xeon", service_size: "S", repaint_size: "S" },
  { model: "Nouvo", service_size: "S", repaint_size: "S" },
  // Yamaha - Medium
  { model: "NMax", service_size: "M", repaint_size: "M" },
  { model: "Aerox", service_size: "M", repaint_size: "M" },
  { model: "Lexi", service_size: "M", repaint_size: "M" },
  { model: "Fazzio", service_size: "M", repaint_size: "M" },
  { model: "Grand Filano", service_size: "M", repaint_size: "L" },
  { model: "Freego", service_size: "M", repaint_size: "S" },
  { model: "MX King", service_size: "M", repaint_size: "XL" },
  { model: "Jupiter MX", service_size: "S", repaint_size: "XL" },
  // Yamaha - Large
  { model: "XMax", service_size: "L", repaint_size: "XL" },
  { model: "R15", service_size: "L", repaint_size: "XL" },
  { model: "R25", service_size: "L", repaint_size: "XL" },
  { model: "Vixion", service_size: "L", repaint_size: "XL" },
  { model: "Byson", service_size: "L", repaint_size: "XL" },
  { model: "MT-15", service_size: "L", repaint_size: "XL" },
  { model: "MT-25", service_size: "L", repaint_size: "XL" },
  { model: "WR 155", service_size: "L", repaint_size: "XL" },
  { model: "XSR 155", service_size: "L", repaint_size: "XL" },
  { model: "Xabre", service_size: "L", repaint_size: "XL" },
  // Yamaha - Classic
  { model: "RX-King", service_size: "L", repaint_size: "XL" },
  { model: "F1ZR", service_size: "S", repaint_size: "M" },

  // Suzuki
  { model: "Nex / Nex II", service_size: "S", repaint_size: "S" },
  { model: "Address", service_size: "S", repaint_size: "S" },
  { model: "Smash", service_size: "S", repaint_size: "S" },
  { model: "Spin", service_size: "S", repaint_size: "S" },
  { model: "Shogun", service_size: "S", repaint_size: "S" },
  { model: "Skydrive", service_size: "S", repaint_size: "S" },
  { model: "Skywave", service_size: "S", repaint_size: "S" },
  { model: "Hayate", service_size: "S", repaint_size: "S" },
  { model: "Satria FU / F150", service_size: "M", repaint_size: "XL" },
  { model: "GSX-R150", service_size: "L", repaint_size: "XL" },
  { model: "GSX-S150", service_size: "L", repaint_size: "XL" },
  { model: "Thunder 125", service_size: "L", repaint_size: "XL" },

  // Kawasaki
  { model: "Ninja 250", service_size: "L", repaint_size: "XL" },
  { model: "Ninja ZX-25R", service_size: "L", repaint_size: "XL" },
  { model: "Ninja 650", service_size: "XL", repaint_size: "XL" },
  { model: "Z650", service_size: "XL", repaint_size: "XL" },
  { model: "Z900", service_size: "XL", repaint_size: "XL" },
  { model: "KLX 150", service_size: "L", repaint_size: "XL" },
  { model: "KLX 250", service_size: "L", repaint_size: "XL" },
  { model: "W175", service_size: "M", repaint_size: "XL" },
  { model: "D-Tracker", service_size: "L", repaint_size: "XL" },
  { model: "Versys 250", service_size: "L", repaint_size: "XL" },

  // Vespa
  { model: "Vespa LX 125", service_size: "M", repaint_size: "XL" },
  { model: "Vespa Primavera", service_size: "M", repaint_size: "XL" },
  { model: "Vespa Sprint", service_size: "M", repaint_size: "XL" },
  { model: "Vespa GTS", service_size: "L", repaint_size: "XL" },
  { model: "Vespa PX", service_size: "L", repaint_size: "XL" },
  { model: "Vespa S150", service_size: "M", repaint_size: "XL" },

  // EV
  { model: "Polytron Evo", service_size: "S", repaint_size: "S" },
  { model: "Polytron T-Rex", service_size: "M", repaint_size: "L" },
  { model: "Selis E-Max", service_size: "S", repaint_size: "S" },
  { model: "Smoot Tempur", service_size: "S", repaint_size: "S" },
  { model: "Gesits", service_size: "M", repaint_size: "M" },
  { model: "Alva One", service_size: "M", repaint_size: "L" },
  { model: "Alva Cervo", service_size: "L", repaint_size: "L" },
  { model: "United T1800", service_size: "M", repaint_size: "M" },

  // Benelli
  { model: "Motobi 200", service_size: "L", repaint_size: "XL" },
  { model: "Leoncino 250", service_size: "L", repaint_size: "XL" },
  { model: "Leoncino 500", service_size: "XL", repaint_size: "XL" },
  { model: "TRK 502", service_size: "XL", repaint_size: "XL" },

  // Moge
  { model: "Harley Street 500", service_size: "XL", repaint_size: "XL" },
  { model: "BMW G310R", service_size: "XL", repaint_size: "XL" },
];

// ─── REPAINT BODI HALUS PRICES (by model name keyword) ───
export const REPAINT_BODI_HALUS: Record<string, number> = {
  "beat": 800000, "scoopy": 1500000, "genio": 1500000, "spacy": 800000,
  "mio": 800000, "fino": 1500000, "fazzio": 1500000, "filano": 1500000, "grand filano": 1500000,
  "xeon": 800000, "nouvo": 1200000, "gear": 800000, "soul gt": 800000,
  "vario 110": 900000, "vario 125": 1200000, "vario 150": 1200000, "vario 160": 1200000, "nex": 800000, "address": 800000, "smash": 800000,
  "spin": 800000, "vega": 800000, "x-ride": 800000, "freego": 800000,
  "skydrive": 800000, "hayate": 800000, "skywave": 800000, "shogun": 800000,
  "supra": 800000, "revo": 800000, "blade": 800000, "jupiter z": 800000, "jupiter mx": 800000,
  "nmax": 1200000, "pcx": 1500000, "adv": 1500000, "aerox": 1000000,
  "satria": 1000000, "mx king": 800000, "lexi": 800000, "sonic": 800000, "supra gtr": 800000,
  "vixion": 1500000, "r15": 1500000, "r25": 1500000, "cbr": 1500000,
  "cb 150r": 1300000, "verza": 1300000, "megapro": 1500000, "byson": 1200000,
  "mt-15": 1600000, "mt-25": 1600000, "xabre": 1600000, "xsr": 1800000,
  "gsx": 1800000, "ninja": 1800000, "tiger": 1800000, "thunder": 1800000,
  "vespa": 2500000, "rx-king": 2500000, "f1zr": 2125000,
  "c70": 1700000, "pitung": 1700000, "cb 100": 1700000, "astrea": 1000000, "win": 1500000,
  "w175": 1100000, "polytron evo": 850000, "polytron t-rex": 1275000,
  "selis": 850000, "smoot": 850000, "gesits": 1020000, "alva": 1275000, "united": 1360000,
  "ninja 650": 2500000, "z650": 2500000, "z900": 3000000, "z1000": 3500000,
  "harley": 3500000, "bmw": 3000000,
};

// ─── REPAINT BODI KASAR (by repaint_size) ───
export const REPAINT_BODI_KASAR: Record<MotorSize, number> = {
  S: 300000, M: 380000, L: 510000, XL: 765000,
};

// ─── REPAINT VELG (by model keyword) ───
export const REPAINT_VELG: Record<string, number> = {
  "scoopy": 350000, "genio": 350000, "vario": 350000, "mio": 350000, "beat": 350000,
  "vega": 350000, "fino": 350000, "nouvo": 350000, "smash": 350000, "fazzio": 350000,
  "x-ride": 350000, "nex": 350000, "spacy": 350000, "gear": 350000, "freego": 350000,
  "xeon": 350000, "skydrive": 350000, "spin": 350000, "hayate": 350000,
  "nmax": 400000, "mx king": 400000, "satria": 400000, "pcx": 400000, "adv": 400000,
  "aerox": 400000, "lexi": 400000, "jupiter": 400000, "vespa": 400000,
  "revo": 400000, "sonic": 400000, "blade": 400000,
  "cbr": 450000, "gsx": 450000, "vixion": 450000, "byson": 450000, "tiger": 450000,
  "rx king": 450000, "thunder": 450000, "xsr": 450000, "r15": 450000, "r25": 450000,
  "ninja": 450000, "cb 150": 450000, "megapro": 450000, "mt": 450000, "xabre": 450000,
};

// ─── SERVICE DEFINITIONS ───
export const SERVICES: ServiceItem[] = [
  // Repaint
  { name: "Repaint Bodi Halus", category: "repaint", pricingType: "model" },
  { name: "Repaint Bodi Kasar", category: "repaint", pricingType: "model" },
  { name: "Repaint Velg", category: "repaint", pricingType: "model" },
  { name: "Repaint Cover CVT / Arm", category: "repaint", pricingType: "fixed", fixedPrice: 150000 },
  { name: "Spot Repair", category: "repaint", pricingType: "manual" },
  // Detailing
  { name: "Detailing Mesin", category: "detailing", pricingType: "variant", variants: { S: 100000, M: 125000, L: 150000, XL: 150000 } },
  { name: "Cuci Komplit", category: "detailing", pricingType: "variant", variants: { S: 225000, M: 275000, L: 300000, XL: 500000 } },
  { name: "Poles Bodi Glossy", category: "detailing", pricingType: "variant", variants: { S: 250000, M: 325000, L: 400000, XL: 600000 } },
  { name: "Full Detailing Glossy", category: "detailing", pricingType: "variant", variants: { S: 450000, M: 550000, L: 650000, XL: 1000000 } },
  // Coating
  { name: "Coating Motor Doff", category: "coating", pricingType: "variant", variants: { S: 350000, M: 450000, L: 550000, XL: 750000 } },
  { name: "Coating Motor Glossy", category: "coating", pricingType: "variant", variants: { S: 550000, M: 750000, L: 850000, XL: 1000000 } },
  { name: "Complete Service Doff", category: "coating", pricingType: "variant", variants: { S: 650000, M: 750000, L: 850000, XL: 1250000 } },
  { name: "Complete Service Glossy", category: "coating", pricingType: "variant", variants: { S: 750000, M: 875000, L: 950000, XL: 1500000 } },
];

export const CATEGORY_LABELS: Record<string, string> = {
  repaint: '🎨 Repaint',
  detailing: '✨ Detailing',
  coating: '🛡️ Coating',
};

// ─── PRICING HELPERS ───
export function getServicePrice(service: ServiceItem, motor: MotorModel | null): number {
  if (service.pricingType === 'fixed') return service.fixedPrice || 0;
  if (service.pricingType === 'manual') return 0;
  if (!motor) return 0;

  if (service.pricingType === 'variant' && service.variants) {
    return service.variants[motor.service_size] || 0;
  }

  if (service.pricingType === 'model') {
    const modelLower = motor.model.toLowerCase();
    if (service.name === 'Repaint Bodi Halus') {
      for (const [key, price] of Object.entries(REPAINT_BODI_HALUS)) {
        if (modelLower.includes(key)) return price;
      }
      return 0;
    }
    if (service.name === 'Repaint Bodi Kasar') {
      return REPAINT_BODI_KASAR[motor.repaint_size] || 300000;
    }
    if (service.name === 'Repaint Velg') {
      for (const [key, price] of Object.entries(REPAINT_VELG)) {
        if (modelLower.includes(key)) return price;
      }
      return 350000;
    }
  }
  return 0;
}

export function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}
