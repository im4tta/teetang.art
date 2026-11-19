import type { Page } from "@playwright/test";
import { auditTouchSizes, expect, settleAnimations, test } from "./fixtures";
import sharp from "sharp";
import { serveTiles, splitTile, SUMMIT_METRES } from "./plateTiles";

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

  test("a draped map keeps north at the far side of the plate", async ({ page }) => {
    // A topographic map that is red north of the summit and blue south of it.
    await page.route(/opentopomap\.org\/(\d+)\/(\d+)\/(\d+)\.png$/, (route) => {
      const [, z, , y] = route
        .request()
        .url()
        .match(/(\d+)\/(\d+)\/(\d+)\.png$/)!
        .map(Number);
      return route.fulfill({
        body: splitTile(z, y),
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      });
    });
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&style=topo&label=0");
    await expect(page.locator(".plate-stage__pill")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".plate-credit")).toContainText("OpenTopoMap");
    const shot = await page.locator(".plate-canvas").screenshot();
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const hue = (fy: number) => {
      const k =
        (Math.round(info.height * fy) * info.width + Math.round(info.width / 2)) * info.channels;
      return data[k] > data[k + 2] ? "red" : "blue";
    };
    // The camera looks north, so the far (upper) half is north.
    expect(hue(0.38)).toBe("red");
    expect(hue(0.62)).toBe("blue");
  });

  test("the nameplate is part of the STL", async ({ page }) => {
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&name=Phnom%20Aural&label=0");
    const stlTriangles = async () => {
      await page.getByRole("button", { name: "Download", exact: true }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator(".plate-download[data-kind=stl]").click(),
      ]);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      await page.locator(".plate-sheet__header button").click();
      return Buffer.concat(chunks).readUInt32LE(80);
    };
    const plain = await stlTriangles();
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("checkbox", { name: "Name in front of the plate" }).check();
    await page.getByRole("checkbox", { name: "Pin on the summit" }).check();
    await page.locator(".plate-sheet__header button").click();
    // The nameplate is built a moment after a change.
    await expect.poll(stlTriangles, { timeout: 15_000 }).toBeGreaterThan(plain + 5_000);
  });

  test("the STL Studio checks the model and exports STL and 3MF", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "STL Studio" }).click();
    await expect(page).toHaveURL(/\/plate\/studio$/);
    await expect(page.locator(".studio-canvas")).toHaveAttribute("data-ready", "true", {
      timeout: 20_000,
    });
    // Terrain, nameplate and every other part close into solids a slicer accepts.
    await expect(page.locator(".studio-check")).toHaveAttribute("data-ok", "true", {
      timeout: 30_000,
    });
    await expect(page.locator(".studio-dims")).toContainText("100 ×");

    await page.getByLabel("Width").fill("150");
    await expect(page.locator(".studio-dims")).toContainText("150 ×");
    await page.getByRole("button", { name: "3", exact: true }).click();
    await expect(page.locator(".studio-band")).toHaveCount(3);

    const save = async (name: string) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name }).click(),
      ]);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return { name: download.suggestedFilename(), file: Buffer.concat(chunks) };
    };
    const stl = await save("Download STL");
    expect(stl.name).toBe("teetang-phnom-aural-150mm.stl");
    const triangles = stl.file.readUInt32LE(80);
    expect(stl.file.length).toBe(84 + triangles * 50);
    // Every corner lies on or above the bed and inside the width.
    let lowest = Infinity;
    let widest = 0;
    for (let k = 0; k < triangles; k += 97) {
      for (let c = 0; c < 3; c++) {
        const at = 84 + k * 50 + 12 + c * 12;
        widest = Math.max(widest, Math.abs(stl.file.readFloatLE(at)));
        lowest = Math.min(lowest, stl.file.readFloatLE(at + 8));
      }
    }
    expect(lowest).toBeGreaterThanOrEqual(-0.001);
    expect(widest).toBeLessThanOrEqual(75.01);

    const threeMf = await save("Download 3MF");
    expect(threeMf.name).toBe("teetang-phnom-aural-150mm.3mf");
    expect(threeMf.file.subarray(0, 2).toString()).toBe("PK");
    expect(threeMf.file.includes(Buffer.from("3D/3dmodel.model"))).toBe(true);
  });
});
