const STORAGE_KEY = "teetangart.searchHistory";
const MAX_HISTORY = 5;

export interface HistoryItem {
  label: string;
  lat: string;
  lon: string;
  city: string;
  country: string;
  continent: string;
  timestamp: number;
}

export function readSearchHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function writeSearchHistory(history: HistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

export function addSearchHistory(item: Omit<HistoryItem, "timestamp">): void {
  const history = readSearchHistory();
  const filtered = history.filter((h) => h.label !== item.label);
  filtered.unshift({ ...item, timestamp: Date.now() });
  writeSearchHistory(filtered.slice(0, MAX_HISTORY));
}

export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
