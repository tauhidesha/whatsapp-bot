// File: src/ai/tools/getServiceDetailsTool.js
// Tool gabungan untuk mendapatkan deskripsi, SOP, harga, dan estimasi waktu layanan.

const prisma = require('../../lib/prisma');

// --- Helper Functions ---

async function lookupColorSurcharge(colorName) {
  if (!colorName || typeof colorName !== 'string') return null;
  const query = colorName.trim().toLowerCase();

  const surcharges = await prisma.surcharge.findMany();

  // Fuzzy match with surcharge
  for (const entry of surcharges) {
    const candidates = [entry.name, ...(entry.aliases || [])].map(a => a.toLowerCase());
    for (const candidate of candidates) {
      if (candidate === query || query.includes(candidate) || candidate.includes(query)) {
        return {
          name: entry.name,
          surcharge: entry.amount,
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

async function lookupMotorSizeFromData(motorModel) {
  if (!motorModel) return null;
  const query = motorModel.trim().toLowerCase();
  
  const vehicleModels = await prisma.vehicleModel.findMany();
  
  for (const entry of vehicleModels) {
    const candidates = [entry.modelName, ...(entry.aliases || [])].map(a => a.toLowerCase());
    if (candidates.some(c => c === query || query.includes(c) || c.includes(query))) {
      return entry;
    }
  }
  return null;
}

async function resolveSizeForService({ service, sizeArg, motorModel }) {
  const category = (service.category || inferCategory(service.name)).toLowerCase();
  let finalSize = sizeArg;

  // 1. Prefer size from motorModel data if provided
  if (!finalSize && motorModel) {
    const motorData = await lookupMotorSizeFromData(motorModel);
    if (motorData) {
      finalSize = category === 'repaint' ? motorData.repaintSize : motorData.serviceSize;
      console.log(`[resolveSizeForService] Inferred ${finalSize} from model ${motorModel}`);
    }
  }

  return { finalSize, category };
}

async function getPromoInfo() {
  try {
    const kv = await prisma.keyValueStore.findUnique({
      where: {
        collection_key: {
          collection: 'settings',
          key: 'promo_config'
        }
      }
    });

    if (kv && kv.value.isActive) {
      return `💡 *PROMO BOOM BULAN INI:* \n\n${kv.value.promoText}\n\n*Syarat & Ketentuan berlaku.*`;
    }
  } catch (error) {
    console.warn('[getServiceDetailsTool] Failed to fetch promo:', error.message);
  }
  return null;
}

async function getSyaratKetentuan() {
  const kv = await prisma.keyValueStore.findUnique({
    where: { collection_key: { collection: 'settings', key: 'syarat_ketentuan_repaint' } }
  });
  return kv ? kv.value : [
    "Harga di atas adalah harga FIX untuk Body Halus.",
    "Harga belum termasuk Body Kasar.",
    "Harga belum termasuk Pretelan/Aksesoris.",
    "Harga bisa berubah sesuai kondisi Body/Motor (lecet parah/pecah).",
    "Untuk warna Bunglon, Hologram, atau Chrome, harga melalui kesepakatan khusus.",
    "Harga Velg belum termasuk tambahan CAT Behel/Arm/Shock (+50rb) atau CVT (+100rb).",
    "Biaya Remover Velg (bekas cat/jamur) +50rb s/d 100rb.",
  ];
}

async function lookupRepaintPrice(motorModel, subcategory, motorSize) {
  if (!motorModel) return null;

  const motorData = await lookupMotorSizeFromData(motorModel);
  if (!motorData) return null;

  // 1. Bodi Halus (usesModelPricing = true)
  if (!subcategory || subcategory === 'bodi_halus') {
    const service = await prisma.service.findFirst({ where: { subcategory: 'bodi_halus' } });
    if (service) {
      const priceEntry = await prisma.servicePrice.findFirst({
        where: { serviceId: service.id, vehicleModelId: motorData.id }
      });
      if (priceEntry) {
        return {
          found: true,
          model: motorData.modelName,
          price: priceEntry.price,
          note: service.note,
          brand: motorData.brand,
          subcategory: 'bodi_halus',
        };
      }
    }
  }

  // 2. Bodi Kasar (usesModelPricing = false, based on size)
  if (subcategory === 'bodi_kasar') {
    const service = await prisma.service.findFirst({ where: { subcategory: 'bodi_kasar' } });
    const size = motorSize || motorData.repaintSize;
    if (service && size) {
      const priceEntry = await prisma.servicePrice.findFirst({
        where: { serviceId: service.id, size: size }
      });
      if (priceEntry) {
        return {
          found: true,
          model: motorData.modelName,
          price: priceEntry.price,
          subcategory: 'bodi_kasar',
          note: `Kategori: ${size}`,
        };
      }
    }
  }

  // 3. Velg (Hybrid)
  if (subcategory === 'velg') {
    const service = await prisma.service.findFirst({ where: { subcategory: 'velg' } });
    if (service) {
      // Try model-specific first
      let priceEntry = await prisma.servicePrice.findFirst({
        where: { serviceId: service.id, vehicleModelId: motorData.id }
      });
      // Fallback to size-based
      if (!priceEntry) {
        const size = motorSize || motorData.repaintSize;
        priceEntry = await prisma.servicePrice.findFirst({
          where: { serviceId: service.id, size: size }
        });
      }

      if (priceEntry) {
        return {
          found: true,
          model: motorData.modelName,
          price: priceEntry.price,
          subcategory: 'velg',
          note: 'Harga per pasang, sudah termasuk bongkar pasang ban.',
        };
      }
    }
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

  return null;
}

function guessingPricingPerSize(size, type) {
  const s = size || 'M';
  if (type === 'Add-on Part') {
    if (s === 'S') return 50000;
    if (s === 'M') return 75000;
    if (s === 'L') return 100000;
    if (s === 'XL') return 125000;
    return 75000;
  }
  return 0;
}

async function getColorSurcharge(colorName, size) {
  const result = await lookupColorSurcharge(colorName);
  if (!result) return 0;
  
  // Base surcharge from DB
  let amount = result.surcharge;
  
  // Scale by size if needed (optional logic, can be customized)
  const s = size || 'M';
  if (s === 'L') amount = Math.round(amount * 1.2 / 25000) * 25000;
  if (s === 'XL') amount = Math.round(amount * 1.5 / 25000) * 25000;
  
  return amount;
}

// --- Implementation ---
async function processSingleService(parsedServiceName, input, promoText) {
    let motorModel = (
        input.motor_model || input.motorModel ||
        input.motor_type || input.motorType ||
        input.vehicle_type || input.vehicleType ||
        input.vehicle_model || input.vehicleModel ||
        input.motor_model_name ||
        '').toString().trim() || null;

    const extraContext = input.extraContext || {};
    const colorChoice = extraContext.colorChoice || (input.color_name || input.colorName || '').toString().trim() || null;
    const velgColorChoice = extraContext.velgColorChoice || null;
    const sizeFromArgs = normalizeSizeInput(input.size || input.motorSize || input.motor_size || input.vehicle_size || input.vehicleSize);

    const queryLower = parsedServiceName.trim().toLowerCase();

    // 1. Check for generic category queries - MANDATORY MOTOR MODEL
    if (queryLower === 'coating' || queryLower === 'detailing' || queryLower === 'poles' || queryLower === 'repaint') {
        if (!motorModel) {
            return {
                success: true,
                needs_clarification: true,
                message: `Untuk memberikan estimasi harga ${queryLower}, mohon infokan tipe motornya (misal: Vario, NMAX, Scoopy, Beat) agar aku bisa berikan harga yang pas kak.`,
                action: 'ASK_USER'
            };
        }
    }

    // Helper for applying all surcharges including color, disassembly, and add-ons
    async function applyAllSurcharges(basePrice, serviceName, guess, motor_model, extraContext) {
        let finalPrice = basePrice;
        let breakdown = [];
        
        console.log(`[applyAllSurcharges] Processing "${serviceName}" (Size ${guess}) for ${motor_model}`);
        console.log(`[applyAllSurcharges] ExtraContext:`, JSON.stringify(extraContext));

        // 1. Color Surcharge (for Repaint services)
        if (serviceName.toLowerCase().includes('repaint')) {
            const colorType = extraContext.colorChoice || extraContext.paintType;
            if (colorType) {
                const colorSurcharge = await getColorSurcharge(colorType, guess);
                if (colorSurcharge > 0) {
                    finalPrice += colorSurcharge;
                    breakdown.push(`+Rp${colorSurcharge.toLocaleString('id-ID')} (Warna ${colorType})`);
                    console.log(`[applyAllSurcharges] Color surcharge applied: ${colorSurcharge}`);
                }
            }
        }

        // 2. Velg Color Surcharge
        if (serviceName.toLowerCase().includes('velg')) {
            const velgColor = extraContext.velgColorChoice || extraContext.colorChoice;
            if (velgColor) {
                const colorSurcharge = await getColorSurcharge(velgColor, guess);
                if (colorSurcharge > 0) {
                    finalPrice += colorSurcharge;
                    breakdown.push(`+Rp${colorSurcharge.toLocaleString('id-ID')} (Warna ${velgColor})`);
                    console.log(`[applyAllSurcharges] Velg color surcharge applied: ${colorSurcharge}`);
                }
            }
        }

        // 3. Remover fee (Cat Lama)
        if (extraContext.isPreviouslyPainted === true) {
            let removerFee = 0;
            if (serviceName.toLowerCase().includes('velg')) {
                removerFee = 75000; // Fixed for velg
            } else if (serviceName.toLowerCase().includes('bodi kasar')) {
                removerFee = 125000; // Fixed for bodi kasar
            }
            
            if (removerFee > 0) {
                finalPrice += removerFee;
                breakdown.push(`+Rp${removerFee.toLocaleString('id-ID')} (Remover Cat Lama)`);
                console.log(`[applyAllSurcharges] Remover fee applied: ${removerFee}`);
            }
        }

        // 4. Bongkar Total
        if (extraContext.isBongkarTotal === true) {
            const bongkarFee = 150000; // Fixed fee for disassembly
            finalPrice += bongkarFee;
            breakdown.push(`+Rp${bongkarFee.toLocaleString('id-ID')} (Bongkar Pasang)`);
            console.log(`[applyAllSurcharges] Disassembly fee applied: ${bongkarFee}`);
        }

        // 5. Specific Add-ons (CVT, Behel, Arm, Shock)
        const addOnParts = ['cvt', 'behel', 'arm', 'shock'];
        if (extraContext.detailingFocus) {
            const focus = extraContext.detailingFocus.toLowerCase();
            for (const part of addOnParts) {
                if (focus.includes(part)) {
                    const surcharge = guessingPricingPerSize(guess, 'Add-on Part');
                    if (surcharge > 0) {
                        finalPrice += surcharge;
                        breakdown.push(`+Rp${surcharge.toLocaleString('id-ID')} (Add-on ${part.toUpperCase()})`);
                        console.log(`[applyAllSurcharges] Add-on surcharge applied for ${part}: ${surcharge}`);
                    }
                }
            }
        }

        return { finalPrice, breakdownText: breakdown.length > 0 ? ` [${breakdown.join(', ')}]` : '' };
    }

    // Handle generic category results
    if (queryLower === 'coating' || queryLower === 'detailing' || queryLower === 'poles') {
        const cat = queryLower === 'poles' ? 'detailing' : queryLower;
        const services = await prisma.service.findMany({
            where: { category: cat },
            include: { prices: true }
        });

        const results = await Promise.all(services.map(async (service) => {
            const { finalSize } = await resolveSizeForService({ service, sizeArg: sizeFromArgs, motorModel });
            const priceEntry = service.prices.find(p => p.size === finalSize) || service.prices.find(p => !p.size && !p.vehicleModelId);
            const basePrice = priceEntry?.price ?? 0;

            const { finalPrice, breakdownText } = await applyAllSurcharges(basePrice, service.name, finalSize, motorModel, extraContext);

            return {
                name: service.name,
                summary: service.summary,
                price: finalPrice || 'Hubungi Admin',
                price_formatted: finalPrice ? `Rp${finalPrice.toLocaleString('id-ID')}${breakdownText}` : 'Hubungi Admin',
                size: finalSize || 'Belum diketahui'
            };
        }));

        return {
            success: true,
            multiple_candidates: true,
            category: cat,
            motor_model: motorModel,
            candidates: results,
            promo_active: !!promoText,
            message: `Berikut estimasi harga ${cat} untuk motor ${motorModel}.`
        };
    }

    if (queryLower === 'repaint') {
        const results = [];
        const { finalSize } = await resolveSizeForService({ service: { category: 'repaint' }, sizeArg: sizeFromArgs, motorModel });

        const subs = ['bodi_halus', 'bodi_kasar', 'velg'];
        for (const sub of subs) {
            const lookup = await lookupRepaintPrice(motorModel, sub, finalSize);
            const info = formatRepaintPriceResult(lookup);
            if (info && info.price) {
                const sName = sub === 'bodi_halus' ? 'Repaint Bodi Halus' : (sub === 'bodi_kasar' ? 'Repaint Bodi Kasar' : 'Repaint Velg');
                const { finalPrice, breakdownText } = await applyAllSurcharges(info.price, sName, finalSize, motorModel, extraContext);

                results.push({
                    name: sName,
                    price: finalPrice,
                    price_formatted: `Rp${finalPrice.toLocaleString('id-ID')}${breakdownText}`,
                    note: info.note
                });
            }
        }

        const fixedRepaints = await prisma.service.findMany({
            where: { category: 'repaint', usesModelPricing: false, subcategory: null },
            include: { prices: true }
        });
        for (const s of fixedRepaints) {
            const basePrice = s.prices[0]?.price || 0;
            const { finalPrice, breakdownText } = await applyAllSurcharges(basePrice, s.name, finalSize, motorModel, extraContext);
            results.push({ 
                name: s.name, 
                price: finalPrice, 
                price_formatted: `Rp${finalPrice.toLocaleString('id-ID')}${breakdownText}`, 
                note: s.summary 
            });
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

    // 2. Specific Service Query
    const allServices = await prisma.service.findMany({ include: { prices: true } });
    const candidates = allServices
        .map(s => ({ ...s, similarity: stringSimilarity(parsedServiceName, s.name) }))
        .filter(s => s.similarity >= 0.4)
        .sort((a, b) => b.similarity - a.similarity);

    if (candidates.length === 0) {
        return { success: false, error: 'not_found', message: `Layanan "${parsedServiceName}" tidak ditemukan.` };
    }

    const service = candidates[0];
    const { finalSize } = await resolveSizeForService({ service, sizeArg: sizeFromArgs, motorModel });

    // CHECK IF MOTOR MODEL IS NEEDED
    const isSizeBased = service.prices.some(p => p.size);
    if ((service.usesModelPricing || isSizeBased) && !motorModel) {
        return {
            success: true,
            needs_clarification: true,
            message: `Layanan "${service.name}" harganya tergantung pada tipe motor. Boleh tahu motor kakak tipe apa (misal: NMax, Vario, Beat)?`,
            action: "ASK_USER"
        };
    }

    const durationFormatted = formatDuration(service.estimatedDuration);
    
    // Find base price
    let basePrice = 0;
    if (service.usesModelPricing) {
        const lookup = await lookupRepaintPrice(motorModel, service.subcategory, finalSize);
        if (lookup) basePrice = lookup.price;
    } else {
        const priceEntry = service.prices.find(p => p.size === finalSize) || service.prices.find(p => !p.size && !p.vehicleModelId);
        basePrice = priceEntry?.price || 0;
    }

    // Apply Surcharges
    if (!basePrice && !service.prices.some(p => p.price > 0)) {
        return { success: false, error: 'price_not_found', message: `Harga "${service.name}" belum tersedia.` };
    }

    const { finalPrice, breakdownText } = await applyAllSurcharges(basePrice, service.name, finalSize, motorModel, extraContext);

    return {
        success: true,
        service_id: service.id,
        service_name: service.name,
        summary: service.summary,
        price: finalPrice,
        price_formatted: `Rp${finalPrice.toLocaleString('id-ID')}${breakdownText}`,
        estimated_duration: durationFormatted,
        motor_model: motorModel,
        motor_size: finalSize,
        promo_active: !!promoText,
        promo_text: promoText,
        message: `Estimasi harga ${service.name} untuk motor ${motorModel} adalah Rp${finalPrice.toLocaleString('id-ID')}.`
    };
}


async function implementation(input) {
  try {
    if (!input || typeof input !== 'object') {
      return { success: false, error: 'generic_error', message: 'Input tidak valid' };
    }

    let serviceNames = input.service_name || input.serviceName;
    const promo = await getPromoInfo();

    if (!serviceNames) {
      return { success: false, error: 'generic_error', message: 'service_name tidak valid atau kosong' };
    }

    if (typeof serviceNames === 'string') {
      serviceNames = serviceNames.includes(',') ? serviceNames.split(',').map(s => s.trim()).filter(Boolean) : [serviceNames];
    }

    if (Array.isArray(serviceNames)) {
      const results = await Promise.all(
        serviceNames.map(name => {
          if (typeof name !== 'string') return { success: false, error: 'generic_error', message: 'invalid service_name element' };
          return processSingleService(name, input, promo);
        })
      );
      return {
        success: true,
        multiple_services_requested: true,
        results: results
      };
    } else {
      return { success: false, error: 'generic_error', message: 'service_name must be an array of strings' };
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
      description: "Cek harga/layanan.",
      parameters: {
        type: "object",
        properties: {
          service_name: {
            type: "array",
            items: { type: "string" },
            description: "Array nama layanan spesifik (contoh: ['Repaint Bodi Halus']). WAJIB pilih dari: 'Repaint Bodi Halus', 'Repaint Bodi Kasar', 'Repaint Velg', 'Repaint Cover CVT', 'Spot Repair', 'Detailing Mesin', 'Cuci Komplit', 'Poles Bodi Glossy', 'Full Detailing Glossy', 'Coating Doff', 'Coating Glossy', 'Complete Service Doff', 'Complete Service Glossy'. JANGAN isi dengan kategori umum seperti 'repaint'."
          },
          motor_model: {
            type: "string",
            description: "Nama spesifik model motor WAJIB diisi (contoh: NMax, PCX, Scoopy, Beat, Vario). JANGAN isi dengan kategori seperti 'Matic Besar', 'Bebek', atau 'Sport'."
          },
          size: {
            type: "string",
            description: "Ukuran motor (S/M/L/XL)."
          },
          color_name: {
            type: "string",
            description: "Nama warna repaint."
          }
        },
        required: ["service_name"],
      },
    },
  },
  implementation,
};

module.exports = { getServiceDetailsTool };
