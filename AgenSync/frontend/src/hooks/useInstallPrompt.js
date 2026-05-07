import { useEffect, useState } from "react";

const DISMISSED_KEY = "agensync_install_prompt_dismissed_v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function deviceInfo() {
  if (typeof window === "undefined") {
    return {
      isAndroid: false,
      isIOS: false,
      isDesktop: false
    };
  }

  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(userAgent);
  const isChromium = /Chrome|CriOS|Edg|OPR/i.test(userAgent);

  return {
    isAndroid,
    isIOS,
    isDesktop: !isAndroid && !isIOS,
    isSafari,
    isChromium,
    platform: isIOS ? "ios" : isAndroid ? "android" : "desktop"
  };
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [device] = useState(deviceInfo);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      if (!dismissed && !isStandalone()) setInstallEvent(event);
    }

    function handleAppInstalled() {
      setInstallEvent(null);
      localStorage.setItem(DISMISSED_KEY, "1");
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [dismissed]);

  async function promptInstall() {
    if (!installEvent) return false;
    installEvent.prompt();
    const result = await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    return result?.outcome === "accepted";
  }

  function dismissInstallPrompt() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
    setInstallEvent(null);
  }

  return {
    canInstall: Boolean(installEvent) && !dismissed && !isStandalone(),
    promptInstall,
    dismissInstallPrompt,
    isDismissed: dismissed,
    isStandalone: isStandalone(),
    ...device
  };
}
