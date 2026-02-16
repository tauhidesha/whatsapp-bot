
require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase (copied logic from adminAuth.js)
if (!admin.apps.length) {
    try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (serviceAccountBase64) {
            const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            // Fallback to local key if base64 not present
            const serviceAccount = require('./serviceAccountKey.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } catch (e) {
        console.error('Firebase init error:', e);
        process.exit(1);
    }
}

const db = admin.firestore();

async function createSimulatedData() {
    console.log('Creating simulated follow-up candidates...');

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const fourMonthsAgo = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

    const testCases = [
        {
            id: '628111111111@c.us',
            data: {
                senderNumber: '628111111111',
                name: 'Test Cold Lead',
                customerLabel: 'cold_lead',
                labelUpdatedAt: admin.firestore.Timestamp.fromDate(twoDaysAgo),
                updatedAt: admin.firestore.Timestamp.fromDate(twoDaysAgo),
                lastMessage: 'Harga berapa gan?',
                lastMessageAt: admin.firestore.Timestamp.fromDate(twoDaysAgo)
            }
        },
        {
            id: '628222222222@c.us',
            data: {
                senderNumber: '628222222222',
                name: 'Test Follow Up',
                customerLabel: 'follow_up',
                labelUpdatedAt: admin.firestore.Timestamp.fromDate(twoDaysAgo),
                updatedAt: admin.firestore.Timestamp.fromDate(twoDaysAgo),
                lastMessage: 'Nanti saya kabari ya',
                lastMessageAt: admin.firestore.Timestamp.fromDate(twoDaysAgo)
            }
        },
        {
            id: '628333333333@c.us',
            data: {
                senderNumber: '628333333333',
                name: 'Test Loyal Customer',
                customerLabel: 'completed',
                labelUpdatedAt: admin.firestore.Timestamp.fromDate(fourMonthsAgo),
                updatedAt: admin.firestore.Timestamp.fromDate(fourMonthsAgo),
                lastMessage: 'Terima kasih, motor sudah diambil',
                lastMessageAt: admin.firestore.Timestamp.fromDate(fourMonthsAgo)
            }
        }
    ];

    const batch = db.batch();

    testCases.forEach(tc => {
        const docRef = db.collection('directMessages').doc(tc.id);
        batch.set(docRef, tc.data, { merge: true });
        console.log(`Queued update for ${tc.data.name} (${tc.data.customerLabel})`);
    });

    await batch.commit();
    console.log('Simulated data created successfully.');
}

createSimulatedData().catch(console.error);
