import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearDraft } from "@/context/posterDraft";

interface State {
  failed: boolean;
}

/**
 * Last-resort screen if the editor crashes. It sits outside the i18n and
 * poster providers (they may be what failed), so its text is bilingual.
 */
export default class EditorErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Editor crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="editor-crash" role="alert">
        <h1>មានបញ្ហាកើតឡើង · Something went wrong</h1>
        <p>
          ផ្ទាំងរបស់អ្នកត្រូវបានរក្សាទុក។ សូមផ្ទុកទំព័រឡើងវិញ។
          <br />
          Your poster is saved. Reload to continue where you left off.
        </p>
        <button type="button" className="editor-crash__primary" onClick={() => location.reload()}>
          ផ្ទុកឡើងវិញ · Reload
        </button>
        <button
          type="button"
          className="editor-crash__secondary"
          onClick={() => {
            // A saved design that keeps crashing the editor is discarded here.
            clearDraft();
            location.reload();
          }}
        >
          ចាប់ផ្ដើមផ្ទាំងថ្មី · Start a new poster
        </button>
      </main>
    );
  }
}
