// File: src/ai/tools/getMotorSizeDetailsTool.js
// JavaScript version for easier integration

const daftarUkuranMotor = require('../../data/daftarUkuranMotor.js');
const levenshtein = require('js-levenshtein');

const SIMILARITY_THRESHOLD = 0.75;

function getSimilarity(a, b) {
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  // Hindari pembagian dengan nol jika string kosong
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

function normalizeToolInput(input, fieldName) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const value = input[fieldName];
  
  if (typeof value !== 'string') {
    return null;
  }

  // Normalisasi: trim, hapus karakter khusus, ubah ke lowercase
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Hapus karakter khusus kecuali alfanumerik dan spasi
    .replace(/\s+/g, ' '); // Normalisasi spasi ganda
}

async function implementation(input) {
  // Tidak perlu baca file, motorDb sudah di-import langsung
  console.log('[getMotorSizeDetailsTool][DEBUG] input:', input);
  console.log('[getMotorSizeDetailsTool][DEBUG] Jumlah data motor:', Array.isArray(daftarUkuranMotor) ? daftarUkuranMotor.length : 'N/A');
  if (!daftarUkuranMotor || !Array.isArray(daftarUkuranMotor)) {
    console.error('[getMotorSizeDetailsTool] KRITIS: Gagal memuat database motor dari file JavaScript.');
    return {
      success: false,
      message: 'Kesalahan internal: Database ukuran motor tidak dapat diakses.',
    };
  }
  

  // Normalisasi query: hapus angka/tahun/nama belakang agar pencarian lebih toleran
  let motor_query = normalizeToolInput(input, 'motor_query')?.trim().toLowerCase();
  if (!motor_query) {
    return {
      success: false,
      message: 'motor_query tidak valid atau kosong.',
    };
  }
  
  // Hilangkan tahun, model khusus, dan kata-kata tambahan
  motor_query = motor_query
    .replace(/\s*\d{4,5}\b.*$/, '') // hilangkan tahun (2023, 2024, dll)
    .replace(/\s+abs\b.*$/, '') // hilangkan kata "abs"
    .replace(/\s+(prestige|sporty|stylish|deluxe|premium|grande|fi|esp|cw|pgm-fi|injection)\b.*$/i, '') // hilangkan varian
    .replace(/\s+(125|150|160|250|300)\b.*$/i, '') // hilangkan cc yang spesifik
    .trim();
    
  // Jika masih ada lebih dari 2 kata, ambil 2 kata pertama saja
  if (motor_query.split(' ').length > 2) {
    motor_query = motor_query.split(' ').slice(0, 2).join(' ');
  }
  
  console.log('[getMotorSizeDetailsTool][DEBUG] Query (normalized):', motor_query);

  let bestMatch = null;
  let bestScore = 0;

  // Debug log: tampilkan similarity setiap kandidat
  for (const entry of daftarUkuranMotor) {
    const model = entry.model?.toLowerCase() || '';
    const aliases = (entry.aliases || []).map((a) => a.toLowerCase());
    const candidates = [model, ...aliases];

    for (const candidate of candidates) {
      let score = getSimilarity(motor_query, candidate);
      
      // Boost score jika ada partial match yang kuat
      if (motor_query.includes(candidate) || candidate.includes(motor_query)) {
        score = Math.max(score, 0.85);
      }
      
      // Boost score untuk common variations
      if (motor_query === 'scoopy' && candidate.includes('scoopy')) {
        score = Math.max(score, 0.95);
      }
      
      // OPSI: Matikan log ini jika sudah tidak diperlukan untuk mengurangi noise
      // console.log(`[getMotorSizeDetailsTool][DEBUG] Cek kandidat: "${candidate}" vs "${motor_query}" => similarity: ${score}`);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }
  }

  if (!bestMatch || bestScore < SIMILARITY_THRESHOLD) {
    return {
      success: false,
      message: `Motor "${motor_query}" tidak dikenali dalam database ukuran.`,
      similarity: bestScore,
    };
  }

  return {
    success: true,
    motor_query,
    motor_size: bestMatch.service_size,
    repaint_size: bestMatch.repaint_size,
    matched_model: bestMatch.model,
    similarity: bestScore,
  };
}

const getMotorSizeDetailsTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getMotorSizeDetails',
      description: 'Mendeteksi ukuran motor berdasarkan nama/jenis motor yang disebut user.',
      parameters: {
        type: 'object',
        properties: {
          motor_query: {
            type: 'string',
            description: 'Nama motor dari user, misalnya "vario", "nmax", "vespa", dll.',
          },
        },
        required: ['motor_query'],
      },
    },
  },
  implementation,
};

module.exports = { getMotorSizeDetailsTool };
