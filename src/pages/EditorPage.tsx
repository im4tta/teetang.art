import AppShell from "@/components/layout/AppShell";
import EditorErrorBoundary from "@/components/layout/EditorErrorBoundary";
import { AppProviders } from "@/context/AppProviders";
import "@/styles/editor.css";

export default function EditorPage() {
  return (
    <EditorErrorBoundary>
      <AppProviders>
        <AppShell />
      </AppProviders>
    </EditorErrorBoundary>
  );
}
