import admin from "firebase-admin";
import { normalizeEnvValue } from "../utils/env.js";

let firebaseApp = null;

function firebaseConfig() {
  const projectId = normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  const config = firebaseConfig();
  if (!config) return null;

  firebaseApp = admin.apps.length
    ? admin.apps[0]
    : admin.initializeApp({
        credential: admin.credential.cert(config)
      });

  return firebaseApp;
}

export function pushEnabled() {
  return Boolean(getFirebaseApp()) && process.env.ENABLE_PUSH_SEND === "1";
}

export async function sendPushToTokens(tokens, notification) {
  const app = getFirebaseApp();
  if (!app || process.env.ENABLE_PUSH_SEND !== "1" || !tokens.length) {
    return { sent: 0, skipped: true };
  }

  const response = await admin.messaging(app).sendEachForMulticast({
    tokens,
    notification: {
      title: notification.title,
      body: notification.body || ""
    },
    data: {
      actionUrl: notification.actionUrl || "/",
      type: notification.type || "info"
    },
    webpush: {
      notification: {
        icon: "/pwa-192.png",
        badge: "/pwa-192.png"
      }
    }
  });

  return { sent: response.successCount, failureCount: response.failureCount };
}

export async function sendPushToSubscriptions(subscriptions, notification) {
  if (!Array.isArray(subscriptions) || !subscriptions.length) {
    return { sent: 0, skipped: true };
  }

  // Native Web Push delivery needs VAPID signing. The subscription table is
  // prepared now; actual delivery can be enabled later without changing routes.
  return {
    sent: 0,
    skipped: true,
    reason: "web_push_delivery_not_configured",
    subscriptionCount: subscriptions.length,
    notification
  };
}
