importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

async function readFirebaseConfig() {
  try {
    const response = await fetch("/firebase-messaging-config.json", { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

readFirebaseConfig().then((config) => {
  if (!config?.apiKey || !config?.messagingSenderId || !config?.appId || !config?.projectId) return;

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || "AgenSync", {
      body: notification.body || "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: payload.data || {}
    });
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl = event.notification.data?.actionUrl || "/";
  event.waitUntil(clients.openWindow(actionUrl));
});
