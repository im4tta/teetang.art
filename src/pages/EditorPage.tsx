import AppShell from "@/components/layout/AppShell";
import { AppProviders } from "@/context/AppProviders";
import "@/styles/editor.css";

export default function EditorPage() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
