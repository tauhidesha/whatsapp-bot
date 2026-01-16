// File: src/ai/tools/getServiceDescriptionTool.js
// JavaScript runtime implementation to get service description

const { z } = require('zod');
const deskripsiLayanan = require('../../data/deskripsiLayanan.js');

const InputSchema = z.object({
  service_name: z.string().describe('Nama layanan spesifik yang ingin dijelaskan atau dijual ke pelanggan'),
});

/**
 * Fungsi untuk mencari layanan dengan fuzzy matching
 */
function findServiceWithFuzzyMatch(query) {
  const normalized = query.toLowerCase().trim();
  
  // 1. Exact match dulu
  let service = (deskripsiLayanan || []).find(
    (s) => s.name && s.name.toLowerCase() === normalized
  );
  
  if (service) return service;
  
  // 2. Contains match
  service = (deskripsiLayanan || []).find(
    (s) => s.name && (
      s.name.toLowerCase().includes(normalized) || 
      normalized.includes(s.name.toLowerCase())
    )
  );
  
  if (service) return service;
  
  // 3. Keyword matching untuk terms umum
  const keywordMappings = {
    'detailing': ['Full Detailing', 'Detailing Mesin'],
    'coating': ['Coating Motor', 'Coating Motor Doff'],
    'poles': ['Poles Bodi'],
    'cuci': ['Cuci Komplit', 'Cuci Biasa'],
    'repaint': ['Repaint'],
    'complete': ['Complete Service', 'Complete Service Doff'],
    'doff': ['Coating Motor Doff', 'Complete Service Doff'],
  };
  
  for (const [keyword, serviceNames] of Object.entries(keywordMappings)) {
    if (normalized.includes(keyword)) {
      // Cari layanan yang cocok dengan keyword
      for (const serviceName of serviceNames) {
        service = (deskripsiLayanan || []).find(
          (s) => s.name && s.name.toLowerCase().includes(serviceName.toLowerCase())
        );
        if (service) return service;
      }
    }
  }
  
  // 4. Partial word matching (untuk typo ringan)
  service = (deskripsiLayanan || []).find((s) => {
    if (!s.name) return false;
    const serviceName = s.name.toLowerCase();
    const words = normalized.split(' ');
    
    return words.some(word => 
      word.length > 2 && serviceName.includes(word)
    );
  });
  
  return service || null;
}

async function implementation(input) {
  try {
    console.log('[getServiceDescriptionTool] Input:', input);
    const { service_name } = InputSchema.parse(input);

    // Gunakan fuzzy matching yang lebih robust
    const service = findServiceWithFuzzyMatch(service_name);

    if (!service) {
      console.warn(`[getServiceDescriptionTool] Tidak ditemukan: "${service_name}"`);
      
      // Berikan hint layanan yang tersedia
      const availableServices = (deskripsiLayanan || []).map(s => s.name).filter(Boolean);
      
      return {
        success: false,
        error: 'not_found',
        message: `Layanan "${service_name}" tidak ditemukan. Layanan tersedia: ${availableServices.slice(0, 5).join(', ')}, dll.`,
      };
    }

    console.log('[getServiceDescriptionTool] Found:', service.name);
    return {
      success: true,
      description: service.description || '',
      summary: service.summary || '',
      matched_service: service.name, // Beri tahu AI nama layanan yang sebenarnya
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[getServiceDescriptionTool] ZodError:', err.issues);
    } else {
      console.error('[getServiceDescriptionTool] Error:', err);
    }
    return {
      success: false,
      error: 'internal_error',
      message: err?.message || 'Terjadi error saat mengambil deskripsi layanan.',
    };
  }
}

const getServiceDescriptionTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getServiceDescription',
      description: 'Dapatkan deskripsi detail layanan. Gunakan nama layanan dalam bahasa Indonesia. Contoh: "Full Detailing", "Coating Motor", "Poles Bodi", "Cuci Komplit".',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Nama layanan yang ingin dijelaskan. Contoh: "Full Detailing", "Coating Motor Doff", "Repaint"',
          },
        },
        required: ['service_name'],
      },
    },
  },
  implementation,
};

// Bonus: Export helper untuk debugging
function testServiceMatching(query) {
  const service = findServiceWithFuzzyMatch(query);
  console.log(`Query: "${query}" -> Match: ${service?.name || 'Not found'}`);
  return service;
}

module.exports = {
  getServiceDescriptionTool,
  testServiceMatching,
};
