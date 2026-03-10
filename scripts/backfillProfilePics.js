// scripts/backfillProfilePics.js
// Script to sync missing profile pictures from WhatsApp to Firestore
// Credits to WPPConnect for the profile pic extraction logic

require('dotenv').config();
const admin = require('firebase-admin');

// Firebase init
if (!admin.apps.length) {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
        );
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force'); // Refresh even if exists
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const DELAY_MS = 500; // Longer delay to avoid triggering WA spam protection

/**
 * Backfills profile pictures for existing conversations
 * @param {object} whatsappClient - WPPConnect client instance
 */
async function backfillProfilePics(whatsappClient) {
    console.log(`\n🖼️  [Backfill-Img] Starting profile picture backfill...`);
    console.log(`📋 [Backfill-Img] Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`📋 [Backfill-Img] Force Refresh: ${isForce}`);
    if (LIMIT) console.log(`📋 [Backfill-Img] Limit: ${LIMIT} conversations`);

    try {
        // 1. Fetch all conversations from Firestore
        const snapshot = await db.collection('directMessages').get();
        let conversations = snapshot.docs;

        // 2. Filter conversations that need updates
        let toProcess = conversations.filter(doc => {
            const data = doc.data();
            const hasPic = data.profilePicUrl && (typeof data.profilePicUrl === 'string' || data.profilePicUrl.eurl);
            return isForce || !hasPic;
        });

        if (LIMIT) {
            toProcess = toProcess.slice(0, LIMIT);
        }

        console.log(`📊 [Backfill-Img] Found ${conversations.length} total, ${toProcess.length} need processing.\n`);

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;

        for (const convDoc of toProcess) {
            const docId = convDoc.id;
            const data = convDoc.data();
            const fullSenderId = data.fullSenderId || (docId.includes('@') ? docId : `${docId}@c.us`);

            try {
                process.stdout.write(`👤 Processing ${data.name || docId}... `);

                // Skip if it's not a WhatsApp chat (optional check)
                if (data.channel && data.channel !== 'whatsapp') {
                    console.log('⏭️  Skipped (Not WhatsApp)');
                    skipCount++;
                    continue;
                }

                // 3. Fetch Profile Pic from Server
                let profilePicUrl = null;
                try {
                    profilePicUrl = await whatsappClient.getProfilePicFromServer(fullSenderId);
                } catch (picError) {
                    process.stdout.write(`❌ API Error: ${picError.message}\n`);
                    failCount++;
                    continue;
                }

                if (!profilePicUrl) {
                    process.stdout.write(`⏭️  No profile pic available on WA server\n`);
                    skipCount++;
                    continue;
                }

                if (isDryRun) {
                    process.stdout.write(`[DRY RUN] Would update URL\n`);
                    successCount++;
                } else {
                    // 4. Update Firestore
                    await db.collection('directMessages').doc(docId).update({
                        profilePicUrl: profilePicUrl,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    process.stdout.write(`✅ Updated!\n`);
                    successCount++;
                }

            } catch (error) {
                console.error(`\n❌ Error processing ${docId}:`, error.message);
                failCount++;
            }

            // Delay to avoid WPPConnect/WhatsApp rate limits
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        console.log(`\n📊 [Backfill-Img] Summary:`);
        console.log(`   ✅ Success : ${successCount}`);
        console.log(`   ⏭️  Skipped : ${skipCount}`);
        console.log(`   ❌ Failed  : ${failCount}`);
        console.log(`\n✅ [Backfill-Img] Done!\n`);

    } catch (error) {
        console.error('❌ Critical Error in backfillProfilePics:', error);
    }
}

module.exports = { backfillProfilePics };
