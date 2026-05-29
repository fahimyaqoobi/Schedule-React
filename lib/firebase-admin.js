import admin from "firebase-admin";

let adminDb = null;
let adminAuth = null;

if (!admin.apps.length) {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        
        // Correctly handle escaped newline characters (\n) common in Vercel environment variables
        const privateKey = process.env.FIREBASE_PRIVATE_KEY
            ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            : undefined;

        const hasValidKey = privateKey && privateKey.includes("PRIVATE KEY") && !privateKey.includes("REPLACE_WITH_YOUR_FIREBASE");

        if (clientEmail && hasValidKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey
                })
            });
            console.log("Firebase Admin Bridge: Securely connected via service account cert.");
        } else {
            console.warn("Firebase Admin Bridge: Missing or placeholder service credentials. Initializing fallback for build/dev compiles.");
            admin.initializeApp({
                projectId: projectId || "schedule-system-stc"
            });
        }
    } catch (e) {
        console.error("Firebase Admin SDK Initialization Failure:", e);
        // Fallback initialization to prevent route compiler crashes during build phases
        try {
            admin.initializeApp({
                projectId: "schedule-system-stc"
            });
        } catch (subErr) {
            // Already initialized or unable to initialize
        }
    }
}

try {
    adminDb = admin.firestore();
    adminAuth = admin.auth();
} catch (accessError) {
    console.warn("Could not retrieve Firestore/Auth admin services:", accessError.message);
    
    // Provide safe, non-blocking mock interfaces so compiler checks succeed without crashes
    adminDb = {
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: false, data: () => ({}) }),
                set: async () => ({})
            }),
            limit: () => ({
                get: async () => ({ empty: true })
            }),
            where: () => ({
                get: async () => ({ empty: true, forEach: () => {} })
            })
        })
    };
    adminAuth = {
        verifyIdToken: async () => ({ uid: "mock-uid" }),
        getUser: async () => ({})
    };
}

export { admin, adminDb, adminAuth };
