/**
 * fresh-import-firestore.js
 * 
 * Import ulang Customer, CustomerContext, DirectMessage dari Firestore
 * dengan phone number suffix detection dan dedup
 * 
 * Phone Detection Rules:
 * - Start "62" + length 10-14 →印尼 phone (tambah @c.us saat send)
 * - Start BUKAN "62" + length ≥ 10 → LID (tambah @lid)
 * - Already has suffix → as-is
 * - Duplicate (plain + @lid) → merge, pakai @lid sebagai primary
 * 
 * Usage: node src/scripts/fresh-import-firestore.js
 */

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

// ============================================
// PHONE DETECTION UTILITIES
// ============================================

function detectAndSuffix(rawPhone) {
    if (!rawPhone) return null;
    let str = String(rawPhone).trim();

    // 1. If already has suffix, keep it
    if (str.endsWith('@lid')) {
        const numeric = str.replace('@lid', '').replace(/\D/g, '');
        return { phone: str, whatsappLid: str, suffix: '@lid' };
    }
    if (str.endsWith('@c.us')) {
        const numeric = str.replace('@c.us', '').replace(/\D/g, '');
        return { phone: str, whatsappLid: null, suffix: '@c.us' };
    }

    // 2. Clear to digits only for suffixing logic
    let clean = str.replace(/\D/g, '');
    if (!clean) return null;

    // Handle initial zero (convert to 62)
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);

    // 3. Logic based on user instructions:
    // Indonesian phone: start 62 + length 10-15
    if (clean.startsWith('62') && clean.length >= 10 && clean.length <= 15) {
        return { 
            phone: `${clean}@c.us`, 
            whatsappLid: null, 
            suffix: '@c.us' 
        };
    }

    // Default to LID (@lid) for others (including non-standard lengths)
    return { 
        phone: `${clean}@lid`, 
        whatsappLid: `${clean}@lid`, 
        suffix: '@lid' 
    };
}


// ============================================
// PROFILE PIC URL UTILITIES
// ============================================

function extractProfilePicUrl(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
        return raw.eurl || raw.img || raw.imgFull || null;
    }
    return null;
}

// ============================================
// DEDUP MAP: numeric → { whatsappLid, plainDocIds[] }
// ============================================

const customerDedupMap = new Map();

function addToDedup(docId, data) {
    const detected = detectAndSuffix(docId);
    if (!detected) return null;

    const numeric = detected.phone;

    if (!customerDedupMap.has(numeric)) {
        customerDedupMap.set(numeric, {
            numeric,
            whatsappLid: detected.whatsappLid, // null or @lid string
            plainDocIds: [],
            lidDocIds: [],
            bestName: data.name || null,
            bestData: data,
            source: docId
        });
    }

    const entry = customerDedupMap.get(numeric);

    // Track which format we saw
    if (detected.suffix === '@lid') {
        entry.lidDocIds.push(docId);
        entry.whatsappLid = detected.whatsappLid; // Use detected.whatsappLid which is already correct
    } else {
        entry.plainDocIds.push(docId);
    }


    // Merge best data (prefer entry with more fields)
    if (data.name && (!entry.bestName || data.name.length > entry.bestName.length)) {
        entry.bestName = data.name;
        entry.bestData = data;
    }
    if (data.totalSpending && data.totalSpending > (entry.bestData.totalSpending || 0)) {
        entry.bestData.totalSpending = data.totalSpending;
    }
    if (data.lastService) {
        const existingLast = entry.bestData.lastService?.toDate?.() || null;
        const newLast = data.lastService?.toDate?.() || null;
        if (!existingLast || (newLast && newLast > existingLast)) {
            entry.bestData.lastService = data.lastService;
        }
    }

    return entry;
}

// ============================================
// PHASE A: IMPORT CUSTOMERS
// ============================================

async function importCustomers() {
    console.log('\n📥 Phase A: Importing Customers from Firestore...\n');

    // Build dedup map from directMessages collection
    const dmSnapshot = await db.collection('directMessages').get();
    console.log(`   Firestore 'directMessages' collection: ${dmSnapshot.docs.length} docs (for customer discovery)`);

    for (const doc of dmSnapshot.docs) {
        const data = doc.data();
        addToDedup(doc.id, data);
    }

    // Also check customerContext collection
    const ctxSnapshot = await db.collection('customerContext').get();
    console.log(`   Firestore 'customerContext' collection: ${ctxSnapshot.docs.length} docs (for customer discovery)`);

    for (const doc of ctxSnapshot.docs) {
        const data = doc.data();
        addToDedup(doc.id, data);
    }

    console.log(`\n   Total unique customers detected: ${customerDedupMap.size}`);

    // Count dedup merges
    let mergeCount = 0;
    let lidCount = 0;
    let phoneCount = 0;

    for (const [numeric, entry] of customerDedupMap) {
        if (entry.lidDocIds.length > 0 && entry.plainDocIds.length > 0) {
            mergeCount++;
        }
        if (entry.whatsappLid) lidCount++;
        else phoneCount++;
    }

    console.log(`   Merged duplicates: ${mergeCount}`);
    console.log(`   Phone with @lid: ${lidCount}`);
    console.log(`   Phone normal (@c.us): ${phoneCount}\n`);

    // Import to Prisma
    let created = 0;
    let skipped = 0;

    for (const [numeric, entry] of customerDedupMap) {
        try {
            const data = entry.bestData;
            const lastServiceDate = data.lastService?.toDate?.() || null;

            // Calculate status
            let status = data.status || 'new';
            if (data.totalSpending > 0 || lastServiceDate) {
                status = 'active';
                if (lastServiceDate) {
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                    if (lastServiceDate < sixMonthsAgo) {
                        status = 'churned';
                    }
                }
            }

            // Upsert customer
            const customer = await prisma.customer.upsert({
                where: { phone: numeric },
                update: {
                    name: entry.bestName || null,
                    totalSpending: Number(data.totalSpending) || 0,
                    lastService: lastServiceDate,
                    status: status,
                    whatsappLid: entry.whatsappLid,
                    updatedAt: new Date()
                },
                create: {
                    phone: numeric,
                    whatsappLid: entry.whatsappLid,
                    phoneReal: data.realPhone || data.phoneReal || null,
                    name: entry.bestName || null,
                    totalSpending: Number(data.totalSpending) || 0,
                    lastService: lastServiceDate,
                    status: status,
                    notes: data.notes || null,
                    profilePicUrl: extractProfilePicUrl(data.profilePicUrl),
                    aiPaused: data.aiPaused || false,
                    aiPauseReason: data.aiPauseReason || null,
                    aiPausedUntil: data.aiPausedUntil?.toDate?.() || null
                }

            });



            // Import vehicles from bikes[]
            if (data.bikes && Array.isArray(data.bikes)) {
                for (const bike of data.bikes) {
                    if (typeof bike === 'string' && bike.trim().length > 0) {
                        try {
                            await prisma.vehicle.create({
                                data: {
                                    customerId: customer.id,
                                    modelName: bike.trim()
                                }
                            });
                        } catch (e) {
                            // Ignore duplicate vehicle
                            if (!e.message.includes('Unique constraint')) {
                                console.log(`   ⚠️ Vehicle error for ${numeric}: ${e.message}`);
                            }
                        }
                    }
                }
            }

            created++;
            if (created % 50 === 0) {
                process.stdout.write(`   📦 ${created} customers imported...\n`);
            }
        } catch (e) {
            console.error(`   ❌ Error for ${numeric}: ${e.message}`);
            skipped++;
        }
    }

    console.log(`\n   ✅ Phase A complete: ${created} customers created, ${skipped} skipped`);
    return { created, skipped, lidCount, phoneCount, mergeCount };
}

// ============================================
// PHASE B: IMPORT CUSTOMER CONTEXT
// ============================================

async function importCustomerContext() {
    console.log('\n📥 Phase B: Importing CustomerContext from Firestore...\n');

    const ctxSnapshot = await db.collection('customerContext').get();
    let imported = 0;
    let skipped = 0;

    for (const doc of ctxSnapshot.docs) {
        try {
            const data = doc.data();
            const detected = detectAndSuffix(doc.id);
            if (!detected) { skipped++; continue; }

            // Check if customer exists
            const customer = await prisma.customer.findUnique({
                where: { phone: detected.phone }
            });

            if (!customer) {
                skipped++;
                continue;
            }

            // Upsert CustomerContext
            await prisma.customerContext.upsert({
                where: { phone: detected.phone },
                update: {
                    motorModel: data.motor_model || data.motorModel ? String(data.motor_model || data.motorModel) : null,
                    motorPlate: data.motor_plate || data.motorPlate ? String(data.motor_plate || data.motorPlate) : null,
                    motorYear: data.motor_year || data.motorYear ? String(data.motor_year || data.motorYear) : null,
                    motorColor: data.motor_color || data.motorColor ? String(data.motor_color || data.motorColor) : null,
                    targetServices: data.target_services || data.targetServices || [],
                    // ... (keep others)
                    budgetSignal: data.budget_signal || data.budgetSignal || null,
                    detectedIntents: data.detected_intents || data.detectedIntents || [],
                    conversationStage: data.conversation_stage || data.conversationStage || null,
                    lastAiAction: data.last_ai_action || data.lastAiAction || null,
                    customerLabel: data.customer_label || data.customerLabel || null,
                    labelConfidence: data.label_confidence || data.labelConfidence || null,
                    labelReason: data.label_reason || data.labelReason || null,
                    followUpStrategy: data.followup_strategy || data.followUpStrategy || null,
                    ghostedTimes: data.ghosted_times || data.ghostedTimes || null,
                    followUpConverted: data.followup_converted || data.followUpConverted || false,
                    lastFollowUpAt: data.last_followup_at?.toDate?.() || null,
                    conversationSummary: data.conversation_summary || data.conversationSummary || null,
                    updatedAt: new Date()
                },
                create: {
                    id: detected.phone,
                    phone: detected.phone,
                    motorModel: data.motor_model || data.motorModel ? String(data.motor_model || data.motorModel) : null,
                    motorPlate: data.motor_plate || data.motorPlate ? String(data.motor_plate || data.motorPlate) : null,
                    motorYear: data.motor_year || data.motorYear ? String(data.motor_year || data.motorYear) : null,
                    motorColor: data.motor_color || data.motorColor ? String(data.motor_color || data.motorColor) : null,
                    targetServices: data.target_services || data.targetServices || [],
                    budgetSignal: data.budget_signal || data.budgetSignal || null,
                    detectedIntents: data.detected_intents || data.detectedIntents || [],
                    conversationStage: data.conversation_stage || data.conversationStage || null,
                    lastAiAction: data.last_ai_action || data.lastAiAction || null,
                    customerLabel: data.customer_label || data.customerLabel || null,
                    labelConfidence: data.label_confidence || data.labelConfidence || null,
                    labelReason: data.label_reason || data.labelReason || null,
                    followUpStrategy: data.followup_strategy || data.followUpStrategy || null,
                    ghostedTimes: data.ghosted_times || data.ghostedTimes || null,
                    followUpConverted: data.followup_converted || data.followUpConverted || false,
                    lastFollowUpAt: data.last_followup_at?.toDate?.() || null,
                    conversationSummary: data.conversation_summary || data.conversationSummary || null
                }
            });


            imported++;
        } catch (e) {
            console.error(`   ❌ Context error for ${doc.id}: ${e.message}`);
            skipped++;
        }
    }

    console.log(`   ✅ Phase B complete: ${imported} contexts imported, ${skipped} skipped`);
    return { imported, skipped };
}

// ============================================
// PHASE C: IMPORT DIRECT MESSAGES
// ============================================

async function importDirectMessages() {
    console.log('\n📥 Phase C: Importing DirectMessages from Firestore...\n');

    // Build customer lookup map
    const customers = await prisma.customer.findMany({
        select: { id: true, phone: true, whatsappLid: true }
    });
    const customerMap = new Map();
    for (const c of customers) {
        customerMap.set(c.phone, c.id);
        if (c.whatsappLid) {
            const lidNumeric = c.whatsappLid.replace('@lid', '');
            customerMap.set(lidNumeric, c.id);
        }
    }
    console.log(`   Loaded ${customers.length} customers for FK mapping`);

    const dmSnapshot = await db.collection('directMessages').get();
    console.log(`   Found ${dmSnapshot.docs.length} conversation threads\n`);

    let totalMessages = 0;
    let threadsProcessed = 0;
    let threadsCreated = 0;
    let threadsSkipped = 0;

    for (const doc of dmSnapshot.docs) {
        const docId = doc.id;

        // Detect phone format
        const detected = detectAndSuffix(docId);
        if (!detected) {
            threadsSkipped++;
            continue;
        }

        // Find customer
        let customerId = customerMap.get(detected.phone);
        if (!customerId) {
            // Try to create customer on-the-fly
            try {
                const newCustomer = await prisma.customer.upsert({
                    where: { phone: detected.phone },
                    create: {
                        phone: detected.phone,
                        whatsappLid: detected.whatsappLid,
                        name: doc.data()?.name || `Customer ${detected.phone.slice(-4)}`
                    },
                    update: {}
                });
                customerId = newCustomer.id;
                customerMap.set(detected.phone, customerId);
                threadsCreated++;
            } catch (e) {
                console.error(`   ❌ Failed to create customer for ${docId}: ${e.message}`);
                threadsSkipped++;
                continue;
            }
        }

        // Fetch messages subcollection
        const msgSnap = await doc.ref.collection('messages').get();
        if (msgSnap.empty) continue;

        const messagesToInsert = [];
        let latestMsgContent = '';
        let latestMsgAt = null;

        msgSnap.forEach(msgDoc => {
            const m = msgDoc.data();

            let rawContent = m.content || m.text || m.body || m.message;
            let contentTxt = '';

            if (rawContent !== undefined && rawContent !== null) {
                contentTxt = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
            } else if (m.mediaUrl || m.imageUrl) {
                contentTxt = '[Media attached]';
            } else {
                contentTxt = '[Empty Message]';
            }

            // Map role
            let role = m.role || m.sender || 'user';
            if (['admin', 'assistant', 'bot', 'ai'].includes(role.toLowerCase())) {
                role = 'assistant';
            } else {
                role = 'user';
            }

            const timestamp = m.timestamp?.toDate?.() || m.createdAt?.toDate?.() || new Date();

            messagesToInsert.push({
                customerId,
                senderId: role === 'assistant' ? 'assistant' : docId,
                role,
                content: contentTxt,
                mediaUrl: m.mediaUrl || m.imageUrl || null,
                createdAt: timestamp
            });

            // Track latest message
            if (!latestMsgAt || timestamp > latestMsgAt) {
                latestMsgAt = timestamp;
                latestMsgContent = contentTxt;
            }

            totalMessages++;
        });

        // Batch insert messages
        if (messagesToInsert.length > 0) {
            try {
                await prisma.directMessage.createMany({
                    data: messagesToInsert,
                    skipDuplicates: true
                });

                // Update customer with latest message info
                if (latestMsgAt) {
                    await prisma.customer.update({
                        where: { id: customerId },
                        data: {
                            lastMessage: latestMsgContent,
                            lastMessageAt: latestMsgAt
                        }
                    });
                }
            } catch (e) {
                console.error(`   ❌ Failed to insert messages/update customer for ${docId}: ${e.message}`);
            }
        }


        threadsProcessed++;
        if (threadsProcessed % 20 === 0) {
            process.stdout.write(`   📦 ${threadsProcessed} threads processed (${totalMessages} messages)...\n`);
        }
    }

    console.log(`\n   ✅ Phase C complete:`);
    console.log(`      Threads processed: ${threadsProcessed}`);
    console.log(`      Threads created (new customers): ${threadsCreated}`);
    console.log(`      Threads skipped: ${threadsSkipped}`);
    console.log(`      Total messages imported: ${totalMessages}`);

    return { threadsProcessed, threadsCreated, threadsSkipped, totalMessages };
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔥  FRESH IMPORT FROM FIRESTORE');
    console.log('═══════════════════════════════════════════════════════');

    const startTime = Date.now();

    try {
        // Phase A: Customers
        const phaseA = await importCustomers();

        // Phase B: CustomerContext
        const phaseB = await importCustomerContext();

        // Phase C: DirectMessages
        const phaseC = await importDirectMessages();

        // Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📊 IMPORT SUMMARY');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`\nPhase A - Customers:`);
        console.log(`   Created: ${phaseA.created}`);
        console.log(`   Phone (@c.us): ${phaseA.phoneCount}`);
        console.log(`   LID (@lid): ${phaseA.lidCount}`);
        console.log(`   Merged duplicates: ${phaseA.mergeCount}`);
        console.log(`\nPhase B - CustomerContext:`);
        console.log(`   Imported: ${phaseB.imported}`);
        console.log(`   Skipped: ${phaseB.skipped}`);
        console.log(`\nPhase C - DirectMessages:`);
        console.log(`   Threads: ${phaseC.threadsProcessed}`);
        console.log(`   Messages: ${phaseC.totalMessages}`);
        console.log(`   New customers created: ${phaseC.threadsCreated}`);

        console.log('\n✅ FIRESTORE IMPORT COMPLETE!');

    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
