require('dotenv').config({ path: '../admin-frontend/.env.local' });
const admin = require('firebase-admin');

async function reset() {
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if(!serviceAccountBase64) throw new Error("No FIREBASE_SERVICE_ACCOUNT_BASE64 found");
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    
    // Fix private key newlines
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const email = 'admin@bosmatstudio.com';
    const newPassword = 'password123';

    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(user.uid, { password: newPassword });
      console.log(`Successfully reset password for ${email} to: ${newPassword}`);
    } catch (e) {
      console.log('User not found, creating new user...');
      await admin.auth().createUser({ email, password: newPassword });
      console.log(`Successfully created user ${email} with password: ${newPassword}`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
reset();
