import type { IHttp } from "@/api/http/ports";

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 20_000): Promise<Response> {
  const ctrl = new AbortController();
  const tid = window.setTimeout(() => ctrl.abort(), ms);
  const { signal, ...rest } = opts;
  signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
  try { return await fetch(url, { ...rest, signal: ctrl.signal }); }
  finally { window.clearTimeout(tid); }
}

export const fetchAdapter: IHttp = {
  get: (url, opts?, ms?) => fetchWithTimeout(url, { ...opts, method: "GET" }, ms),
  post: (url, body, opts?, ms?) => fetchWithTimeout(url, { ...opts, method: "POST", body }, ms),
};
