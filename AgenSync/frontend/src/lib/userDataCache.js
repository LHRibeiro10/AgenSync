const USER_DATA_PREFIXES = [
  "agensync_query_",
  "agensync_notifications_",
  "agensync_dashboard_",
  "agensync_fcm_token_"
];

export function clearUserDataCache() {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index) || "";
    if (USER_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  window.dispatchEvent(new Event("agensync:clear-user-cache"));
}
