/**
 * scripts/repairLidIdentities.js
 * Memperbaiki data pelanggan yang ter-normalisasi menjadi angka saja
 * kembali ke format @lid agar sinkron dengan WPPConnect.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repair() {
    console.log('🔍 Memulai perbaikan identitas @lid...');

    try {
        // 1. Cari pelanggan yang nomornya hanya angka tapi kemungkinan besar adalah LID
        // (LID biasanya sangat panjang, > 15 digit)
        // Cari semua kandidat:
        // 1. Yang sudah ada whatsappLid tapi phone masih angka
        // 2. Yang phone-nya angka panjang (>12 digit) - Potensi LID
        const numericOnly = await prisma.customer.findMany({
            where: { phone: { not: { contains: '@' } } }
        });

        const candidates = numericOnly.filter(c => {
            const p = c.phone || '';
            const hasLid = !!c.whatsappLid;
            return hasLid || p.length > 12 || p.startsWith('322');
        });

        console.log(`📋 Ditemukan ${candidates.length} kandidat untuk dikonversi ke @lid`);

        for (const customer of candidates) {
            const oldId = customer.phone;
            const newId = `${oldId}@lid`;

            console.log(`🔄 Mengonversi: ${oldId} -> ${newId}`);

            try {
                // Gunakan transaksi untuk memastikan integritas
                await prisma.$transaction(async (tx) => {
                    // 2. Jika target PHONE sudah ada, gabungkan
                    const existingByPhone = await tx.customer.findUnique({
                        where: { phone: newId }
                    });

                    if (existingByPhone) {
                        console.log(`⚠️  Target ${newId} sudah ada di kolom PHONE. Melakukan penggabungan data...`);
                        // Pindahkan konteks jika yang lama punya, tapi yang baru tidak
                        const oldCtx = await tx.customerContext.findUnique({ where: { id: oldId } });
                        const newCtx = await tx.customerContext.findUnique({ where: { id: newId } });

                        if (oldCtx && !newCtx) {
                            await tx.customerContext.create({
                                data: { ...oldCtx, id: newId, phone: newId }
                            });
                        }
                        await tx.customer.delete({ where: { phone: oldId } });
                    } else {
                        // 3. Jika target PHONE belum ada, tapi record ini punya whatsappLid yang benar
                        // Kita tidak bisa langsung create baru jika record ini sendiri yang memegang whatsappLid (crash unique)
                        
                        // 1. Pindah/Hapus Context dulu agar FK tidak melanggar saat Delete Customer
                        const oldCtx = await tx.customerContext.findUnique({ where: { id: oldId } });
                        if (oldCtx) {
                            await tx.customerContext.delete({ where: { id: oldId } });
                        }

                        // 2. Simpan data customer ke memori, delete, lalu create baru dengan ID baru
                        const customerData = { ...customer };
                        delete customerData.id; // UUID baru
                        customerData.phone = newId;

                        await tx.customer.delete({ where: { phone: oldId } });
                        
                        const newCustomer = await tx.customer.create({
                            data: customerData
                        });

                        // 3. Masukkan kembali Context ke ID baru
                        if (oldCtx) {
                            await tx.customerContext.create({
                                data: { ...oldCtx, id: newId, phone: newId }
                            });
                        }

                        // 4. Pindahkan Booking
                        await tx.booking.updateMany({
                            where: { customerPhone: oldId },
                            data: { customerPhone: newId }
                        });
                    }
                });
                console.log(`✅ Berhasil memperbaiki ${oldId}`);
            } catch (err) {
                console.error(`❌ Gagal memperbaiki ${oldId}:`, err.message);
            }
        }

        console.log('✨ Selesai!');
    } catch (err) {
        console.error('💥 Fatal error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

repair();
