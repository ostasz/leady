// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCFJPuoMrFGKrihjS38bFEzkM-HNI8rVQM",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "leady-web.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "leady-web",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "leady-web.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "866590588500",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:866590588500:web:ace85b92c4563cd27cf7c1"
};

export default firebaseConfig;
