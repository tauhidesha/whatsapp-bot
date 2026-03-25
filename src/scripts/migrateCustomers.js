require('dotenv').config();
const admin = require('firebase-admin');
const { normalizePhone } = require('../server/firestoreTriggers.js');

// Initialize Firebase
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    }
}

const db = admin.firestore();

async function migrate() {
    console.log('🚀 Starting CRM Data Migration (Unified Customers Collection)...');
    
    // Map to hold aggregated customer data
    // Key: standardized phone (62...) -> Value: Customer Object
    const customersMap = new Map();

    function getCustomer(rawPhone, fallbackName = null, realPhoneFallback = null) {
        let phone = normalizePhone(rawPhone);
        if (!phone && realPhoneFallback) {
            phone = normalizePhone(realPhoneFallback);
        }
        // If it's a raw WPPConnect lid that couldn't be normalized to number
        if (!phone) {
            phone = rawPhone; // Keep as lid if unavoidable
        }
        
        if (!customersMap.has(phone)) {
            customersMap.set(phone, {
                id: phone,
                name: fallbackName || `Customer ${phone.slice(-4)}`,
                phone: phone,
                realPhone: phone.includes('@lid') ? '' : phone,
                totalSpending: 0,
                lastService: null,
                lastMessageAt: null,
                status: 'new', // new, active, churned
                bikes: []
            });
        }
        return customersMap.get(phone);
    }

    // 1. Process all Direct Messages (Base CRM Leads)
    console.log('📥 Fetching direct messages...');
    const dmSnapshot = await db.collection('directMessages').get();
    dmSnapshot.forEach(doc => {
        const data = doc.data();
        const customer = getCustomer(doc.id, data.name, data.realPhone || data.fullSenderId);
        
        if (data.name) customer.name = data.name;
        if (data.lastMessageAt) customer.lastMessageAt = data.lastMessageAt;
        if (data.realPhone) customer.realPhone = data.realPhone;
        
        const context = data.context || {};
        if (context.motor_model && !customer.bikes.includes(context.motor_model)) {
            customer.bikes.push(context.motor_model);
        }
    });

    // 2. Process all Bookings
    console.log('📥 Fetching bookings...');
    const bookingSnapshot = await db.collection('bookings').get();
    bookingSnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.customerPhone) return;

        const customer = getCustomer(data.customerPhone, data.customerName || data.invoiceName);
        if (data.customerName && customer.name.startsWith('Customer ')) {
            customer.name = data.customerName; // Prefer booking name
        }

        const isCompleted = ['COMPLETED', 'SELESAI'].includes((data.status || '').toUpperCase());
        const bkDate = data.bookingDateTime ? data.bookingDateTime.toDate() : null;

        if (isCompleted && bkDate) {
            if (!customer.lastService || bkDate > customer.lastService.toDate()) {
                customer.lastService = data.bookingDateTime;
            }
        }

        if (data.vehicleInfo && !customer.bikes.includes(data.vehicleInfo)) {
            customer.bikes.push(data.vehicleInfo);
        }
    });

    // 3. Process all Transactions
    console.log('📥 Fetching transactions...');
    const txSnapshot = await db.collection('transactions').get();
    txSnapshot.forEach(doc => {
        const data = doc.data();
        const rawPhone = data.customerNumber || data.customerId;
        if (!rawPhone) return;

        const customer = getCustomer(rawPhone, data.customerName);
        if (data.customerName && customer.name.startsWith('Customer ')) {
            customer.name = data.customerName; // Prefer tx name
        }

        const isPaid = ['PAID', 'LUNAS', 'INCOME'].includes((data.status || 'PAID').toUpperCase()) || data.type === 'income';
        if (isPaid && data.amount) {
            customer.totalSpending += Number(data.amount);
        }
    });

    // 4. Calculate final status and upload to unified collection
    console.log(`📤 Writing ${customersMap.size} unified customers to Firestore...`);
    const batch = db.batch();
    let batchCount = 0;
    
    const now = new Date();

    for (const [phone, data] of customersMap.entries()) {
        const ref = db.collection('customers').doc(phone);
        
        // Finalize Status
        let status = 'new'; // default lead
        const spending = data.totalSpending;
        const lastSrv = data.lastService ? data.lastService.toDate() : null;
        
        if (spending === 0 && !lastSrv) {
            status = 'new'; 
        } else if (lastSrv) {
            const monthsAgo = (now.getTime() - lastSrv.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsAgo <= 6) {
                status = 'active';
            } else {
                status = 'churned';
            }
        } else if (spending > 0) {
            status = 'active';
        }

        data.status = status;
        data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        batch.set(ref, data, { merge: true });
        batchCount++;

        if (batchCount === 500) {
            await batch.commit();
            console.log('...committed a batch of 500');
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`...committed final batch of ${batchCount}`);
    }

    console.log('✅ Migration complete! Unified CRM collection "customers" is now populated.');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
