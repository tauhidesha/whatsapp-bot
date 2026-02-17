// File: src/ai/tools/getServiceDetailsTool.js
// Tool gabungan untuk mendapatkan deskripsi, SOP, harga, dan estimasi waktu layanan.

const masterLayanan = require('../../data/masterLayanan.js');
const {
  repaintBodiHalus,
  repaintBodiKasar,
  repaintVelg,
  warnaSpesial,
  syaratKetentuan,
  VELG_PRICE_MAP,
} = require('../../data/repaintPrices.js');
const {
  getMotorSizesForSender,
  getPreferredSizeForService,
  setPreferredSizeForService,
  setMotorSizeForSender,
} = require('../utils/motorSizeMemory.js');
const daftarUkuranMotor = require('../../data/daftarUkuranMotor.js');

// --- Helper Functions ---

function lookupColorSurcharge(colorName) {
  if (!colorName || typeof colorName !== 'string') return null;
  const query = colorName.trim().toLowerCase();

  // Fuzzy match with warnaSpesial
  for (const entry of warnaSpesial) {
    const candidates = [entry.type, ...(entry.aliases || [])].map(a => a.toLowerCase());
    for (const candidate of candidates) {
      if (candidate === query || query.includes(candidate) || candidate.includes(query)) {
        return {
          name: entry.type,
          surcharge: entry.surcharge,
        };
      }
    }
  }
  return null;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[a.length][b.length];
}

function stringSimilarity(a, b) {
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function formatDuration(minutesStr) {
  if (!minutesStr) return 'Segera';

  const durationInMinutes = parseInt(minutesStr, 10);
  if (isNaN(durationInMinutes) || durationInMinutes <= 0) {
    return 'Segera';
  }

  const WORKDAY_HOURS = 8;
  const totalHours = Math.round(durationInMinutes / 60);

  if (totalHours < WORKDAY_HOURS) {
    if (totalHours < 1) return `${durationInMinutes} menit`;
    return `${totalHours} jam`;
  }

  const days = Math.floor(totalHours / WORKDAY_HOURS);
  const remainingHours = totalHours % WORKDAY_HOURS;

  let result = `${days} hari kerja`;
  if (remainingHours > 0) {
    result += ` ${remainingHours} jam`;
  }

  return result;
}

const VALID_SIZES = new Set(['S', 'M', 'L', 'XL']);

function normalizeSizeInput(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return VALID_SIZES.has(normalized) ? normalized : null;
}

function inferCategory(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('repaint')) return 'repaint';
  if (lower.includes('coating')) return 'coating';
  if (lower.includes('detailing') || lower.includes('poles')) return 'detailing';
  return 'other';
}

function lookupMotorSizeFromData(motorModel) {
  if (!motorModel) return null;
  const query = motorModel.trim().toLowerCase();
  for (const entry of daftarUkuranMotor) {
    const candidates = [entry.model, ...(entry.aliases || [])].map(a => a.toLowerCase());
    if (candidates.some(c => c === query || query.includes(c) || c.includes(query))) {
      return entry;
    }
  }
  return null;
}

async function resolveSizeForService({ service, sizeArg, senderNumber, cachedSizes, motorModel }) {
  const category = (service.category || inferCategory(service.name)).toLowerCase();
  let finalSize = sizeArg;

  // 1. Prefer size from motorModel data if provided
  if (!finalSize && motorModel) {
    const motorData = lookupMotorSizeFromData(motorModel);
    if (motorData) {
      finalSize = category === 'repaint' ? motorData.repaint_size : motorData.service_size;
      console.log(`[resolveSizeForService] Inferred ${finalSize} from model ${motorModel}`);
    }
  }

  // 2. Fallback to cached preferred size
  const cachedPreferred = senderNumber
    ? await getPreferredSizeForService(senderNumber, category)
    : null;

  if (cachedPreferred && finalSize && cachedPreferred !== finalSize) {
    finalSize = cachedPreferred;
  }

  if (!finalSize && cachedPreferred) {
    finalSize = cachedPreferred;
  }

  if (!finalSize && cachedSizes) {
    if (category === 'repaint') {
      finalSize = cachedSizes.repaintSize || cachedSizes.serviceSize || null;
    } else {
      finalSize = cachedSizes.serviceSize || cachedSizes.repaintSize || null;
    }
  }

  return { finalSize, category };
}

// --- Repaint Model-Based Price Lookup ---
// Map motor size (S/M/L/XL) to bodi_kasar category names
const BODI_KASAR_SIZE_MAP = {
  S: 'Small Matic / Bebek',
  M: 'Medium Matic',
  L: 'Big Matic',
  XL: 'Extra Big Matic',
};

function lookupRepaintPrice(motorModel, subcategory, motorSize) {
  if (!motorModel) return null;
  const query = motorModel.trim().toLowerCase();

  // 1. Bodi Halus (default jika subcategory tidak spesifik)
  if (!subcategory || subcategory === 'bodi_halus') {
    for (const entry of repaintBodiHalus) {
      const candidates = [entry.model, ...entry.aliases].map(a => a.toLowerCase());
      for (const candidate of candidates) {
        if (candidate === query || query.includes(candidate) || candidate.includes(query)) {
          return {
            found: true,
            model: entry.model,
            price: entry.price || null,
            min: entry.min || null,
            max: entry.max || null,
            note: entry.note,
            brand: entry.brand,
            subcategory: 'bodi_halus',
          };
        }
      }
    }
  }

  // 2. Bodi Kasar – resolve specific price if motor size is known
  if (subcategory === 'bodi_kasar') {
    if (motorSize && BODI_KASAR_SIZE_MAP[motorSize]) {
      const targetCategory = BODI_KASAR_SIZE_MAP[motorSize];
      const match = repaintBodiKasar.find(r => r.category === targetCategory);
      if (match) {
        return {
          found: true,
          model: motorModel,
          min: match.min,
          max: match.max,
          subcategory: 'bodi_kasar',
          note: `Kategori: ${match.category}`,
        };
      }
    }
    // Fallback: return all ranges if size unknown
    return {
      found: true,
      model: motorModel,
      price: null,
      ranges: repaintBodiKasar,
      subcategory: 'bodi_kasar',
      note: 'Harga tergantung kategori ukuran motor.',
    };
  }

  // 3. Velg – resolve fixed price from VELG_PRICE_MAP
  if (subcategory === 'velg') {
    // Try historical model match first
    for (const [modelKey, fixedPrice] of Object.entries(VELG_PRICE_MAP)) {
      if (query === modelKey || query.includes(modelKey) || modelKey.includes(query)) {
        return {
          found: true,
          model: motorModel,
          price: fixedPrice,
          subcategory: 'velg',
          note: 'Harga per pasang, sudah termasuk bongkar pasang ban.',
        };
      }
    }

    // Fallback: return all ranges if model not found
    return {
      found: true,
      model: motorModel,
      price: null,
      ranges: repaintVelg,
      subcategory: 'velg',
      note: 'Harga per pasang, sudah termasuk bongkar pasang ban.',
    };
  }

  return null;
}

function formatRepaintPriceResult(lookup) {
  if (!lookup || !lookup.found) return null;

  if (lookup.price) {
    return {
      price: lookup.price,
      price_formatted: `Rp${lookup.price.toLocaleString('id-ID')}`,
      price_type: 'fixed',
      motor_model: lookup.model,
      note: lookup.note,
    };
  }

  if (lookup.min != null && lookup.max != null) {
    return {
      price: null,
      price_min: lookup.min,
      price_max: lookup.max,
      price_formatted: `Rp${lookup.min.toLocaleString('id-ID')} - Rp${lookup.max.toLocaleString('id-ID')}`,
      price_type: 'range',
      motor_model: lookup.model,
      note: lookup.note,
    };
  }

  if (lookup.ranges) {
    return {
      price: null,
      price_type: 'category_ranges',
      ranges: lookup.ranges,
      motor_model: lookup.model,
      note: lookup.note,
    };
  }

  return null;
}

// --- Implementation ---
async function implementation(input) {
  try {
    console.log('[getServiceDetailsTool] Input:', input);

    if (!input || typeof input !== 'object') {
      return { success: false, error: 'generic_error', message: 'Input tidak valid' };
    }

    const { service_name: parsedServiceName } = input;
    const motorModel = typeof input.motor_model === 'string' ? input.motor_model.trim() : null;
    const senderNumber = typeof input.senderNumber === 'string'
      ? input.senderNumber
      : typeof input.sender_number === 'string'
        ? input.sender_number
        : null;

    const colorNameInput = typeof input.color_name === 'string' ? input.color_name.trim() : null;

    const sizeFromArgs = normalizeSizeInput(input.size);
    const cachedSizes = senderNumber ? await getMotorSizesForSender(senderNumber) : null;

    if (!parsedServiceName || typeof parsedServiceName !== 'string') {
      return { success: false, error: 'generic_error', message: 'service_name tidak valid atau kosong' };
    }

    // Special case for "coating" generic query
    if (parsedServiceName.trim().toLowerCase() === 'coating') {
      const names = ['Coating Motor Doff', 'Coating Motor Glossy'];
      const services = masterLayanan.filter(s => names.includes(s.name));

      const results = await Promise.all(services.map(async (service) => {
        const { finalSize } = await resolveSizeForService({ service, sizeArg: sizeFromArgs, senderNumber, cachedSizes, motorModel });
        const variant = service.variants?.find(v => v.name === finalSize);
        const basePrice = variant?.price ?? service.price;

        return {
          name: service.name,
          summary: service.summary,
          price: basePrice || 'Tergantung ukuran',
          size: finalSize || 'Belum diketahui'
        };
      }));

      return {
        success: true,
        multiple_candidates: true,
        candidates: results,
        message: 'Ditemukan 2 layanan utama untuk "coating". Silakan pilih Doff atau Glossy.'
      };
    }

    // Fuzzy matching
    const candidates = masterLayanan
      .map(s => ({ ...s, similarity: stringSimilarity(parsedServiceName, s.name) }))
      .filter(s => s.similarity >= 0.4) // Threshold agak longgar untuk menangkap variasi
      .sort((a, b) => b.similarity - a.similarity);

    if (candidates.length === 0) {
      return { success: false, error: 'not_found', message: `Layanan "${parsedServiceName}" tidak ditemukan.` };
    }

    const service = candidates[0];
    const { finalSize, category } = await resolveSizeForService({
      service,
      sizeArg: sizeFromArgs,
      senderNumber,
      cachedSizes,
      motorModel,
    });

    const durationFormatted = formatDuration(service.estimatedDuration);

    // --- Surcharge resolution ---
    const surchargeMatch = colorNameInput ? lookupColorSurcharge(colorNameInput) : null;
    const colorSurcharge = surchargeMatch ? surchargeMatch.surcharge : 0;

    // --- Model-based pricing for repaint services ---
    if (service.usesModelPricing && motorModel) {
      const subcategory = service.subcategory || null;
      const lookup = lookupRepaintPrice(motorModel, subcategory, finalSize);
      const priceInfo = formatRepaintPriceResult(lookup);

      if (priceInfo) {
        const basePrice = priceInfo.price || null;
        const finalPrice = basePrice ? basePrice + colorSurcharge : null;

        const result = {
          success: true,
          service_name: service.name,
          category: service.category,
          subcategory: subcategory,
          summary: service.summary,
          description: service.description,
          estimated_duration: durationFormatted,
          motor_model: priceInfo.motor_model,
          motor_size: finalSize || null,
          ...priceInfo,
          color_name: surchargeMatch ? surchargeMatch.name : colorNameInput,
          color_surcharge: colorSurcharge,
          color_surcharge_formatted: `Rp${colorSurcharge.toLocaleString('id-ID')}`,
          final_price: finalPrice,
          final_price_formatted: finalPrice ? `Rp${finalPrice.toLocaleString('id-ID')}` : null,
          syarat_ketentuan: syaratKetentuan,
        };

        if (senderNumber && finalSize) {
          await setPreferredSizeForService(senderNumber, category, finalSize);
          await setMotorSizeForSender(senderNumber, {
            serviceSize: category === 'repaint' ? null : finalSize,
            repaintSize: category === 'repaint' ? finalSize : null,
            motor_model: motorModel,
          });
        }

        return result;
      }
    }

    // --- Fallback: variant-based (S/M/L/XL) or flat price ---
    const variant = service.variants?.find(v => v.name === finalSize);
    const basePrice = variant?.price ?? service.price;

    const result = {
      success: true,
      service_name: service.name,
      category: service.category,
      summary: service.summary,
      description: service.description,
      estimated_duration: durationFormatted,
      motor_size: finalSize || null,
      price: basePrice || null,
      price_formatted: basePrice ? `Rp${basePrice.toLocaleString('id-ID')}` : 'Harga perlu model motor',
      color_name: surchargeMatch ? surchargeMatch.name : colorNameInput,
      color_surcharge: colorSurcharge,
      color_surcharge_formatted: `Rp${colorSurcharge.toLocaleString('id-ID')}`,
      final_price: basePrice ? basePrice + colorSurcharge : null,
      final_price_formatted: basePrice ? `Rp${(basePrice + colorSurcharge).toLocaleString('id-ID')}` : null,
    };

    // Jika repaint dan tidak ada model, beri hint
    if (service.usesModelPricing && !motorModel) {
      result.hint = 'Untuk harga yang lebih akurat, sertakan model motor (contoh: Scoopy, NMax, Beat).';
    }

    if (senderNumber && finalSize) {
      await setPreferredSizeForService(senderNumber, category, finalSize);
      await setMotorSizeForSender(senderNumber, {
        serviceSize: category === 'repaint' ? null : finalSize,
        repaintSize: category === 'repaint' ? finalSize : null,
        motor_model: motorModel,
      });
    }

    return result;

  } catch (err) {
    console.error('[getServiceDetailsTool] Error:', err);
    return { success: false, error: 'internal_error', message: err.message };
  }
}

const getServiceDetailsTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: "getServiceDetails",
      description: "Dapatkan informasi LENGKAP layanan: deskripsi, SOP, harga, dan estimasi waktu. Wajib dipanggil saat user tanya harga atau detail layanan.",
      parameters: {
        type: "object",
        properties: {
          service_name: {
            type: "string",
            description: "Nama layanan, misal: 'Coating Motor Doff', 'Full Detailing', 'Repaint Bodi Halus'."
          },
          motor_model: {
            type: "string",
            description: "Model motor spesifik (misal: 'Scoopy', 'NMax', 'Beat', 'CBR 150R'). Wajib untuk layanan repaint agar mendapat harga akurat."
          },
          size: {
            type: "string",
            description: "Ukuran motor (S/M/L/XL) jika sudah diketahui."
          },
          color_name: {
            type: "string",
            description: "Nama warna repaint untuk cek biaya tambahan (surcharge), misal: 'Candy Red', 'Bunglon', 'Chrome'."
          },
          senderNumber: { type: "string", description: "Nomor WA pelanggan (otomatis)." }
        },
        required: ["service_name"],
      },
    },
  },
  implementation,
};

module.exports = { getServiceDetailsTool };