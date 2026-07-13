import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProviders } from "@/context/AppProviders";
import AppShell from "@/components/layout/AppShell";
import HomePage from "@/pages/HomePage";

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<AppShell />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
