require('dotenv').config();
const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');

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
const prisma = new PrismaClient();

function normalizePhone(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    else if (clean.length > 8 && !clean.startsWith('62')) clean = '62' + clean;
    return clean;
}

async function migrate() {
    console.log('🚀 Starting ETL: Firestore to Supabase SQL (Big Bang)...');
    
    // 1. Fetch unified customers from Firestore (created previously via migrateCustomers.js)
    console.log('📥 1. Loading active Customers...');
    const custSnapshot = await db.collection('customers').get();
    
    let custCount = 0;
    for (const doc of custSnapshot.docs) {
        const data = doc.data();
        const phone = doc.id;
        if (!phone) continue;

        const customer = await prisma.customer.upsert({
            where: { phone: phone },
            update: {
                name: data.name || null,
                totalSpending: Number(data.totalSpending) || 0,
                lastService: data.lastService ? data.lastService.toDate() : null,
                status: data.status || 'new'
            },
            create: {
                phone: phone,
                name: data.name || null,
                totalSpending: Number(data.totalSpending) || 0,
                lastService: data.lastService ? data.lastService.toDate() : null,
                status: data.status || 'new',
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            }
        });

        // Vehicles Migration
        if (data.bikes && Array.isArray(data.bikes)) {
            for (const bike of data.bikes) {
                if (typeof bike === 'string' && bike.trim().length > 0) {
                    await prisma.vehicle.create({
                        data: {
                            customerId: customer.id,
                            modelName: bike.trim()
                        }
                    });
                }
            }
        }
        custCount++;
    }
    console.log(`✅ Loaded & mapped ${custCount} Customers & Vehicles.`);

    // 2. Load Bookings
    console.log('📥 2. Migrating Bookings...');
    const bkSnapshot = await db.collection('bookings').get();
    let bkCount = 0;
    for (const doc of bkSnapshot.docs) {
        const data = doc.data();
        const rawPhone = data.customerPhone;
        const normalized = normalizePhone(rawPhone);
        if (!normalized) continue;

        const customer = await prisma.customer.findUnique({ where: { phone: normalized }});
        if (!customer) continue;

        // Try to match vehicle based on vehicleInfo
        let vehicleId = null;
        if (data.vehicleInfo) {
            const vehicle = await prisma.vehicle.findFirst({
                where: { customerId: customer.id, modelName: data.vehicleInfo.trim() }
            });
            if (vehicle) vehicleId = vehicle.id;
            else {
                // Creates missing vehicle from booking
                const newV = await prisma.vehicle.create({
                    data: { customerId: customer.id, modelName: data.vehicleInfo.trim() }
                });
                vehicleId = newV.id;
            }
        }

        await prisma.booking.create({
            data: {
                id: doc.id,
                customerId: customer.id,
                vehicleId: vehicleId,
                bookingDate: data.bookingDateTime ? data.bookingDateTime.toDate() : new Date(),
                status: data.status || 'PENDING',
                serviceType: typeof data.services === 'string' ? data.services : 'Servis Umum',
                adminNotes: data.adminNotes || null,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            }
        });
        bkCount++;
    }
    console.log(`✅ Migrated ${bkCount} Bookings.`);

    // 3. Load Transactions
    console.log('📥 3. Migrating Transactions...');
    const txSnapshot = await db.collection('transactions').get();
    let txCount = 0;
    for (const doc of txSnapshot.docs) {
        const data = doc.data();
        const rawPhone = data.customerNumber || data.customerId;
        const normalized = normalizePhone(rawPhone);
        if (!normalized) continue;

        const customer = await prisma.customer.findUnique({ where: { phone: normalized }});
        if (!customer) continue;

        let bookingId = data.bookingId;
        // Verify booking exists
        if (bookingId) {
            const bExists = await prisma.booking.findUnique({ where: { id: bookingId }});
            if (!bExists) bookingId = null;
        }

        await prisma.transaction.create({
            data: {
                id: doc.id,
                customerId: customer.id,
                bookingId: bookingId,
                amount: Number(data.amount) || 0,
                type: data.type || 'income',
                status: data.status || 'UNPAID',
                description: data.description || null,
                paymentMode: data.paymentMode || null,
                createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
            }
        });
        txCount++;
    }
    console.log(`✅ Migrated ${txCount} Transactions.`);

    console.log('🎉 Supabase Big Bang ETL complete!');
}

migrate().catch(e => {
    console.error('Migration failed:', e);
}).finally(() => {
    prisma.$disconnect();
});
