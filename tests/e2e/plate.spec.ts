import type { Page } from "@playwright/test";
import { auditTouchSizes, expect, settleAnimations, test } from "./fixtures";
import { serveTiles, SUMMIT_METRES } from "./plateTiles";

// CI machines have no GPU. The plate needs WebGL, so these tests (and only
// these: the editor's map would render slowly in software and time out) get
// SwiftShader.
test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function openPlate(page: Page, path = "/plate") {
  // Software WebGL is slow on CI machines; without the opening spin the plate
  // only redraws when something changes, as it does on a phone after a touch.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveTiles(page);
  await page.goto(path);
  await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true", {
    timeout: 20_000,
  });
}

const highest = async (page: Page) =>
  Number(
    (await page.locator(".plate-place__meta").innerText()).match(/([\d,]+) m/)![1].replace(",", ""),
  );

test.describe("3D plate", () => {
  test("shows the default place with its highest point", async ({ page }) => {
    await openPlate(page);
    await expect(page.locator(".plate-place__name")).toHaveText("Phnom Aural");
    // The synthetic mountain is 1,500 m; smoothing may shave a few metres off.
    expect(await highest(page)).toBeGreaterThan(SUMMIT_METRES - 40);
    expect(await highest(page)).toBeLessThanOrEqual(SUMMIT_METRES);
  });

  test("fits the phone and meets touch and text minimums", async ({ page }) => {
    await openPlate(page);
    const main = await auditTouchSizes(page);
    expect(main.overflowsSideways).toBe(false);
    expect.soft(main.smallTargets, "plate: tap targets").toEqual([]);
    expect.soft(main.smallInputs, "plate: fields").toEqual([]);
    expect.soft(main.tinyText, "plate: text").toEqual([]);

    await page.getByRole("button", { name: "Adjust" }).click();
    await settleAnimations(page);
    const sheet = await auditTouchSizes(page);
    expect.soft(sheet.smallTargets, "adjust: tap targets").toEqual([]);
    expect.soft(sheet.smallInputs, "adjust: fields").toEqual([]);
    expect.soft(sheet.tinyText, "adjust: text").toEqual([]);
  });

  test("a share link reopens the same plate", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPlate(page);
    await page.getByRole("button", { name: "Print" }).click();
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: "Hexagon" }).click();
    await page.locator(".plate-sheet__header button").click();

    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    await expect(page.locator(".app-toast--success")).toContainText("Link copied");
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/^https:\/\/teetang\.art\/plate\?/);
    expect(link).toContain("style=print");
    expect(link).toContain("shape=hexagon");

    // Open it fresh, without the saved draft.
    await page.evaluate(() => localStorage.removeItem("teetangart.plate.v1"));
    await openPlate(page, new URL(link).pathname + new URL(link).search);
    await expect(page.getByRole("button", { name: "Print" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.getByRole("button", { name: "Hexagon" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("downloads a PNG, contour SVG and a valid STL", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const save = async (kind: string) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator(`.plate-download[data-kind=${kind}]`).click(),
      ]);
      expect(download.suggestedFilename()).toBe(`teetang-plate-phnom-aural.${kind}`);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    };

    const pngFile = await save("png");
    expect(pngFile.subarray(1, 4).toString()).toBe("PNG");

    const svg = (await save("svg")).toString();
    expect(svg).toContain('<g id="index-contours"');
    expect(svg.match(/<path /g)!.length).toBeGreaterThan(10);

    const stl = await save("stl");
    const triangles = stl.readUInt32LE(80);
    expect(triangles).toBeGreaterThan(1000);
    expect(stl.length).toBe(84 + triangles * 50);
    await expect(page.locator(".app-toast--success").first()).toBeVisible();
  });

  test("satellite imagery loads and is credited", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Satellite" }).click();
    await expect(page.locator(".plate-stage__pill")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".app-toast--error")).toHaveCount(0);
    await expect(page.locator(".plate-credit")).toContainText("Sentinel-2");
  });

  test("falls back to the drawing when imagery is unavailable", async ({ page }) => {
    await openPlate(page);
    await page.unroute(/tiles\.maps\.eox\.at/);
    await page.getByRole("button", { name: "Satellite" }).click();
    await expect(page.locator(".app-toast--error")).toContainText("shows Drawing");
    await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true");
  });

  test("recovers when elevation data comes back", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/plate");
    await expect(page.getByRole("alert")).toContainText("Couldn't load the terrain");
    await serveTiles(page);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true");
  });

  test("Move picks a new square and Surprise me jumps somewhere new", async ({ page }) => {
    await openPlate(page);
    await page.locator(".plate-move").click();
    await expect(page.locator(".area-picker__square")).toBeVisible();
    // The map must fill the stage (MapLibre's own CSS once collapsed it to 0 px).
    const map = await page.locator(".area-picker__map").boundingBox();
    const stage = await page.locator(".plate-stage").boundingBox();
    expect(map!.height).toBeGreaterThan(stage!.height * 0.9);

    // Base map and shading are remembered for next time.
    await page.locator(".area-picker__bases").getByRole("button", { name: "Satellite" }).click();
    await page.locator(".plate-dim input").fill("0.5");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("teetangart.plate.picker")))
      .toBe(JSON.stringify({ base: "satellite", dim: 0.5 }));

    await page.getByRole("button", { name: "25 km" }).click();
    await expect(page.locator(".area-picker__size")).toHaveText("25 km");
    await page.getByRole("button", { name: "Show plate" }).click();
    await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true");
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("teetangart.plate.v1") ?? "{}").sizeKm),
      )
      .toBe(25);

    await page.getByRole("button", { name: "Surprise me" }).click();
    await expect(page.locator(".plate-place__name")).not.toHaveText("Phnom Aural");
  });

  test("Move uses Google tiles for Map and Satellite when the site has a key", async ({ page }) => {
    const tiles: string[] = [];
    await page.route(/\/api\/google\?/, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has("status")) return route.fulfill({ json: { enabled: true } });
      if (url.searchParams.has("viewport")) {
        return route.fulfill({ json: { copyright: "Map data ©2026 Google" } });
      }
      tiles.push(url.search);
      return route.fulfill({ status: 404 });
    });
    await openPlate(page);
    await page.locator(".plate-move").click();

    await expect.poll(() => tiles.some((q) => q.includes("t=roadmap&l=en"))).toBe(true);
    await expect(page.locator(".area-picker__credit")).toContainText("Google");
    await expect(page.locator(".area-picker__credit")).toContainText("Map data ©2026 Google");

    const bases = page.locator(".area-picker__bases");
    await bases.getByRole("button", { name: "Satellite" }).click();
    await expect.poll(() => tiles.some((q) => q.includes("t=satellite"))).toBe(true);

    // Terrain stays on OpenTopoMap, without the Google credit.
    await bases.getByRole("button", { name: "Terrain" }).click();
    await expect(page.locator(".area-picker__credit")).toHaveCount(0);
  });

  test("every shape builds a plate and survives a share link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPlate(page);
    await page.getByRole("button", { name: "Elevation" }).click();
    await page.getByRole("button", { name: "Adjust" }).click();
    const shapes = page.locator(".plate-shape");
    await expect(shapes).toHaveCount(8);
    for (let k = 0; k < 8; k++) {
      await shapes.nth(k).click();
      await expect(shapes.nth(k)).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.locator(".plate-sheet__header button").click();

    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain("shape=star");
    expect(link).toContain("style=elevation");
    expect(link).toContain("lines=more");
    await expect(page.locator(".app-toast--error")).toHaveCount(0);
  });
});
