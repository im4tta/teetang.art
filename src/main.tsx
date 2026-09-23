import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/base.css";
import { isNativePlatform } from "@/services/platform";
import App from "@/App";

const standaloneQuery = window.matchMedia("(display-mode: standalone)");
const syncDisplayMode = () => {
  const standalone =
    isNativePlatform() ||
    standaloneQuery.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  document.documentElement.dataset.displayMode = standalone ? "standalone" : "browser";
};

syncDisplayMode();
standaloneQuery.addEventListener("change", syncDisplayMode);

if (import.meta.env.PROD && "serviceWorker" in navigator && !isNativePlatform()) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(console.warn),
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
