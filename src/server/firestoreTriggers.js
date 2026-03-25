const admin = require('firebase-admin');

// Ensure Firebase is initialized
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
        } else {
            admin.initializeApp();
        }
    }
}

const db = admin.firestore();

/**
 * Normalizes phone numbers to a standard format starting with 62
 */
function normalizePhone(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, ''); // Remove all non-numeric characters
    
    // Strip common country codes to standardize
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    } else if (clean.startsWith('62')) {
        // Already starts with 62, do nothing
    } else if (clean.length > 8 && !clean.startsWith('62')) {
        // Assuming it's an Indonesian number without the prefix + or 0
        clean = '62' + clean;
    }
    
    return clean;
}

/**
 * Upsert customer data to unified collection
 */
async function syncCustomerData(customerId, updates) {
    if (!customerId) return;
    try {
        const customerRef = db.collection('customers').doc(customerId);
        await customerRef.set({
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Keep status logic evaluated later or here
    } catch (error) {
        console.error(`[CustomerSync] Error updating ${customerId}:`, error);
    }
}

/**
 * Listeners to automatically update customers collection
 * Runs continuously alongside app.js
 */
function startFirestoreTriggers() {
    console.log('🔄 [Triggers] Starting Firestore observers for unified customers collection...');

    // 1. Listen to Transactions
    db.collection('transactions').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                
                // Only act on PAID or LUNAS transactions
                const isPaid = ['PAID', 'LUNAS', 'INCOME'].includes((data.status || 'PAID').toUpperCase()) || data.type === 'income';
                
                if (isPaid && data.amount > 0) {
                    const rawPhone = data.customerNumber || data.customerId;
                    if (!rawPhone) return;
                    
                    const customerId = normalizePhone(rawPhone);
                    if (!customerId) return;

                    // Compute total spending (We must query all paid transactions to be accurate, 
                    // or just query once and let a Cloud Function do it. Since this is an observer, 
                    // we'll run a quick aggregation query)
                    try {
                        const txSnapshot = await db.collection('transactions')
                            .where('customerId', 'in', [customerId, `${customerId}@c.us`, rawPhone])
                            .get();
                        
                        let totalSpending = 0;
                        txSnapshot.forEach(txDoc => {
                            const tx = txDoc.data();
                            const txIsPaid = ['PAID', 'LUNAS', 'INCOME'].includes((tx.status || 'PAID').toUpperCase()) || tx.type === 'income';
                            if (txIsPaid && tx.amount) {
                                totalSpending += Number(tx.amount);
                            }
                        });

                        await syncCustomerData(customerId, {
                            totalSpending,
                            name: data.customerName || undefined
                        });
                        console.log(`[Triggers] Updated totalSpending for ${customerId} -> ${totalSpending}`);
                    } catch (err) {
                        console.error(`[Triggers] Error calculating spending for ${customerId}:`, err);
                    }
                }
            }
        });
    });

    // 2. Listen to Bookings
    db.collection('bookings').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                
                // Only act on COMPLETED or SELESAI bookings
                const isCompleted = ['COMPLETED', 'SELESAI'].includes((data.status || '').toUpperCase());
                
                if (isCompleted) {
                    const rawPhone = data.customerPhone;
                    if (!rawPhone) return;
                    
                    const customerId = normalizePhone(rawPhone);
                    if (!customerId) return;

                    try {
                        // Find latest booking date
                        const bkSnapshot = await db.collection('bookings')
                            .where('customerPhone', 'in', [rawPhone, customerId, `${customerId}@c.us`])
                            .orderBy('bookingDateTime', 'desc')
                            .limit(10)
                            .get();
                        
                        let lastService = null;
                        bkSnapshot.forEach(bkDoc => {
                            const bk = bkDoc.data();
                            const bkIsCompleted = ['COMPLETED', 'SELESAI'].includes((bk.status || '').toUpperCase());
                            const bkDate = bk.bookingDateTime ? bk.bookingDateTime.toDate() : null;
                            if (bkIsCompleted && bkDate) {
                                if (!lastService || bkDate > lastService) {
                                    lastService = bkDate;
                                }
                            }
                        });

                        if (lastService) {
                            await syncCustomerData(customerId, {
                                lastService: admin.firestore.Timestamp.fromDate(lastService),
                                name: data.customerName || undefined
                            });
                            console.log(`[Triggers] Updated lastService for ${customerId} -> ${lastService.toISOString()}`);
                        }
                    } catch (err) {
                        console.error(`[Triggers] Error calculating lastService for ${customerId}:`, err);
                    }
                }
            }
        });
    });

    // 3. Status Recalculator (Runs periodically or triggered by above updates)
    // We will attach a listener on the customers collection itself to auto-update status
    db.collection('customers').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data();
                const spending = Number(data.totalSpending) || 0;
                const lastSrv = data.lastService ? data.lastService.toDate() : null;
                
                let newStatus = 'new';
                const now = new Date();
                
                if (spending === 0 && !lastSrv) {
                    newStatus = 'new'; // Lead
                } else if (lastSrv) {
                    const monthsAgo = (now.getTime() - lastSrv.getTime()) / (1000 * 60 * 60 * 24 * 30);
                    if (monthsAgo <= 6) {
                        newStatus = 'active';
                    } else {
                        newStatus = 'churned';
                    }
                } else if (spending > 0) {
                    // Has spending but no completed booking date (maybe manual tx)
                    // If no lastMessageAt or lastService to base on, assume active for now
                    newStatus = 'active';
                }

                if (data.status !== newStatus) {
                    try {
                        await change.doc.ref.update({ status: newStatus });
                        console.log(`[Triggers] Status changed to ${newStatus} for customer ${change.doc.id}`);
                    } catch (e) {
                        // ignore recursive update loop errors if any
                    }
                }
            }
        });
    });
}

module.exports = {
    startFirestoreTriggers,
    normalizePhone,
    syncCustomerData
};
