import { useEffect, useState } from "react";
import { fetchAdapter } from "@/api/http/fetchAdapter";
import { localStorageCache } from "@/services/cache/localStorageCache";

interface UseRepoStarsReturn {
  repoStars: number | null;
  repoStarsLoading: boolean;
}

const STARS_CACHE_KEY_PREFIX = "repoStars.";
const memoryStarsCache = new Map<string, number>();
const inFlightRequests = new Map<string, Promise<number | null>>();
const MEMORY_CACHE_MAX = 50;

function normalizeToApiUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("api.github.com")) return url;

    if (parsed.hostname.includes("github.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://api.github.com/repos/${parts[0]}/${parts[1]}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function cacheKey(apiUrl: string): string {
  return `${STARS_CACHE_KEY_PREFIX}${encodeURIComponent(apiUrl)}`;
}

function readCachedStars(apiUrl: string): number | null {
  const inMemory = memoryStarsCache.get(apiUrl);
  if (typeof inMemory === "number") return inMemory;

  const stored = localStorageCache.read<number>(cacheKey(apiUrl));
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 0) {
    const normalized = Math.floor(stored);
    memoryStarsCache.set(apiUrl, normalized);
    return normalized;
  }
  return null;
}

function writeCachedStars(apiUrl: string, stars: number): void {
  if (memoryStarsCache.size >= MEMORY_CACHE_MAX) {
    memoryStarsCache.clear();
  }
  memoryStarsCache.set(apiUrl, stars);
  localStorageCache.write(cacheKey(apiUrl), stars);
}

export function useRepoStars(repoApiUrl: string): UseRepoStarsReturn {
  const [repoStars, setRepoStars] = useState<number | null>(null);
  const [repoStarsLoading, setRepoStarsLoading] = useState(true);

  useEffect(() => {
    const finalUrl = normalizeToApiUrl(repoApiUrl);
    if (!finalUrl) {
      setRepoStars(null);
      setRepoStarsLoading(false);
      return undefined;
    }

    const cachedStars = readCachedStars(finalUrl);
    if (cachedStars !== null) {
      setRepoStars(cachedStars);
      setRepoStarsLoading(false);
    }

    let cancelled = false;

    async function fetchRepoStars() {
      let request = inFlightRequests.get(finalUrl);
      if (!request) {
        request = (async () => {
          try {
            const response = await fetchAdapter.get(finalUrl, {
              headers: { Accept: "application/vnd.github+json" },
            });

            if (!response.ok) {
              throw new Error(`GitHub API failed with HTTP ${response.status}`);
            }

            const payload: unknown = await response.json();
            const raw =
              payload !== null && typeof payload === "object" && "stargazers_count" in payload
                ? (payload as Record<string, unknown>).stargazers_count
                : NaN;
            const stars = Number(raw);
            if (Number.isFinite(stars) && stars >= 0) {
              const normalized = Math.floor(stars);
              writeCachedStars(finalUrl, normalized);
              return normalized;
            }
            return null;
          } catch {
            return null;
          } finally {
            inFlightRequests.delete(finalUrl);
          }
        })();
        inFlightRequests.set(finalUrl, request);
      }

      try {
        if (cachedStars === null) {
          setRepoStarsLoading(true);
        }
        const stars = await request;
        if (!cancelled && stars !== null) {
          setRepoStars(stars);
        }
      } catch {
        if (!cancelled) {
          setRepoStars(null);
        }
      } finally {
        if (!cancelled) {
          setRepoStarsLoading(false);
        }
      }
    }

    void fetchRepoStars();

    return () => {
      cancelled = true;
    };
  }, [repoApiUrl]);

  return { repoStars, repoStarsLoading };
}
