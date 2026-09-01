export function detectDevicePlatform() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iphone";
  return "desktop";
}
