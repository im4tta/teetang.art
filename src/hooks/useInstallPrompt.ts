import { useEffect, useState } from "react";
import { localStorageCache } from "@/services/cache/localStorageCache";
import { isNativePlatform } from "@/services/platform";
import { BeforeInstallPromptEvent, INSTALL_DISMISS_KEY, WEEK_MS } from "@/services/install/types";

declare global {
  interface Window {
    __teetangartDeferredInstallPrompt?: Event;
  }
}

function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    ("standalone" in window.navigator
      ? (window.navigator as { standalone?: boolean }).standalone === true
      : false) || window.matchMedia("(display-mode: standalone)").matches
  );
}

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (isNativePlatform() || isInStandaloneMode() || isIos()) return null;
    if (localStorageCache.read<boolean>(INSTALL_DISMISS_KEY, WEEK_MS)) return null;
    return (
      (window.__teetangartDeferredInstallPrompt as BeforeInstallPromptEvent | undefined) ?? null
    );
  });
  const [showIosHint, setShowIosHint] = useState(
    () =>
      !isNativePlatform() &&
      !isInStandaloneMode() &&
      !localStorageCache.read<boolean>(INSTALL_DISMISS_KEY, WEEK_MS) &&
      isIos(),
  );
  const [showAndroidHint, setShowAndroidHint] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    Boolean(localStorageCache.read<boolean>(INSTALL_DISMISS_KEY, WEEK_MS)),
  );
  const [beforeInstallPromptFired, setBeforeInstallPromptFired] = useState(() =>
    Boolean(window.__teetangartDeferredInstallPrompt),
  );
  const [promptOutcome, setPromptOutcome] = useState<"accepted" | "dismissed" | "failed" | null>(
    null,
  );
  const [swControlled] = useState(() => Boolean(navigator.serviceWorker?.controller));
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (isNativePlatform()) return;

    if (navigator.serviceWorker?.ready) {
      void navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }

    if (isInStandaloneMode()) return;

    if (localStorageCache.read<boolean>(INSTALL_DISMISS_KEY, WEEK_MS)) return;

    if (isIos()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setBeforeInstallPromptFired(true);
      setShowAndroidHint(false);
      window.__teetangartDeferredInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);

    const fallbackTimer = window.setTimeout(() => {
      if (isAndroid() && !window.__teetangartDeferredInstallPrompt) {
        setShowAndroidHint(true);
      }
    }, 4000);

    const installedHandler = () => {
      setDeferredPrompt(null);
      setShowAndroidHint(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  function dismiss() {
    localStorageCache.write(INSTALL_DISMISS_KEY, true);
    setDismissed(true);
    setShowIosHint(false);
    setShowAndroidHint(false);
    setDeferredPrompt(null);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowAndroidHint(false);
        setPromptOutcome("accepted");
      } else {
        setShowAndroidHint(true);
        setPromptOutcome("dismissed");
      }
    } catch {
      setShowAndroidHint(true);
      setPromptOutcome("failed");
    }
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    isSecureContext,
    isIos: isIos(),
    isAndroid: isAndroid(),
    isStandaloneMode: isInStandaloneMode(),
    deferredPromptAvailable: Boolean(deferredPrompt),
    deferredPromptCached: Boolean(window.__teetangartDeferredInstallPrompt),
    beforeInstallPromptFired,
    promptOutcome,
    swControlled,
    swReady,
    dismissed,
  } as const;

  return {
    deferredPrompt,
    showIosHint,
    showAndroidHint,
    dismissed,
    dismiss,
    handleInstall,
    diagnostics,
  } as const;
}
