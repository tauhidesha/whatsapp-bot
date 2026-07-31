/**
 * patch_package_descriptions.js
 * 
 * Update deskripsi paket Repaint Bodi Halus jadi bahasa yang lebih manusiawi,
 * mudah dimengerti customer awam (tidak ada istilah teknis).
 * 
 * Jalankan di server: node patch_package_descriptions.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const descriptions = {
    'Repaint Bodi Halus - Paket Premium': {
        summary: 'Hasil tebel, basah, dan dalam — seperti motor baru keluar pabrik premium.',
        description: `Paket paling top di studio ini. Cocok kalau kamu mau hasil yang beneran beda dari biasanya.

Kenapa beda?
- Catnya dilapis lebih banyak, jadi warnanya keliatan *dalam* dan bersinar — bukan cuma mengkilap biasa
- Hasilnya kayak "basah" alias wet look — keliatan glossy tebal, bukan tipis
- Tahan lama banget dan nggak gampang pudar

Cocok untuk: Kolektor motor, motor yang mau dikonteskan, atau yang pengen tampilan paling wah
Garansi: 2 tahun
Estimasi pengerjaan: 3–4 hari kerja`
    },

    'Repaint Bodi Halus - Paket Standar': {
        summary: 'Hasil mirror, tahan baret — pilihan paling worth it.',
        description: `Paket favorit customer di sini — dan memang worth it banget.

Kenapa banyak yang pilih ini?
- Hasilnya mengkilap kayak cermin (mirror finish) — beneran kinclong
- Lapisannya keras, jadi lebih tahan dari baret-baret kecil sehari-hari
- Setelah cat kering, dipoles lagi supaya hasilnya makin sempurna
- Garansi 1 tahun — tenang kalau ada apa-apa

Cocok untuk: Motor harian yang mau tampilannya tetap kece, atau motor yang suka diajak ngumpul
Garansi: 1 tahun
Estimasi pengerjaan: 3–4 hari kerja`
    },

    'Repaint Bodi Halus - Paket Basic': {
        summary: 'Lebih kinclong dari cat pabrik, harga lebih terjangkau.',
        description: `Satu level di atas paket Ekonomis — hasilnya sudah lumayan kinclong dan lebih tahan.

Apa yang didapat?
- Lebih mengkilap dibanding cat standar pabrik
- Lapisannya sudah pakai clear yang lebih keras dari paket Ekonomis
- Cocok kalau mau upgrade tampilan tapi tetap jaga budget

Cocok untuk: Motor harian, yang mau ganti warna tapi nggak perlu hasil maksimal
Garansi: 1 tahun
Estimasi pengerjaan: 3–4 hari kerja`
    },

    'Repaint Bodi Halus - Paket Ekonomis': {
        summary: 'Pilihan paling hemat — warna solid, rapi, dan bersih.',
        description: `Paket paling basic — cocok kalau yang penting ganti warna dulu dengan budget terbatas.

Yang didapat:
- Cat baru yang rapi dan bersih
- Warna solid — nggak ada efek khusus, tapi hasilnya tetap lumayan
- Cocok banget buat motor harian atau yang sering ganti warna

Perlu tahu:
- Tidak ada garansi untuk paket ini
- Finishing-nya mirip cat bawaan pabrik — nggak terlalu glossy tapi tetap rapi

Cocok untuk: Pelajar, motor harian, yang sering ganti warna atau budget terbatas
Garansi: Tidak ada
Estimasi pengerjaan: 3–4 hari kerja`
    }
};

async function main() {
    console.log('Updating package descriptions...\n');
    
    for (const [name, data] of Object.entries(descriptions)) {
        const result = await prisma.service.updateMany({
            where: { name },
            data: {
                summary: data.summary,
                description: data.description
            }
        });
        
        if (result.count > 0) {
            console.log(`✅ Updated: ${name}`);
        } else {
            console.log(`⚠️  Not found: ${name}`);
        }
    }
    
    console.log('\nDone! Verify with: node get_descriptions.js');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
