/**
 * Range proxy for the Copernicus GLO-30 elevation tiles.
 *
 * The public AWS bucket holds cloud-optimised GeoTIFFs but sends no CORS
 * headers, so a browser cannot read it directly. The plate page asks for
 * /api/dem?tile=N12E104 with a Range header and reads only the pieces it
 * needs (about 1 MB of a 45 MB tile for a 10 km plate); this forwards that
 * range from the same origin.
 *
 * Only well-formed tile names and single byte ranges get through, so it cannot
 * be used as an open proxy or to pull whole tiles.
 */
export const config = { runtime: "edge" };

const BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com";
const TILE = /^([NS]\d{2})([EW]\d{3})$/;
const RANGE = /^bytes=\d{1,10}-\d{1,10}$/;
/** Biggest piece one request may ask for; tiles are read in small blocks. */
const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const match = TILE.exec(new URL(request.url).searchParams.get("tile") ?? "");
  if (!match) return new Response("Bad tile name", { status: 400 });

  const range = request.headers.get("range");
  const [from, to] = (range ?? "").replace("bytes=", "").split("-").map(Number);
  if (!range || !RANGE.test(range) || to < from || to - from >= MAX_BYTES) {
    return new Response("A single byte range is required", { status: 416 });
  }

  const name = `Copernicus_DSM_COG_10_${match[1]}_00_${match[2]}_00_DEM`;
  const upstream = await fetch(`${BUCKET}/${name}/${name}.tif`, { headers: { Range: range } });

  // The bucket answers 403 or 404 for a tile that does not exist (open sea).
  if (upstream.status === 403 || upstream.status === 404) {
    return new Response("No elevation tile here", {
      status: 404,
      headers: { "x-dem": "missing", "Cache-Control": "public, s-maxage=86400" },
    });
  }
  if (upstream.status !== 206 || !upstream.body) {
    return new Response("Upstream elevation error", { status: 502 });
  }

  const headers = new Headers({ "Content-Type": "image/tiff", "Accept-Ranges": "bytes" });
  for (const name of ["content-range", "content-length", "etag"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // A tile's bytes never change, so browsers and the CDN may keep them.
  headers.set("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: 206, headers });
}
