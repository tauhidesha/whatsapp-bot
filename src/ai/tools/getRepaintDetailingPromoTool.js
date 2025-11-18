const { z } = require('zod');
const { getPreferredSizeForService, getMotorSizesForSender } = require('../utils/motorSizeMemory.js');

const inputSchema = z.object({
  size: z
    .enum(['S', 'M', 'L', 'XL'])
    .optional()
    .describe('Ukuran motor yang ingin difokuskan (S/M/L/XL). Opsi, jika kosong bot kirim semua paket.'),
  senderNumber: z.string().optional(),
});

const PROMO_INFO = {
  headline: 'Promo Bundling Repaint + Full Detailing (Update 2025)',
  description:
    'Paket hemat kombinasi Repaint Bodi Halus + Full Detailing untuk motor kinclong luar-dalam. Berlaku untuk motor non-vespa dan non-moge. Booking cukup DP Rp100.000.',
  terms: [
    'Garansi hasil 1 bulan, klaim mudah.',
    'Bebas pilih warna termasuk custom (candy/bunglon/moonlight, bunglon ada biaya tambahan).',
    'Harga sudah termasuk pengerokan, dempul, pengecatan bodi halus, dan full detailing (tanpa coating).',
    'Full detailing mencakup bodi, mesin, kaki-kaki, hingga rangka.',
    'Bisa cicilan via Tokopedia.',
    'Slot terbatas tiap minggu, siapa cepat dia dapat.',
  ],
  packages: {
    S: {
      promoPrice: 1500000,
      normalPrice: null,
      services: 'Repaint Bodi Halus (S) + Full Detailing (S)',
    },
    M: {
      promoPrice: 1650000,
      normalPrice: null,
      services: 'Repaint Bodi Halus (M) + Full Detailing (M)',
    },
    L: {
      promoPrice: 1850000,
      normalPrice: null,
      services: 'Repaint Bodi Halus (L) + Full Detailing (M)',
    },
    XL: {
      promoPrice: 2200000,
      normalPrice: null,
      services: 'Repaint Bodi Halus (XL) + Full Detailing (L)',
    },
  },
};

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
}

function buildPackageText(size) {
  const data = PROMO_INFO.packages[size];
  if (!data) return '';

  const lines = [`**${size}**`];
  lines.push(`- Promo Price: **${formatCurrency(data.promoPrice)}**`);
  lines.push(`- Isi Layanan: ${data.services}`);
  return lines.join('\n');
}

function buildResponse(size) {
  const intro = [
    '✨ *Promo Bundling Repaint + Detailing 2025*',
    PROMO_INFO.description,
    '',
  ];

  const packagesText = size ? [buildPackageText(size)] : Object.keys(PROMO_INFO.packages).map(buildPackageText);

  const termsText = ['📋 *Term & Benefit:*', ...PROMO_INFO.terms.map((item, idx) => `${idx + 1}. ${item}`)];

  return [...intro, ...packagesText, '', ...termsText].join('\n');
}

async function implementation(input = {}) {
  const { size: providedSize, senderNumber } = inputSchema.parse(input);
  let sizeKey = providedSize || null;

  if (!sizeKey && senderNumber) {
    const preferred = getPreferredSizeForService(senderNumber, 'repaint');
    sizeKey = preferred || getMotorSizesForSender(senderNumber)?.repaintSize || null;
  }

  return {
    success: true,
    size: sizeKey,
    headline: PROMO_INFO.headline,
    description: PROMO_INFO.description,
    packages: PROMO_INFO.packages,
    terms: PROMO_INFO.terms,
    response: buildResponse(sizeKey || undefined),
  };
}

const getRepaintDetailingPromoTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getRepaintDetailingPromo',
      description: 'Ambil detail promo bundling Repaint Bodi Halus + Full Detailing terbaru (harga per ukuran, benefit, syarat).',
      parameters: {
        type: 'object',
        properties: {
          size: {
            type: 'string',
            enum: ['S', 'M', 'L', 'XL'],
            description: 'Ukuran motor yang ingin difokuskan (opsional).',
          },
        },
      },
    },
  },
  implementation,
};

module.exports = { getRepaintDetailingPromoTool };
