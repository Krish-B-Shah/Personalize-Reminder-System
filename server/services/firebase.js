const admin = require('firebase-admin');

let firebaseInitialized = false;
let firebaseAvailable = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    console.log('Firebase Admin SDK already initialized');
    return;
  }

  try {
    // Check if any Firebase credentials are available
    const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                          process.env.FIREBASE_PROJECT_ID || 
                          process.env.FIREBASE_PRIVATE_KEY;

    if (!hasCredentials) {
      console.log('⚠️ No Firebase credentials found. Running in demo mode without Firebase.');
      firebaseInitialized = true;
      firebaseAvailable = false;
      return;
    }

    // Initialize Firebase Admin SDK
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Using service account file
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      // Using environment variables (for production)
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }

    firebaseInitialized = true;
    firebaseAvailable = true;
    console.log('✅ Firebase Admin SDK initialized successfully');

  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
    console.log('⚠️ Continuing without Firebase. Some features may be limited.');
    firebaseInitialized = true;
    firebaseAvailable = false;
  }
};

const isFirebaseAvailable = () => firebaseAvailable;

module.exports = { initializeFirebase, isFirebaseAvailable };
