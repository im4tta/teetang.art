import { useCallback, useEffect, useRef, useState } from "react";
import { searchLocations } from "@/core/services";
import type { SearchResult } from "@/features/location/domain/types";

const DEBOUNCE_MS = 450;

export function useLocationAutocomplete(locationInput: string, isFocused: boolean) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const latestQueryRef = useRef("");
  const debounceRef = useRef<number>();
  const abortRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    latestQueryRef.current = q;
    setIsSearching(true);
    try {
      const results = await searchLocations(q, 6, ctrl.signal);
      if (latestQueryRef.current === q) setSuggestions(results);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (latestQueryRef.current === q) setSuggestions([]);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      if (latestQueryRef.current === q) setIsSearching(false);
    }
  }, []);

  const searchNow = useCallback(async (query: string) => {
    window.clearTimeout(debounceRef.current);
    await performSearch(query);
  }, [performSearch]);

  useEffect(() => {
    const q = locationInput.trim();
    if (!isFocused || q.length < 2) {
      latestQueryRef.current = "";
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    debounceRef.current = window.setTimeout(() => { if (!cancelled) void performSearch(q); }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [locationInput, isFocused, performSearch]);

  return {
    locationSuggestions: suggestions,
    isLocationSearching: isSearching,
    clearLocationSuggestions: useCallback(() => setSuggestions([]), []),
    searchNow,
  };
}
