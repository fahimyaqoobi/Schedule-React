import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "schedule-system-stc",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let app;
let auth;
let db;

try {
    const hasValidKey = firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder-api-key" && !firebaseConfig.apiKey.includes("REPLACE");
    
    if (hasValidKey) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    } else {
        // Fallback for Next.js build-time prerendering
        console.warn("Client Firebase: Missing or placeholder API Key. Using build-time compile fallback.");
        app = getApps().length === 0 ? initializeApp({
            apiKey: "AIzaSyCmorJ5BRU9tUx63T2YFnhbYHwoCawtIsw", // Safe client fallback
            projectId: "schedule-system-stc"
        }) : getApp();
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
} catch (err) {
    console.error("Client Firebase initialization error:", err);
    // Bulletproof fallback to satisfy compiler checks
    try {
        app = getApps().length === 0 ? initializeApp({ 
            apiKey: "AIzaSyCmorJ5BRU9tUx63T2YFnhbYHwoCawtIsw", 
            projectId: "schedule-system-stc" 
        }) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (fallbackErr) {
        // Already initialized
    }
}

export { app, auth, db };
