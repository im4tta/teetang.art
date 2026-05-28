import { useEffect, useState } from "react";

const MOBILE_MQ = "(max-width: 768px), (hover: none) and (pointer: coarse)";

/**
 * Returns true when the viewport matches the mobile media query.
 * Shared across PreviewPanel, MarkersSection, AppShell, and any other
 * component that needs to know whether the device is mobile/touch.
 */
export function useMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MQ).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
