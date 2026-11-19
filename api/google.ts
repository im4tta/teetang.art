/**
 * Server-side proxy for Google's Map Tiles API (2D tiles), used by the 3D
 * plate's Move map. GOOGLE_MAPS_API_KEY stays in the server environment.
 *
 *   /api/google?status=1                        → { enabled }
 *   /api/google?t=roadmap&l=km&r=2&z=&x=&y=     → one tile
 *   /api/google?t=…&l=…&r=…&viewport=1&zoom=&n=&s=&e=&w=  → { copyright }
 *
 * The Map Tiles API needs a session per map type and language; sessions last
 * about two weeks, so they are cached for the life of this edge instance.
 * Docs: https://developers.google.com/maps/documentation/tile/2d-tiles-overview
 */
export const config = { runtime: "edge" };

const API = "https://tile.googleapis.com";
const MAP_TYPES = new Set(["roadmap", "satellite"]);
const LANGUAGES: Record<string, string> = { en: "en-US", km: "km" };

interface Session {
  token: string;
  expiresAt: number;
}

const sessions = new Map<string, Promise<Session>>();

function createSession(key: string, mapType: string, lang: string, retina: boolean) {
  const body: Record<string, unknown> = {
    mapType,
    language: LANGUAGES[lang],
    region: "KH",
    // Satellite gets Google's road and place labels drawn on top.
    ...(mapType === "satellite" && { layerTypes: ["layerRoadmap"] }),
    ...(retina && { scale: "scaleFactor2x", highDpi: true }),
  };
  return fetch(`${API}/v1/createSession?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`createSession ${response.status}`);
    const data = (await response.json()) as { session: string; expiry: string };
    // Renew an hour early so a tile request never carries an expired token.
    return { token: data.session, expiresAt: Number(data.expiry) * 1000 - 3_600_000 };
  });
}

async function sessionFor(key: string, mapType: string, lang: string, retina: boolean) {
  const id = `${mapType}:${lang}:${retina}`;
  const cached = sessions.get(id);
  if (cached) {
    const session = await cached.catch(() => null);
    if (session && session.expiresAt > Date.now()) return session.token;
  }
  const fresh = createSession(key, mapType, lang, retina);
  sessions.set(id, fresh);
  fresh.catch(() => sessions.delete(id));
  return (await fresh).token;
}

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache },
  });

const isInt = (value: string | null, max: number) =>
  value !== null && /^\d{1,8}$/.test(value) && Number(value) <= max;
const isCoord = (value: string | null) => value !== null && /^-?\d{1,3}(\.\d{1,8})?$/.test(value);

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const params = new URL(request.url).searchParams;

  if (params.has("status")) return json({ enabled: Boolean(key) }, 200, "public, max-age=300");
  if (!key) return json({ error: "Google Maps key is not configured" }, 503);

  const mapType = params.get("t") ?? "";
  const lang = params.get("l") ?? "";
  const retina = params.get("r") === "2";
  if (!MAP_TYPES.has(mapType) || !(lang in LANGUAGES)) return json({ error: "Bad request" }, 400);

  // Check everything before asking Google for a session, which is billed.
  const viewport = params.has("viewport");
  const [z, x, y] = ["z", "x", "y"].map((name) => params.get(name));
  if (!viewport && (!isInt(z, 22) || !isInt(x, 2 ** 22) || !isInt(y, 2 ** 22))) {
    return json({ error: "Bad request" }, 400);
  }
  const [zoom, n, s, e, w] = ["zoom", "n", "s", "e", "w"].map((name) => params.get(name));
  if (viewport && (!isInt(zoom, 22) || ![n, s, e, w].every(isCoord))) {
    return json({ error: "Bad request" }, 400);
  }

  let token: string;
  try {
    token = await sessionFor(key, mapType, lang, retina);
  } catch {
    return json({ error: "Could not start a Google Maps session" }, 502);
  }
  const auth = `session=${encodeURIComponent(token)}&key=${encodeURIComponent(key)}`;

  if (params.has("viewport")) {
    const [zoom, n, s, e, w] = ["zoom", "n", "s", "e", "w"].map((name) => params.get(name));
    if (!isInt(zoom, 22) || ![n, s, e, w].every(isCoord))
      return json({ error: "Bad request" }, 400);
    const upstream = await fetch(
      `${API}/tile/v1/viewport?${auth}&zoom=${zoom}&north=${n}&south=${s}&east=${e}&west=${w}`,
    );
    if (!upstream.ok) return json({ copyright: "" }, 200);
    const { copyright = "" } = (await upstream.json()) as { copyright?: string };
    return json({ copyright }, 200, "public, max-age=3600");
  }

  const upstream = await fetch(`${API}/v1/2dtiles/${z}/${x}/${y}?${auth}`);
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream tile error", { status: upstream.status === 404 ? 404 : 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      // Follow Google's own caching rules for its tiles.
      "Cache-Control": upstream.headers.get("Cache-Control") ?? "private, max-age=3600",
    },
  });
}
