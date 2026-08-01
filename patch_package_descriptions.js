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
        summary: '(Clear HS + Flowcoat + Poles)',
        description: `Paket paling top. Clear Flowcoat (lapisan paling tebal & keras) + poles, hasilnya beneran beda.

Spesifikasi:
- Clear: Flowcoat (di-clear 2x — lapisan paling tebal yang ada)
- Finishing: Dipoles setelah curing → wet look, keliatan "basah" dan dalam
- Warna terasa punya depth — bukan cuma kinclong biasa, tapi ada efek "dalem"
- Garansi 2 Tahun

Cocok untuk: Kolektor, motor kontes, atau yang pengen tampilan paling wah.
Estimasi pengerjaan: 3–4 hari kerja tergantung kondisi dan antrian.
Harga bervariasi per model motor.`
    },

    'Repaint Bodi Halus - Paket Standar': {
        summary: '(Clear HS + Poles)',
        description: `Sweet spot antara kualitas dan harga. Clear HS + poles — hasilnya mengkilap tajam dan tahan.

Spesifikasi:
- Clear: HS (Hard Strength — lebih keras dan tahan gores dari MS)
- Finishing: Dipoles setelah curing → mirror finish, mengkilap kayak cermin
- Lebih tahan baret dibanding cat standar pabrik
- Garansi 1 Tahun

Cocok untuk: Motor harian yang mau tetap kece, atau yang suka ngumpul bareng teman.
Estimasi pengerjaan: 3–4 hari kerja tergantung kondisi dan antrian.
Harga bervariasi per model motor.`
    },

    'Repaint Bodi Halus - Paket Basic': {
        summary: '(Clear HS)',
        description: `Satu level di atas Ekonomis. Pakai Clear HS tapi tanpa poles — hasilnya sudah lebih kinclong dari cat pabrik.

Spesifikasi:
- Clear: HS (Hard Strength — lebih keras dari MS, lebih tahan gores)
- Finishing: Tanpa poles — hasilnya rapi dan glossy, ada efek kulit jeruk ringan seperti cat pabrikan
- Lebih tahan dibanding paket Ekonomis
- Garansi 6 Bulan

Cocok untuk: Daily premium, yang mau upgrade dari cat standar tapi jaga budget.
Estimasi pengerjaan: 3–4 hari kerja tergantung kondisi dan antrian.
Harga bervariasi per model motor.`
    },

    'Repaint Bodi Halus - Paket Ekonomis': {
        summary: '(Glossy Clear MS / Doff)',
        description: `Paket paling basic. Pakai Clear MS — cukup untuk yang prioritaskan budget atau sering ganti warna.

Spesifikasi:
- Clear: MS (Medium Strength — standar dasar, lebih tipis dari HS)
- Finishing: Rapi dan bersih, efek kulit jeruk ringan seperti cat bawaan pabrik
- Tanpa poles
- Tanpa Garansi

Cocok untuk: Pelajar, motor harian, yang sering ganti warna, atau budget terbatas.
Estimasi pengerjaan: 3–4 hari kerja tergantung kondisi dan antrian.
Harga bervariasi per model motor.`
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
