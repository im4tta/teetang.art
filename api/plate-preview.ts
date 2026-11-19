/**
 * Link previews for shared plates. Chat apps and social sites read a page's
 * <meta> tags without running its scripts, so a /plate?… link would always
 * show the site's generic card. vercel.json sends only their crawlers here;
 * this serves the normal page with the place's name and details in the
 * title, description and Open Graph tags. People are never routed here.
 */
export const config = { runtime: "edge" };

const escapeHtml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Keeps a query value short and printable: control characters become spaces. */
const clean = (value: string | null, max = 80) =>
  [...(value ?? "")]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c))
    .join("")
    .trim()
    .slice(0, max);

export function previewTags(search: URLSearchParams, origin: string) {
  const name = clean(search.get("name"));
  const place = [clean(search.get("region")), clean(search.get("country"))]
    .filter(Boolean)
    .join(", ");
  const km = Number(search.get("km"));
  const size = Number.isFinite(km) && km > 0 && km <= 100 ? `${km} km` : "";
  const lat = Number(search.get("lat"));
  const lon = Number(search.get("lon"));
  const where =
    Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(4)}°, ${lon.toFixed(4)}°` : "";
  const title = `${name || "A place on Earth"} · 3D plate · Tee Tang Art`;
  const description = [
    [place, size && `${size} square`, where].filter(Boolean).join(" · "),
    "Turn it in 3D, print it, or make it your own: free, no sign-up.",
  ]
    .filter(Boolean)
    .join(". ");
  const url = `${origin}/plate?${search.toString()}`;
  return { title, description, url };
}

export function injectTags(html: string, tags: ReturnType<typeof previewTags>): string {
  const title = escapeHtml(tags.title);
  const description = escapeHtml(tags.description);
  const url = escapeHtml(tags.url);
  const replaceMeta = (source: string, attribute: string, key: string, value: string) =>
    source.replace(
      new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`, "i"),
      `$1${value}$2`,
    );
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  out = replaceMeta(out, "property", "og:title", title);
  out = replaceMeta(out, "property", "og:url", url);
  out = replaceMeta(out, "name", "twitter:title", title);
  // Descriptions in index.html span several lines: name/property, then content.
  out = out.replace(
    /(<meta\s+(?:name="description"|property="og:description"|name="twitter:description")\s+content=")[^"]*(")/gi,
    `$1${description}$2`,
  );
  return out;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = await fetch(new URL("/index.html", url.origin));
  if (!page.ok) return page;
  const html = injectTags(await page.text(), previewTags(url.searchParams, "https://teetang.art"));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
