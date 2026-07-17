require('dotenv').config();
const { _buildDryRunQueue } = require('../src/ai/agents/followUpEngine/scheduler.js');
const { generateFollowUpMessage } = require('../src/ai/agents/followUpEngine/messageGenerator.js');

async function triggerPromoNurture() {
    console.log('🚀 Memulai proses pengambilan antrean Nurturing...');
    
    // 1. Ambil antrean eligible saat ini
    const queue = await _buildDryRunQueue(new Date());
    console.log(`📊 Ditemukan total ${queue.length} pelanggan eligible untuk hari ini.`);

    // 2. Filter hanya yang bertipe nurturing (bukan review/rebooking)
    const nurturingQueue = queue.filter(item => item.type === 'nurturing');
    console.log(`🎯 Dari total tersebut, ada ${nurturingQueue.length} pelanggan eligible untuk Nurturing.`);

    if (nurturingQueue.length === 0) {
        console.log('✅ Tidak ada pelanggan yang eligible untuk nurturing hari ini.');
        process.exit(0);
    }

    const approvedItems = [];
    console.log('🤖 Mulai men-generate pesan promo diskon 10% dengan AI...');

    for (const item of nurturingQueue) {
        try {
            // Paksa angle menjadi promo diskon 10%
            item.strategy.angle = 'tawarkan promo diskon 10% untuk transaksi hari ini';

            // Override promoData null karena kita sudah set spesifik di angle
            const message = await generateFollowUpMessage(
                item.queueItem,
                item.strategy,
                { description: 'Promo Spesial Diskon 10% hari ini!' } // promoData
            );

            if (message) {
                approvedItems.push({
                    docId: item.docId,
                    senderNumber: item.senderNumber,
                    type: item.type,
                    message: message,
                    approved: true
                });
                console.log(`✅ [Berhasil] ${item.senderNumber}: ${message.substring(0, 50)}...`);
            }
        } catch (err) {
            console.error(`❌ [Gagal] ${item.senderNumber}: ${err.message}`);
        }
    }

    if (approvedItems.length === 0) {
        console.log('❌ Gagal men-generate pesan untuk semua pelanggan.');
        process.exit(1);
    }

    console.log(`\n📤 Mengirim ${approvedItems.length} pesan ke antrean eksekutor (delay acak dari backend)...`);

    // 3. Kirim ke API eksekutor
    const delayMs = 300000; // 5 menit rata-rata per pesan
    
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('http://localhost:3000/follow-up-queue/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_SECRET_TOKEN || 'your_secret_token_here'}`
            },
            body: JSON.stringify({
                items: approvedItems,
                delayMs: delayMs
            })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            console.log(`✅ Antrean berhasil dikirim! API response:`, data);
        } else {
            console.error(`❌ Gagal mengirim antrean ke API:`, data);
        }
    } catch (apiErr) {
        console.error(`❌ Tidak dapat terhubung ke API lokal. Pastikan server (app.js) sedang berjalan. Error:`, apiErr.message);
    }

    process.exit(0);
}

triggerPromoNurture().catch(err => {
    console.error('Crash:', err);
    process.exit(1);
});
