#!/usr/bin/env node
/**
 * Script ini mensinkronisasi label dari customerContext ke directMessages
 * untuk memastikan semua chat di dashboard memiliki label terbaru dari AI.
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    }
    if (admin.apps.length === 0) admin.initializeApp();
}

const db = admin.firestore();
const { syncLabelToDirectMessages } = require('../src/ai/utils/mergeCustomerContext.js');

async function syncAllLabels() {
    console.log('🔄 Memulai sinkronisasi label dari customerContext ke directMessages...');
    
    const contextSnap = await db.collection('customerContext').get();
    console.log(`📋 Ditemukan ${contextSnap.size} data konteks pelanggan.`);

    let success = 0;
    let skipped = 0;

    for (const doc of contextSnap.docs) {
        const data = doc.data();
        const aiLabel = data.customer_label;
        const senderNumber = data.senderNumber || doc.id; // doc.id is usually digits only

        if (aiLabel) {
            await syncLabelToDirectMessages(senderNumber, aiLabel);
            success++;
            if (success % 10 === 0) console.log(`   ✅ Diproses: ${success}...`);
        } else {
            skipped++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Sinkronisasi Selesai!`);
    console.log(`   Berhasil: ${success}`);
    console.log(`   Dilewati (tanpa label): ${skipped}`);
}

syncAllLabels()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Fatal error:', err);
        process.exit(1);
    });
