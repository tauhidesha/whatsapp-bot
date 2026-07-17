require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { generateFollowUpMessage } = require('../src/ai/agents/followUpEngine/messageGenerator.js');
const { STRATEGY_CONFIG } = require('../src/ai/agents/followUpEngine/config.js');

function resolveWhatsappId(customer) {
    if (customer.whatsappLid) return customer.whatsappLid;
    if (customer.phone && customer.phone.includes('@')) return customer.phone;
    return customer.phone ? customer.phone + '@c.us' : null;
}

function isEligible(context, metadata) {
    const label = context.customerLabel;
    const strategy = STRATEGY_CONFIG[label];
    if (!strategy || strategy.action === 'stop') return false;

    const lastFollowUp = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
    const lastMessage = metadata?.lastMessageAt
        ? new Date(metadata.lastMessageAt)
        : (context.updatedAt ? new Date(context.updatedAt) : null);

    if (!lastMessage) return false;

    const now = new Date();

    if (lastFollowUp) {
        const followUpCount = context.followUpCount || 0;
        const interval = followUpCount >= 2
            ? (strategy.secondIntervalDays || strategy.intervalDays)
            : (strategy.intervalDays || strategy.waitDays);
        const daysSinceLastFollowUp = Math.floor((now - lastFollowUp) / (1000 * 60 * 60 * 24));
        if (daysSinceLastFollowUp < interval) return false;
    } else {
        const referenceDate = (label === 'existing_customer' || label === 'loyal_customer')
            ? (context.lastServiceAt ? new Date(context.lastServiceAt) : lastMessage)
            : lastMessage;
        const daysSinceReference = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
        if (daysSinceReference < strategy.waitDays) return false;
    }

    const followUpCount = context.followUpCount || 0;
    if (followUpCount >= strategy.maxFollowUps) return false;

    return true;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay between 7 and 10 minutes (in ms)
function getRandomDelay() {
    const min = 7 * 60 * 1000;
    const max = 10 * 60 * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function triggerPromoNurture() {
    console.log('🚀 Memulai proses pengiriman Nurturing Promo secara sekuensial...');
    
    // 1. Ambil semua konteks
    const contexts = await prisma.customerContext.findMany({
        where: { customerLabel: { not: null } },
        include: {
            customer: true
        }
    });

    const now = new Date();
    const eligibleQueue = [];

    // 2. Evaluasi yang eligible
    for (const context of contexts) {
        const customer = context.customer;
        if (!customer) continue;

        const senderNumber = resolveWhatsappId(customer);
        const metadata = {
            lastMessageAt: customer.lastMessageAt,
            name: customer.name,
            fullSenderId: senderNumber
        };

        // Hindari bentrok dengan logic review/rebooking, filter murni yg eligible utk Nurture reguler
        const isNurtureEligible = isEligible(context, metadata);
        if (!isNurtureEligible) continue;

        // Skip jika harusnya ini review (3-7 hari pasca servis)
        let isReviewEligible = false;
        const lastService = customer.lastService ? new Date(customer.lastService) : null;
        if (lastService && !context.reviewFollowUpSent) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            if (daysSinceService >= 3 && daysSinceService <= 7) isReviewEligible = true;
        }
        if (isReviewEligible) continue;

        // Skip jika harusnya rebooking (sesuai interval tipe servis)
        let isRebookingEligible = false;
        if (lastService && context.lastServiceType) {
            const daysSinceService = Math.floor((now - lastService) / (1000 * 60 * 60 * 24));
            const REBOOKING_INTERVALS = { coating: 180, detailing: 30, repaint: 90 };
            const interval = REBOOKING_INTERVALS[context.lastServiceType];
            if (interval && daysSinceService >= interval && daysSinceService <= interval + 3) {
                const lastFup = context.lastFollowUpAt ? new Date(context.lastFollowUpAt) : null;
                const daysSinceLastFup = lastFup ? Math.floor((now - lastFup) / (1000 * 60 * 60 * 24)) : 999;
                if (daysSinceLastFup > 7) {
                    isRebookingEligible = true;
                }
            }
        }
        if (isRebookingEligible) continue;

        const strategy = { ...STRATEGY_CONFIG[context.customerLabel] };
        
        // Kita timpa anglenya dengan eksklusif promo
        strategy.angle = 'tawarkan promo eksklusif diskon 10% khusus untuk pelanggan yang menerima WA ini. Promo berlaku untuk jasa repaint (booking slot dulu aja bebas kapan).';

        eligibleQueue.push({
            docId: context.id,
            senderNumber,
            name: customer.name || 'Mas',
            context,
            metadata,
            strategy
        });
    }

    console.log(`📊 Ditemukan total ${eligibleQueue.length} pelanggan eligible untuk Promo Nurturing hari ini.`);

    if (eligibleQueue.length === 0) {
        console.log('✅ Tidak ada pelanggan yang eligible untuk nurturing hari ini.');
        process.exit(0);
    }

    // Sort by last message so newest active users are prioritized
    eligibleQueue.sort((a, b) => {
        const dateA = a.metadata?.lastMessageAt ? new Date(a.metadata.lastMessageAt) : new Date(0);
        const dateB = b.metadata?.lastMessageAt ? new Date(b.metadata.lastMessageAt) : new Date(0);
        return dateB - dateA;
    });

    const fetch = (await import('node-fetch')).default;

    // 3. Proses 1 per 1 dengan delay
    for (let i = 0; i < eligibleQueue.length; i++) {
        const item = eligibleQueue[i];
        console.log(`\n[${i+1}/${eligibleQueue.length}] 🤖 Men-generate pesan untuk ${item.name} (${item.senderNumber})...`);

        try {
            // Generate pesan
            const message = await generateFollowUpMessage(
                { name: item.name, context: item.context, metadata: item.metadata, senderNumber: item.senderNumber, docId: item.docId },
                item.strategy,
                { description: 'Promo Eksklusif Diskon Repaint 10% (khusus penerima pesan WA ini)' }
            );

            if (!message) {
                console.log(`  ❌ Gagal generate pesan untuk ${item.senderNumber}. Skip.`);
                continue;
            }

            console.log(`  ✅ Pesan berhasil digenerate: "${message.substring(0, 50)}..."`);
            console.log(`  📤 Mengirim pesan via API /send-message...`);

            // Send via local API
            const PORT = process.env.PORT || 4000;
            const response = await fetch(`http://localhost:${PORT}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.API_SECRET_TOKEN || 'your_secret_token_here'}`
                },
                body: JSON.stringify({
                    number: item.senderNumber,
                    message: message
                })
            });

            if (response.ok) {
                console.log(`  ✅ Pesan terkirim! Mengupdate status di database...`);
                
                // Update context
                await prisma.customerContext.update({
                    where: { id: item.docId },
                    data: {
                        followUpCount: { increment: 1 },
                        lastFollowUpAt: new Date(),
                        lastFollowUpStrategy: 'promo diskon 10% eksklusif'
                    }
                });

            } else {
                const errData = await response.text();
                console.error(`  ❌ API Gagal: ${response.status} - ${errData}`);
            }

        } catch (err) {
            console.error(`  ❌ Error memproses ${item.senderNumber}: ${err.message}`);
        }

        if (i < eligibleQueue.length - 1) {
            const waitTime = getRandomDelay();
            console.log(`⏱️  Jeda sebelum kirim ke pelanggan berikutnya: ${(waitTime/60000).toFixed(1)} menit...`);
            await delay(waitTime);
        }
    }

    console.log('\n🎉 Semua antrean selesai diproses!');
    process.exit(0);
}

triggerPromoNurture().catch(err => {
    console.error('Crash:', err);
    process.exit(1);
});
