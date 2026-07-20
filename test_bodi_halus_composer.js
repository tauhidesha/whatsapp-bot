require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
global.prisma = new PrismaClient();
const { composerNode } = require('./src/ai/graph/nodes/composer');

async function main() {
    const state = {
        metadata: { thread_id: 'test', phoneReal: '62899999999' },
        customer: { name: 'Tauhid' },
        planner: {
            decision: {
                goal: 'PRICE_ESTIMATION',
                strategy: 'PROVIDE_PRICE'
            },
            execution: {
                toolIntent: 'GET_PRICE'
            },
            conversation: {
                informationPriority: []
            }
        },
        tool: {
            lastCapability: 'pricing',
            lastResult: {
                success: true,
                multiple_candidates: true,
                category: 'repaint_bodi_halus',
                motor_model: 'Vario',
                motor_size: 'M',
                message: 'Berikut 4 pilihan paket Repaint Bodi Halus untuk motor Vario.',
                candidates: [
                    { name: 'Repaint Bodi Halus - Paket Premium', price_formatted: 'Rp1.350.000', summary: 'Level tertinggi. Cat berlapis extra clear.', description: 'Spesifikasi:\n- Basecoat PU\n- Clear HS (di-clear 2x)\n- Garansi 2 Tahun' },
                    { name: 'Repaint Bodi Halus - Paket Ekonomis', price_formatted: 'Rp900.000', summary: 'Harga dasar. Cocok untuk budget.', description: 'Spesifikasi:\n- Basecoat PU\n- Clear MS\n- Tanpa Garansi' }
                ],
                formattedText: '- Repaint Bodi Halus - Paket Premium: Rp1.350.000\n  Keterangan: Level tertinggi. Cat berlapis extra clear.\n  Detail:\nSpesifikasi:\n- Basecoat PU\n- Clear HS (di-clear 2x)\n- Garansi 2 Tahun\n\n- Repaint Bodi Halus - Paket Ekonomis: Rp900.000\n  Keterangan: Harga dasar. Cocok untuk budget.\n  Detail:\nSpesifikasi:\n- Basecoat PU\n- Clear MS\n- Tanpa Garansi\n'
            }
        },
        analytics: {}
    };

    const res = await composerNode(state);
    console.log("Result:", res.messages[0].content);
}

main().catch(console.error).finally(() => process.exit(0));
