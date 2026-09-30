/**
 * App-wide notifications. Anything can call notify(); the Toaster mounted by
 * AppShell renders them above every panel, so messages are seen on phones even
 * when the settings drawer is closed.
 */
export type ToastTone = "info" | "success" | "error";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  /** Milliseconds before it hides itself; 0 keeps it until dismissed. */
  duration: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let counter = 0;

const emit = () => listeners.forEach((listener) => listener(toasts));

export function dismiss(id: string): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

/** Shows a message; passing an existing `id` replaces that message. Returns the id. */
export function notify(
  message: string,
  {
    tone = "info",
    duration = tone === "error" ? 6_000 : 3_000,
    id,
  }: Partial<Omit<Toast, "message">> = {},
): string {
  const toastId = id ?? `toast-${++counter}`;
  clearTimeout(timers.get(toastId));
  toasts = [
    ...toasts.filter((toast) => toast.id !== toastId),
    { id: toastId, message, tone, duration },
  ].slice(-3);
  if (duration > 0)
    timers.set(
      toastId,
      setTimeout(() => dismiss(toastId), duration),
    );
  emit();
  return toastId;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => listeners.delete(listener);
}
