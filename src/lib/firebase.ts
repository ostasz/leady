import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-config';

// Initialize Firebase (client-side)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
// Force long polling to avoid ERR_QUIC_PROTOCOL_ERROR
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

export { app, auth, db };
