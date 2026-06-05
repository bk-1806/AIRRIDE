const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  const hasCredentials =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL;

  if (hasCredentials) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:    process.env.FIREBASE_PROJECT_ID,
          privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
          privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
          clientId:     process.env.FIREBASE_CLIENT_ID,
          authUri:      process.env.FIREBASE_AUTH_URI   || 'https://accounts.google.com/o/oauth2/auth',
          tokenUri:     process.env.FIREBASE_TOKEN_URI  || 'https://oauth2.googleapis.com/token',
        }),
      });
      console.log('✅ Firebase Admin initialized');
    } catch (err) {
      console.error('❌ Firebase Admin init failed:', err.message);
    }
  } else {
    console.warn('⚠️  Firebase credentials not set – auth middleware will return 503 until configured');
    // Initialize with no credentials so admin.apps.length > 0 (prevents re-init errors)
    admin.initializeApp();
  }
}

module.exports = admin;
