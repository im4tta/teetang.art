import { useCallback, useEffect, useRef, useState } from "react";
import { searchLocations } from "@/services/container";
import type { SearchResult } from "@/services/location/types";

const DEBOUNCE_MS = 450;

export function useLocationAutocomplete(locationInput: string, isFocused: boolean) {
  const focusedQuery = isFocused && locationInput.trim().length >= 2 ? locationInput.trim() : "";
  const [searchResult, setSearchResult] = useState<{
    query: string;
    suggestions: SearchResult[];
  }>({ query: "", suggestions: [] });
  const [searchStatus, setSearchStatus] = useState<{ query: string; isSearching: boolean }>({
    query: "",
    isSearching: false,
  });
  const latestQueryRef = useRef("");
  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResult({ query: q, suggestions: [] });
      setSearchStatus({ query: q, isSearching: false });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    latestQueryRef.current = q;
    setSearchStatus({ query: q, isSearching: true });
    try {
      const results = await searchLocations(q, 6, ctrl.signal);
      if (latestQueryRef.current === q) {
        setSearchResult({ query: q, suggestions: results });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (latestQueryRef.current === q) {
        setSearchResult({ query: q, suggestions: [] });
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      if (latestQueryRef.current === q) {
        setSearchStatus({ query: q, isSearching: false });
      }
    }
  }, []);

  const searchNow = useCallback(
    async (query: string) => {
      window.clearTimeout(debounceRef.current);
      await performSearch(query);
    },
    [performSearch],
  );

  useEffect(() => {
    if (!focusedQuery) {
      latestQueryRef.current = "";
      return;
    }
    let cancelled = false;
    debounceRef.current = window.setTimeout(() => {
      if (!cancelled) void performSearch(focusedQuery);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [focusedQuery, performSearch]);

  const clearLocationSuggestions = useCallback(() => {
    setSearchResult({ query: focusedQuery, suggestions: [] });
    setSearchStatus({ query: focusedQuery, isSearching: false });
  }, [focusedQuery]);

  return {
    locationSuggestions: searchResult.query === focusedQuery ? searchResult.suggestions : [],
    isLocationSearching: searchStatus.query === focusedQuery && searchStatus.isSearching,
    clearLocationSuggestions,
    searchNow,
  };
}
