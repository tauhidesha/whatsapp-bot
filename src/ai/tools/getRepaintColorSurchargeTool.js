const { z } = require('zod');
const { getPreferredSizeForService, getMotorSizesForSender } = require('../utils/motorSizeMemory.js');

const COLORS = {
  candy: { S: 150000, M: 250000, L: 300000, XL: 400000 },
  bunglon: { S: 200000, M: 300000, L: 350000, XL: 450000 },
  moonlight: { S: 200000, M: 300000, L: 350000, XL: 450000 },
  xyrallic: { S: 200000, M: 300000, L: 350000, XL: 450000 },
  lembayung: { S: 200000, M: 300000, L: 350000, XL: 450000 },
};

const VELG_SURCHARGE = {
  default: 150000,
  bunglon: 200000,
};

const inputSchema = z.object({
  color: z.enum(Object.keys(COLORS)).optional(),
  size: z.enum(['S', 'M', 'L', 'XL']).optional(),
  includeVelg: z.boolean().optional(),
  senderNumber: z.string().optional(),
});

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function buildColorRow(colorName, size) {
  const data = COLORS[colorName];
  if (!data) return null;

  if (size) {
    const price = data[size];
    return price ? `${colorName} (${size}): ${formatCurrency(price)}` : null;
  }

  const entries = Object.keys(data)
    .map((key) => `${key}: ${formatCurrency(data[key])}`)
    .join(', ');
  return `${colorName}: ${entries}`;
}

const VELG_ELIGIBLE = ['candy', 'moonlight', 'xyrallic', 'lembayung'];

function getVelgInfo(color) {
  if (!color) {
    return `Velg add-on khusus warna Candy/Moonlight/Xyrallic/Lembayung: ${formatCurrency(
      VELG_SURCHARGE.default
    )}. Bunglon: ${formatCurrency(VELG_SURCHARGE.bunglon)}.`;
  }
  if (color === 'bunglon') {
    return `Velg add-on Bunglon: ${formatCurrency(VELG_SURCHARGE.bunglon)}`;
  }
  if (VELG_ELIGIBLE.includes(color)) {
    return `Velg add-on ${color}: ${formatCurrency(VELG_SURCHARGE.default)}`;
  }
  return null;
}

async function implementation(rawInput = {}) {
  const { color, size, includeVelg, senderNumber } = inputSchema.parse(rawInput);
  let colorKey = color || null;
  let sizeKey = size || null;

  if (!sizeKey && senderNumber) {
    const preferred = getPreferredSizeForService(senderNumber, 'repaint');
    sizeKey = preferred || getMotorSizesForSender(senderNumber)?.repaintSize || null;
  }

  let rows;
  if (colorKey) {
    const row = buildColorRow(colorKey, sizeKey || undefined);
    rows = row ? [row] : [];
  } else {
    rows = Object.keys(COLORS)
      .map((name) => buildColorRow(name, sizeKey || undefined))
      .filter(Boolean);
  }

  if (!rows.length) {
    return {
      success: false,
      error: 'surcharge_not_found',
      message: 'Data surcharge tidak ditemukan untuk warna atau ukuran tersebut.',
    };
  }

  const velgLine = includeVelg ? getVelgInfo(colorKey) : null;

  const responseParts = [
    '🎨 *Surcharge Warna Repaint Bodi Halus*',
    ...rows,
  ];
  if (velgLine) {
    responseParts.push('', velgLine);
  }

  const effectiveColorData = colorKey ? COLORS[colorKey] : null;

  return {
    success: true,
    color: colorKey,
    size: sizeKey,
    surcharge: effectiveColorData,
    includeVelg: !!includeVelg,
    response: responseParts.join('\n'),
  };
}

const getRepaintColorSurchargeTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getRepaintColorSurcharge',
      description: 'Ambil biaya tambahan warna khusus (candy/bunglon/moonlight/xyrallic/lembayung) dan opsi velg untuk Repaint Bodi Halus.',
      parameters: {
        type: 'object',
        properties: {
          color: {
            type: 'string',
            enum: Object.keys(COLORS),
            description: 'Nama warna khusus (opsional). Kosongkan untuk menampilkan semua warna.',
          },
          size: {
            type: 'string',
            enum: ['S', 'M', 'L', 'XL'],
            description: 'Ukuran motor. Opsional. Jika kosong akan menampilkan semua ukuran per warna.',
          },
          includeVelg: {
            type: 'boolean',
            description: 'True jika ingin menampilkan biaya tambahan velg.',
          },
        },
      },
    },
  },
  implementation,
};

module.exports = { getRepaintColorSurchargeTool };
