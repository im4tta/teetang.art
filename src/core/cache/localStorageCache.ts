import type { ICache } from "./ports";
import { APP_VERSION } from "@/core/config";

const PREFIX = `teetangart:${APP_VERSION}:`;
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

export const localStorageCache: ICache = {
  read<T>(key: string, maxAgeMs = DEFAULT_TTL): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > maxAgeMs) { localStorage.removeItem(PREFIX + key); return null; }
      return (data as T) ?? null;
    } catch { return null; }
  },
  write(key: string, data: unknown): void {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch { /* quota exceeded or storage unavailable; ignore */ }
  },
};
