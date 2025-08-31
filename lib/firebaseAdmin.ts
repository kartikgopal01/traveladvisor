import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

let adminApp: App | undefined;
let db: Firestore | undefined;

export function getAdminDb(): Firestore {
  if (db) return db;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env vars");
  }

  // Support escaped newlines in env
  if (privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  db = getFirestore();
  // Avoid errors when optional fields are undefined
  try {
    // @ts-ignore - settings is available on Firestore instance
    db.settings({ ignoreUndefinedProperties: true });
  } catch {}
  return db;
}


