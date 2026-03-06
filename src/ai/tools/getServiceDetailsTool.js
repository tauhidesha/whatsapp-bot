// File: src/ai/tools/getServiceDetailsTool.js
// Tool gabungan untuk mendapatkan deskripsi, SOP, harga, dan estimasi waktu layanan.

const admin = require('firebase-admin');
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

async function getPromoInfo() {
  try {
    const db = admin.firestore();
    const doc = await db.collection('settings').doc('promo_config').get();

    if (doc.exists && doc.data().isActive) {
      const data = doc.data();
      return `💡 *PROMO BOOM BULAN INI:* \n\n${data.promoText}\n\n*Syarat & Ketentuan berlaku.*`;
    }
  } catch (error) {
    console.warn('[getServiceDetailsTool] Failed to fetch promo:', error.message);
  }
  return null;
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
          price: match.price,
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
async function processSingleService(parsedServiceName, input, promoText) {
  const motorModel = typeof input.motor_model === 'string' ? input.motor_model.trim() : null;
  const senderNumber = typeof input.senderNumber === 'string'
    ? input.senderNumber
    : typeof input.sender_number === 'string'
      ? input.sender_number
      : null;

  const colorNameInput = typeof input.color_name === 'string' ? input.color_name.trim() : null;
  const sizeFromArgs = normalizeSizeInput(input.size);
  const cachedSizes = senderNumber ? await getMotorSizesForSender(senderNumber) : null;

  // Special case for "coating" generic query
  if (parsedServiceName.trim().toLowerCase() === 'coating') {
    const names = ['Coating Motor Doff', 'Coating Motor Glossy', 'Complete Service Doff', 'Complete Service Glossy'];
    const services = masterLayanan.filter(s => names.includes(s.name));

    const results = await Promise.all(services.map(async (service) => {
      const { finalSize } = await resolveSizeForService({ service, sizeArg: sizeFromArgs, senderNumber, cachedSizes, motorModel });
      const variant = service.variants?.find(v => v.name === finalSize);
      const basePrice = variant?.price ?? service.price;

      return {
        name: service.name,
        summary: service.summary,
        price: basePrice || 'Tergantung ukuran',
        price_formatted: basePrice ? `Rp${basePrice.toLocaleString('id-ID')}` : 'Tergantung ukuran',
        size: finalSize || 'Belum diketahui'
      };
    }));

    return {
      success: true,
      multiple_candidates: true,
      category: 'coating',
      motor_model: motorModel || 'Belum diketahui',
      candidates: results,
      promo_active: !!promoText,
      message: 'Ditemukan beberapa paket coating & complete service. Silakan pilih sesuai kebutuhan.'
    };
  }

  // Special case for "detailing" generic query
  if (parsedServiceName.trim().toLowerCase() === 'detailing' || parsedServiceName.trim().toLowerCase() === 'poles') {
    const services = masterLayanan.filter(s => s.category === 'detailing');

    const results = await Promise.all(services.map(async (service) => {
      const { finalSize } = await resolveSizeForService({ service, sizeArg: sizeFromArgs, senderNumber, cachedSizes, motorModel });
      const variant = service.variants?.find(v => v.name === finalSize);
      const basePrice = variant?.price ?? service.price;

      return {
        name: service.name,
        summary: service.summary,
        price: basePrice || 'Tergantung ukuran',
        price_formatted: basePrice ? `Rp${basePrice.toLocaleString('id-ID')}` : 'Tergantung ukuran',
        size: finalSize || 'Belum diketahui'
      };
    }));

    return {
      success: true,
      multiple_candidates: true,
      category: 'detailing',
      motor_model: motorModel || 'Belum diketahui',
      candidates: results,
      promo_active: !!promoText,
      message: 'Berikut adalah daftar harga paket detailing kami.'
    };
  }

  // Special case for "repaint" generic query
  if (parsedServiceName.trim().toLowerCase() === 'repaint') {
    if (!motorModel) {
      return {
        success: true,
        multiple_candidates: true,
        needs_motor_model: true,
        message: 'Untuk memberikan estimasi harga repaint, mohon infokan tipe motornya (misal: Vario, NMax, Beat).'
      };
    }

    // We have a motor model, let's gather all repaint prices for it
    const results = [];
    const { finalSize } = await resolveSizeForService({ service: { category: 'repaint' }, sizeArg: sizeFromArgs, senderNumber, cachedSizes, motorModel });

    // 1. Bodi Halus
    const halusLookup = lookupRepaintPrice(motorModel, 'bodi_halus', finalSize);
    const halusInfo = formatRepaintPriceResult(halusLookup);
    if (halusInfo && halusInfo.price) {
      results.push({ name: 'Repaint Bodi Halus', price: halusInfo.price, price_formatted: halusInfo.price_formatted, note: halusInfo.note });
    }

    // 2. Bodi Kasar
    const kasarLookup = lookupRepaintPrice(motorModel, 'bodi_kasar', finalSize);
    const kasarInfo = formatRepaintPriceResult(kasarLookup);
    if (kasarInfo && kasarInfo.price) {
      results.push({ name: 'Repaint Bodi Kasar', price: kasarInfo.price, price_formatted: kasarInfo.price_formatted, note: kasarInfo.note });
    }

    // 3. Velg
    const velgLookup = lookupRepaintPrice(motorModel, 'velg', finalSize);
    const velgInfo = formatRepaintPriceResult(velgLookup);
    if (velgInfo && velgInfo.price) {
      results.push({ name: 'Repaint Velg', price: velgInfo.price, price_formatted: velgInfo.price_formatted, note: velgInfo.note });
    }

    // 4. Cover CVT / Arm (Fixed price from masterLayanan)
    const cvtService = masterLayanan.find(s => s.name === 'Repaint Cover CVT / Arm');
    if (cvtService) {
      results.push({ name: cvtService.name, price: cvtService.price, price_formatted: `Rp${cvtService.price.toLocaleString('id-ID')}`, note: cvtService.summary });
    }

    return {
      success: true,
      multiple_candidates: true,
      category: 'repaint',
      motor_model: motorModel,
      motor_size: finalSize,
      candidates: results,
      promo_active: !!promoText,
      message: `Berikut estimasi harga repaint untuk motor ${motorModel}.`
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
        promo_active: !!promoText,
        syarat_ketentuan: syaratKetentuan,
      };

      if (senderNumber && finalSize) {
        await setPreferredSizeForService(senderNumber, category, finalSize);
        await setMotorSizeForSender(senderNumber, {
          serviceSize: category === 'repaint' ? null : finalSize,
          repaintSize: category === 'repaint' ? finalSize : null,
          motor_model: motorModel,
          target_service: result.service_name,
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
    promo_active: !!promoText,
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
      target_service: result.service_name,
    });
  }

  return result;
}

async function implementation(input) {
  try {
    console.log('[getServiceDetailsTool] Input:', input);

    if (!input || typeof input !== 'object') {
      return { success: false, error: 'generic_error', message: 'Input tidak valid' };
    }

    const { service_name } = input;
    const promo = await getPromoInfo();

    if (!service_name) {
      return { success: false, error: 'generic_error', message: 'service_name tidak valid atau kosong' };
    }

    // Initialize return object structure matching standard response
    if (Array.isArray(service_name)) {
      const results = await Promise.all(
        service_name.map(name => {
          if (typeof name !== 'string') return { success: false, error: 'generic_error', message: 'invalid service_name element' };
          return processSingleService(name, input, promo);
        })
      );
      return {
        success: true,
        multiple_services_requested: true,
        results: results
      };
    } else if (typeof service_name === 'string') {
      return await processSingleService(service_name, input, promo);
    } else {
      return { success: false, error: 'generic_error', message: 'service_name must be a string or array of strings' };
    }

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
      description: "Dapatkan informasi harga dan layanan. Wajib dipanggil saat user tanya harga. Bisa kirim array of strings untuk cari banyak layanan sekaligus.",
      parameters: {
        type: "object",
        properties: {
          service_name: {
            type: ["string", "array"],
            items: {
              type: "string",
            },
            description: "Nama layanan atau array nama layanan, misal: 'Coating Motor Doff' atau ['Repaint Bodi Halus', 'Repaint Velg']."
          },
          motor_model: {
            type: "string",
            description: "Model motor spesifik (misal: 'Scoopy', 'NMax'). Wajib untuk repaint agar harga akurat."
          },
          size: {
            type: "string",
            description: "Ukuran motor (S/M/L/XL) jika sudah diketahui."
          },
          color_name: {
            type: "string",
            description: "Nama warna repaint untuk cek biaya tambahan, misal: 'Candy Red'."
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