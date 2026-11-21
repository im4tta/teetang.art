import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import HomePage from "@/pages/HomePage";
import { loadEditorPage } from "@/pages/editorLoader";
import { loadPlatePage } from "@/pages/plateLoader";

const EditorPage = lazy(loadEditorPage);
const PlatePage = lazy(loadPlatePage);
const StudioPage = lazy(() => import("@/pages/StudioPage"));
const TranslationsPage = lazy(() => import("@/pages/TranslationsPage"));

function RouteLoadingFallback({ label = "Opening the editor…" }: { label?: string }) {
  return (
    <main className="route-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/create"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <EditorPage />
            </Suspense>
          }
        />
        <Route
          path="/plate"
          element={
            <Suspense fallback={<RouteLoadingFallback label="Opening the 3D plate…" />}>
              <PlatePage />
            </Suspense>
          }
        />
        <Route
          path="/plate/studio"
          element={
            <Suspense fallback={<RouteLoadingFallback label="Opening the STL Studio…" />}>
              <StudioPage />
            </Suspense>
          }
        />
        <Route
          path="/translations"
          element={
            <Suspense fallback={<RouteLoadingFallback label="Opening…" />}>
              <TranslationsPage />
            </Suspense>
          }
        />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
