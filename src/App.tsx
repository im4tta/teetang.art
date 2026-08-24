import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import HomePage from "@/pages/HomePage";
import { loadEditorPage } from "@/pages/editorLoader";

const EditorPage = lazy(loadEditorPage);

function RouteLoadingFallback() {
  return (
    <main className="route-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span>Opening the editor…</span>
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
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
