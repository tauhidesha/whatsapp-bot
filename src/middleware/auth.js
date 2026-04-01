/**
 * Authentication Middleware for Express Backend
 * 
 * Validates Firebase ID tokens from the Authorization header.
 * All sensitive API routes must use this middleware.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccountBase64) {
      const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('🔐 [AUTH] Firebase Admin initialized for API authentication');
    } else {
      console.warn('⚠️ [AUTH] FIREBASE_SERVICE_ACCOUNT_BASE64 not set — auth middleware disabled');
    }
  } catch (error) {
    console.error('❌ [AUTH] Failed to initialize Firebase Admin:', error.message);
  }
}

/**
 * Middleware: Require authenticated Firebase user.
 * Expects: Authorization: Bearer <firebase-id-token>
 */
function requireAuth(req, res, next) {
  // Skip auth check if Firebase Admin is not initialized
  if (!admin.apps.length) {
    console.warn('⚠️ [AUTH] Firebase Admin not initialized — skipping auth check');
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
  }

  const idToken = authHeader.substring(7); // Remove "Bearer " prefix

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      // Attach user info to request for downstream use
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
      };
      next();
    })
    .catch((error) => {
      console.warn('🔐 [AUTH] Token verification failed:', error.code);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or expired authentication token',
      });
    });
}

/**
 * Middleware: Allow only specific admin emails.
 * Must be used AFTER requireAuth.
 */
function requireAdmin(req, res, next) {
  const allowedAdmins = [
    // Add admin email addresses here
    process.env.ADMIN_EMAIL,
  ].filter(Boolean);

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // If no admin list configured, allow any authenticated user
  if (allowedAdmins.length === 0) {
    return next();
  }

  if (!allowedAdmins.includes(req.user.email)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
