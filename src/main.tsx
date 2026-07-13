import React from "react";
import ReactDOM from "react-dom/client";
import { isNativePlatform, onPlatformAdapterChange } from "@/services/platform";
import App from "@/App";
import "@/styles/index.css";

const syncDisplayMode = () => {
  const standalone =
    isNativePlatform() ||
    !!(window as any).Capacitor ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;
  document.documentElement.dataset.displayMode = standalone ? "standalone" : "browser";
};

syncDisplayMode();
onPlatformAdapterChange(syncDisplayMode);

const mq = window.matchMedia("(display-mode: standalone)");
(mq.addEventListener ?? ((e: string, h: EventListener) => mq.addEventListener(e, h))).call(mq, "change", syncDisplayMode);

if ("serviceWorker" in navigator && !isNativePlatform()) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(console.warn));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
