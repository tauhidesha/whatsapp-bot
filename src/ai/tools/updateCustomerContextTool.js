// File: src/ai/tools/updateCustomerContextTool.js
// Tool untuk Zoya menyimpan catatan penting tentang pelanggan ke memori persisten.

const { setMotorSizeForSender } = require('../utils/motorSizeMemory.js');

const implementation = async (input) => {
    try {
        const {
            senderNumber,
            motor_model,
            target_service,
            important_notes
        } = input;

        if (!senderNumber) {
            return { success: false, message: 'senderNumber wajib diisi.' };
        }

        const updateData = {};
        if (motor_model) updateData.motor_model = motor_model;
        if (target_service) updateData.target_service = target_service;
        if (important_notes) updateData.important_notes = important_notes;

        if (Object.keys(updateData).length === 0) {
            return { success: false, message: 'Tidak ada data untuk diperbarui.' };
        }

        await setMotorSizeForSender(senderNumber, updateData);

        return {
            success: true,
            message: 'Konteks pelanggan berhasil diperbarui.',
            updated_data: updateData
        };

    } catch (error) {
        console.error('[updateCustomerContextTool] Error:', error);
        return { success: false, message: `Gagal memperbarui konteks: ${error.message}` };
    }
};

const updateCustomerContextTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'updateCustomerContext',
            description: 'Gunakan tool ini untuk MENCATAT detail penting tentang pelanggan agar Zoya tidak lupa di masa depan (misal: jenis motor, layanan yang diinginkan, atau catatan khusus seperti budget/jadwal).',
            parameters: {
                type: 'object',
                properties: {
                    motor_model: {
                        type: 'string',
                        description: 'Model motor pelanggan (misal: Beat, NMax).'
                    },
                    target_service: {
                        type: 'string',
                        description: 'Layanan yang sedang diminati atau ditanyakan pelanggan.'
                    },
                    important_notes: {
                        type: 'string',
                        description: 'Catatan penting lainnya (misal: "Lagi nunggu gajian", "Mau datang hari Sabtu").'
                    },
                    senderNumber: {
                        type: 'string',
                        description: 'Nomor WhatsApp pelanggan (otomatis).'
                    }
                }
            }
        }
    },
    implementation,
};

module.exports = { updateCustomerContextTool };
