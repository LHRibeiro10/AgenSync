import { env } from "../config/env.js";

function hasFirebaseMessagingConfig() {
  const config = env.firebase || {};
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      config.vapidKey
  );
}

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export async function getFcmToken() {
  if (!canUseNotifications()) {
    return { token: "", reason: "unsupported" };
  }

  if (!hasFirebaseMessagingConfig()) {
    return { token: "", reason: "missing_config" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { token: "", reason: "permission_denied" };
  }

  const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging")
  ]);

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: env.firebase.apiKey,
        authDomain: env.firebase.authDomain,
        projectId: env.firebase.projectId,
        messagingSenderId: env.firebase.messagingSenderId,
        appId: env.firebase.appId
      });

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => null);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: env.firebase.vapidKey,
    serviceWorkerRegistration: registration || undefined
  });

  return {
    token,
    onForegroundMessage: (handler) => onMessage(messaging, handler)
  };
}
