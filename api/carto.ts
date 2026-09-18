/**
 * Server-side proxy for the CARTO raster basemaps.
 *
 * vercel.json rewrites /api/carto/rastertiles/<style>/<z>/<x>/<y>.png to
 * /api/carto?path=… here, and the key is appended on this side, so
 * CARTO_API_KEY stays in the server environment and never ends up in the
 * client bundle or the tile URLs.
 */
export const config = { runtime: "edge" };

const UPSTREAM = "https://a.basemaps.cartocdn.com";
const TILE_PATH = /^rastertiles\/(?:voyager|light_all|dark_all)\/\d{1,2}\/\d+\/\d+\.png$/;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const tilePath = new URL(request.url).searchParams.get("path");
  if (!tilePath || !TILE_PATH.test(tilePath)) {
    return new Response("Not found", { status: 404 });
  }

  const apiKey = process.env.CARTO_API_KEY;
  if (!apiKey) {
    return new Response("CARTO basemap key is not configured", { status: 500 });
  }

  const upstream = await fetch(`${UPSTREAM}/${tilePath}?key=${encodeURIComponent(apiKey)}`);
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream basemap error", { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Tiles are immutable per URL, so let the CDN answer repeats and keep
      // function invocations low.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
