// File: src/ai/tools/listServicesByCategoryTool.js
// JavaScript runtime implementation to list services by category

const { z } = require('zod');
const masterLayanan = require('../../data/masterLayanan.js');

// Schema validation to ensure input integrity
const InputSchema = z.object({
  category: z
    .string()
    .describe('Kategori layanan: "coating", "detailing", "repaint", atau "cuci".'),
});

async function implementation(input) {
  try {
    const { category } = InputSchema.parse(input);
    const categoryQuery = category.trim().toLowerCase();

    if (!categoryQuery) {
      return {
        success: false,
        message: 'Kategori layanan tidak boleh kosong.',
      };
    }

    const matchedServices = (Array.isArray(masterLayanan) ? masterLayanan : []).filter(
      (service) => service.category?.toLowerCase() === categoryQuery
    );

    if (matchedServices.length === 0) {
      return {
        success: false,
        message: `Tidak ditemukan layanan dengan kategori "${categoryQuery}".`,
      };
    }

    const summaries = matchedServices.map((service) => ({
      name: service.name,
      summary: service.summary,
      description: service.description,
    }));

    return {
      success: true,
      category: categoryQuery,
      services: summaries,
      message: `Ditemukan ${summaries.length} layanan untuk kategori "${categoryQuery}".`,
    };
  } catch (error) {
    console.error('[listServicesByCategoryTool] Error:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat memproses permintaan.',
    };
  }
}

const listServicesByCategoryTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'listServicesByCategory',
      description:
        'Menampilkan daftar layanan berdasarkan kategori seperti coating, detailing, atau repaint.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Kategori layanan: "coating", "detailing", "repaint", atau "cuci".',
          },
        },
        required: ['category'],
      },
    },
  },
  implementation,
};

module.exports = { listServicesByCategoryTool };
