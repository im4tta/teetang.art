import type { Page } from "@playwright/test";
import { auditTouchSizes, expect, settleAnimations, test } from "./fixtures";
import sharp from "sharp";
import { serveTiles, splitTile, SUMMIT_METRES } from "./plateTiles";
import { serveBuilding } from "./vectorTiles";

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
  // SLOW_CPU=6 npx playwright test … makes a fast machine draw as slowly as a CI runner or an old phone.
  const slow = Number(process.env.SLOW_CPU ?? 0);
  if (slow > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
  }
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

  test("fits the phone and meets touch and text minimums", { tag: "@layout" }, async ({ page }) => {
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

    const glb = await save("glb");
    expect(glb.subarray(0, 4).toString()).toBe("glTF");
    expect(glb.includes(Buffer.from('"name":"Terrain"'))).toBe(true);

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

  test(
    "Move picks a new square and Surprise me jumps somewhere new",
    { tag: "@layout" },
    async ({ page }) => {
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
          page.evaluate(
            () => JSON.parse(localStorage.getItem("teetangart.plate.v1") ?? "{}").sizeKm,
          ),
        )
        .toBe(25);

      await page.getByRole("button", { name: "Surprise me" }).click();
      await expect(page.locator(".plate-place__name")).not.toHaveText("Phnom Aural");
    },
  );

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

  test("Photo builds the ray-traced scene and starts rendering", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Photo" }).click();
    // "Rendering" means the scene, its ray-tracing structure and shaders all built.
    // Nothing after that is checked: CI has no GPU, and tracing on the CPU blocks
    // the page for seconds at a time, starving Playwright's polling and clicks.
    // So poll with plain pauses, and stop once rendering has started.
    const status = page.locator(".plate-photo__status");
    let text = "";
    for (let k = 0; k < 15 && !text.includes("Rendering"); k++) {
      await page.waitForTimeout(2000);
      text = await status.innerText();
    }
    expect(text).toContain("Rendering");
  });
});

test.describe("3D plate extras", () => {
  test("seasons, Vintage, keyboard control and a gift card", async ({ page }) => {
    await openPlate(
      page,
      "/plate?lat=12.0333&lon=104.1667&name=Phnom%20Aural&style=vintage&snow=0.7&flood=250",
    );
    await expect(page.getByRole("button", { name: "Vintage" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const canvas = page.locator(".plate-canvas");
    // Screen readers hear where the summit is.
    await expect(canvas).toHaveAttribute("aria-label", /Highest point 1,\d{3} m, near the centre/);
    await canvas.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("+");

    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.getByRole("checkbox", { name: "Snow on the peaks" })).toBeChecked();
    await expect(page.locator("#plate-flood")).toHaveValue("250");
    await page.locator(".plate-sheet__header button").click();

    await page.getByRole("button", { name: "Download", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".plate-download[data-kind=card]").click(),
    ]);
    expect(download.suggestedFilename()).toBe("teetang-card-phnom-aural.png");
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    const png = Buffer.concat(chunks);
    // 6 × 4 inches at 300 dpi.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1800, 1200]);
  });
});

test.describe("fly-over video", () => {
  test("records a square video circling the plate", async ({ page }) => {
    test.setTimeout(60_000);
    await openPlate(page);
    await expect(page.getByRole("button", { name: "Download", exact: true })).toBeEnabled({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 45_000 }),
      page.locator(".plate-download[data-kind=video]").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^teetang-flyover-phnom-aural\.(mp4|webm)$/);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).length).toBeGreaterThan(10_000);
    // The camera is handed back afterwards.
    await expect(page.getByRole("button", { name: "Photo" })).toBeVisible();
  });
});

test.describe("explore, classroom and offline", () => {
  test("open a curated place, compare, take the lesson and save offline", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("button", { name: /^Phnom Kulen/ }).click();
    await expect(page.locator(".plate-place__name")).toHaveText("Phnom Kulen");
    await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true", {
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("button", { name: "Compare side by side with Mount Fuji" }).click();
    await page.getByRole("button", { name: "Explore" }).click();
    await expect(page.locator(".plate-explore-comparing")).toContainText("Mount Fuji");
    await page.getByRole("button", { name: "Stop comparing" }).click();

    await page.getByRole("button", { name: "Classroom: how contour lines work" }).click();
    const lesson = page.getByRole("dialog", { name: "Classroom: how contour lines work" });
    await expect(lesson).toContainText("1 / 4");
    for (const step of ["2 / 4", "3 / 4", "4 / 4"]) {
      await lesson.getByRole("button", { name: "Next" }).click();
      await expect(lesson).toContainText(step);
    }
    await lesson.getByRole("button", { name: "Finish" }).click();
    await expect(lesson).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Download", exact: true })).toBeEnabled({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("button", { name: "Save this plate for offline use" }).click();
    await expect(page.locator(".app-toast--success")).toContainText("opens offline");
    await expect(page.locator(".plate-explore-saved")).toContainText("Phnom Kulen");
    // The tiles are in the offline cache that the service worker reads.
    const cached = await page.evaluate(
      async () => (await (await caches.open("teetangart-offline-v1")).keys()).length,
    );
    expect(cached).toBeGreaterThan(0);
  });
});

test.describe("Khmer names and the review page", () => {
  test("a Cambodian place shows and prints its Khmer name", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("button", { name: /^Phnom Kulen/ }).click();
    await expect(page.locator(".plate-place__khmer")).toHaveText("ភ្នំគូលែន");
    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.getByLabel("Khmer name (on the nameplate)")).toHaveValue("ភ្នំគូលែន");
  });

  test("the translation review page lists texts and exports corrections", async ({ page }) => {
    await page.goto("/translations");
    const rows = page.locator(".translations-table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(100);
    await page.getByLabel("Correction for plate.title").fill("ផ្ទាំងដីបីវិមាត្រ");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download 1 correction/ }).click(),
    ]);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");
    expect(csv).toContain('"plate.title","3D Plate"');
    expect(csv).toContain("ផ្ទាំងដីបីវិមាត្រ");
  });
});

test.describe("light and seasons", () => {
  test("time of day, and a satellite picture from a chosen season", async ({ page }) => {
    const requested: string[] = [];
    await page.route(/gibs\.earthdata\.nasa\.gov/, (route) => {
      requested.push(route.request().url());
      return route.abort();
    });
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&style=elevation&sun=7");
    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.locator("#plate-sun")).toHaveValue("7");
    await expect(page.locator(".plate-field__value", { hasText: "07:00" })).toBeVisible();
    await page.getByRole("button", { name: "Studio light" }).click();
    await expect(page.locator(".plate-field__value", { hasText: "Studio light" })).toBeVisible();
    await page.locator(".plate-sheet__header button").click();

    await page.getByRole("button", { name: "Satellite" }).click();
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: /NASA by date/ }).click();
    await page.getByRole("button", { name: "Dry season" }).click();
    await expect.poll(() => requested.some((url) => /\/\d{4}-02-15\//.test(url))).toBe(true);
  });
});

test.describe("buildings", () => {
  test("OpenStreetMap buildings stand up out of the terrain and print", async ({ page }) => {
    // A 100 m tower on the summit.
    await serveBuilding(page, 12.0333, 104.1667, 100);
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&km=4&name=Phnom%20Aural&label=0");
    const tallest = async () => {
      await page.getByRole("button", { name: "Download", exact: true }).click();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator(".plate-download[data-kind=stl]").click(),
      ]);
      const chunks: Buffer[] = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
      await page.locator(".plate-sheet__header button").click();
      const stl = Buffer.concat(chunks);
      let top = 0;
      for (let k = 0; k < stl.readUInt32LE(80); k++) {
        for (let c = 0; c < 3; c++) top = Math.max(top, stl.readFloatLE(84 + k * 50 + 20 + c * 12));
      }
      return top;
    };
    const before = await tallest();
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("checkbox", { name: "Buildings (OpenStreetMap)" }).check();
    await page.locator(".plate-sheet__header button").click();
    // 100 m at twice its height on a 4 km plate 100 mm wide: about 5 mm taller.
    await expect.poll(tallest, { timeout: 20_000 }).toBeGreaterThan(before + 3);
  });
});

test.describe("STL Studio print options", () => {
  test("hollow base, tiles and a lithophane", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "STL Studio" }).click();
    await expect(page.locator(".studio-canvas")).toHaveAttribute("data-ready", "true", {
      timeout: 20_000,
    });
    await page.getByText("More ways to print").click();
    await page.getByRole("checkbox", { name: "Hollow base with a hanging lip" }).check();
    // Still one closed solid, and lighter than before.
    await expect(page.locator(".studio-check")).toHaveAttribute("data-ok", "true", {
      timeout: 30_000,
    });

    const save = async (name: string) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name }).click(),
      ]);
      const chunks: Buffer[] = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
      return { name: download.suggestedFilename(), file: Buffer.concat(chunks) };
    };
    await page.getByRole("button", { name: "2 × 2" }).click();
    const tiles = await save("Download tiles (ZIP)");
    expect(tiles.name).toBe("teetang-phnom-aural-100mm-tiles-2x2.zip");
    expect(tiles.file.subarray(0, 2).toString()).toBe("PK");
    for (const tile of ["tile-r1-c1.stl", "tile-r2-c2.stl", "README.txt"]) {
      expect(tiles.file.includes(Buffer.from(tile))).toBe(true);
    }

    const litho = await save("Download lithophane (STL)");
    const triangles = litho.file.readUInt32LE(80);
    expect(triangles).toBeGreaterThan(100_000);
    expect(litho.file.length).toBe(84 + triangles * 50);
  });
});

test.describe("STL Studio finishing", () => {
  test("joining pins, an engraved underside and a colour-change guide", async ({ page }) => {
    test.setTimeout(90_000);
    await openPlate(page);
    await page.getByRole("button", { name: "STL Studio" }).click();
    await expect(page.locator(".studio-canvas")).toHaveAttribute("data-ready", "true", {
      timeout: 20_000,
    });
    const save = async (name: string | RegExp) => {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.getByRole("button", { name }).click(),
      ]);
      const chunks: Buffer[] = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    };

    const plain = (await save("Download STL")).readUInt32LE(80);
    await page.getByText("Underneath").click();
    await page.getByLabel("Message under the base").fill("From the summit");
    await page.getByRole("checkbox", { name: "QR code to this plate" }).check();
    const engraved = (await save("Download STL")).readUInt32LE(80);
    // The letters and QR modules add many small faces.
    expect(engraved).toBeGreaterThan(plain + 1_000);

    await page.getByText("More ways to print").click();
    await page.getByRole("button", { name: "2 × 2" }).click();
    await expect(page.getByRole("checkbox", { name: "Joining pins" })).toBeChecked();
    const zip = await save("Download tiles (ZIP)");
    expect(zip.includes(Buffer.from("dowel-pin.stl"))).toBe(true);
    expect(zip.includes(Buffer.from("Print dowel-pin.stl 8 times"))).toBe(true);

    await page.getByRole("button", { name: "3", exact: true }).click();
    const guide = (await save("Download colour-change guide")).toString("utf8");
    expect(guide).toContain("layer");
    expect(guide).toContain("M600");
  });
});

test.describe("trips, photos and embedding", () => {
  const gpx = (shift: number) =>
    `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${Array.from({ length: 40 }, (_, k) => {
      const t = k / 39;
      return `<trkpt lat="${(12.01 + shift + t * 0.02).toFixed(6)}" lon="${(104.15 + t * 0.02).toFixed(6)}"/>`;
    }).join("")}</trkseg></trk></gpx>`;

  test("a two-day trip, and a photo on a pin", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Route & pins" }).click();
    const file = page.locator(".plate-sheet input[type=file][accept^='.gpx']");
    await file.setInputFiles({
      name: "day1.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx(0)),
    });
    await expect(page.locator(".plate-days li")).toHaveCount(1);
    await page.getByRole("button", { name: "Add another day" }).click();
    await file.setInputFiles({
      name: "day2.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx(0.01)),
    });
    await expect(page.locator(".plate-days li")).toHaveCount(2);
    await page.getByRole("button", { name: "Day 2", exact: true }).click();
    await expect(page.getByRole("button", { name: "Day 2", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".plate-profile svg")).toContainText("km");

    await page.getByRole("button", { name: "Add a pin: tap the plate" }).click();
    const box = (await page.locator(".plate-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
    await expect(page.locator(".plate-marker-row")).toHaveCount(1);
    // A tiny PNG made on a canvas stands in for a phone photo.
    const png = await page.evaluate(async () => {
      const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 48 });
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#2f9e44";
      ctx.fillRect(0, 0, 64, 48);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png"),
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    });
    await page
      .locator(".plate-marker-photo input[type=file]")
      .setInputFiles({ name: "summit.png", mimeType: "image/png", buffer: Buffer.from(png) });
    await expect(page.locator(".plate-marker-photo")).toHaveAttribute("data-has-photo", "true");
  });

  test("embed code opens the plate alone and leaves the visitor's draft alone", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&name=Phnom%20Aural&style=print");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=embed]").click();
    await expect(page.locator(".app-toast--success")).toContainText("Embed code copied");
    const snippet = await page.evaluate(() => navigator.clipboard.readText());
    expect(snippet).toMatch(/^<iframe src="https:\/\/teetang\.art\/plate\/embed\?/);
    const src = new URL(snippet.match(/src="([^"]+)"/)![1].replace(/&amp;/g, "&"));

    const draft = await page.evaluate(() => localStorage.getItem("teetangart.plate.v1"));
    await openPlate(page, `${src.pathname}${src.search}`);
    await expect(page.locator(".plate-header")).toHaveCount(0);
    await expect(page.locator(".plate-panel")).toHaveCount(0);
    await expect(page.locator(".plate-embed-open")).toContainText("Phnom Aural");
    await expect(page).toHaveURL(/\/plate\/embed\?/);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => localStorage.getItem("teetangart.plate.v1"))).toBe(draft);
  });
});

test.describe("Khmer search and lessons", () => {
  test("searching in Khmer finds the place and keeps its Khmer name", async ({ page }) => {
    const queries: string[] = [];
    await page.route(/nominatim\.openstreetmap\.org\/search/, (route) => {
      queries.push(route.request().url());
      return route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify([
          {
            place_id: 1,
            lat: "13.565",
            lon: "104.1",
            type: "mountain",
            display_name: "Phnom Kulen, Siem Reap, Cambodia",
            address: { state: "Siem Reap", country: "Cambodia", country_code: "kh" },
            namedetails: { name: "Phnom Kulen", "name:km": "ភ្នំគូលែន" },
          },
        ]),
      });
    });
    await openPlate(page);
    await page.getByPlaceholder("Search any place on Earth").fill("ភ្នំគូលែន");
    const result = page.locator(".plate-search__result").first();
    await expect(result).toContainText("Phnom Kulen");
    await expect(result.locator(".plate-search__khmer")).toContainText("ភ្នំគូលែន");
    expect(queries[0]).toContain("namedetails=1");
    await result.click();
    await expect(page.locator(".plate-place__name")).toHaveText("Phnom Kulen");
    await expect(page.locator(".plate-place__khmer")).toHaveText("ភ្នំគូលែន");
  });

  test("the flood lesson opens the Tonlé Sap and raises the water", async ({ page }) => {
    await openPlate(page);
    await page.getByRole("button", { name: "Explore" }).click();
    await page.getByRole("button", { name: "The rainy-season flood" }).click();
    await expect(page.locator(".plate-place__name")).toHaveText("Tonlé Sap");
    const lesson = page.getByRole("dialog", { name: "The rainy-season flood" });
    await expect(lesson).toContainText("1 / 3");
    await lesson.getByRole("button", { name: "Next" }).click();
    await expect(lesson).toContainText("flows backwards");
    await lesson.getByRole("button", { name: "Next" }).click();
    await lesson.getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Adjust" }).click();
    await expect(page.locator(".plate-field__value", { hasText: "+9 m" })).toBeVisible();
  });
});

test.describe("3D plate on a computer", () => {
  test.use({ viewport: { width: 1300, height: 820 }, isMobile: false, hasTouch: false });

  test("the hint names the mouse gestures, and the keyboard moves the plate", async ({ page }) => {
    await openPlate(page);
    await expect(page.locator(".plate-stage__hint")).toHaveText(
      "Drag to turn · scroll to zoom · right-drag to move",
    );
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);

    await page.locator(".plate-canvas").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(page.getByRole("button", { name: "Re-centre" })).toBeVisible();

    await page.keyboard.press("0");
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);

    // Plain arrows still only turn the plate.
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);
  });

  test("the mouse wheel scrolls the style row sideways", async ({ page }) => {
    await openPlate(page);
    const row = page.getByRole("group", { name: "Style" });
    const scroll = () => row.evaluate((el) => [el.scrollLeft, el.scrollWidth - el.clientWidth]);
    const [start, max] = await scroll();
    expect(max, "the six styles overflow the panel").toBeGreaterThan(20);
    expect(start).toBe(0);
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await scroll())[0]).toBeGreaterThan(0);
    // Picking the last style keeps it in view.
    await page.mouse.wheel(0, -1000);
    await expect.poll(async () => (await scroll())[0]).toBe(0);
    await page.getByRole("button", { name: "Satellite" }).click({ force: true });
    await expect(page.getByRole("button", { name: "Satellite" })).toBeInViewport({ ratio: 0.9 });
  });

  test("a GPX track, a pin and a measured profile", async ({ page }) => {
    const points = Array.from({ length: 60 }, (_, k) => {
      const t = k / 59;
      return `<trkpt lat="${(12.005 + t * 0.028).toFixed(6)}" lon="${(104.14 + t * 0.026).toFixed(6)}"/>`;
    });
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Summit trail</name><trkseg>${points.join("")}</trkseg></trk></gpx>`;
    await openPlate(page);
    await page.getByRole("button", { name: "Route & pins" }).click();
    await page.locator(".plate-sheet input[type=file]").setInputFiles({
      name: "trail.gpx",
      mimeType: "application/gpx+xml",
      buffer: Buffer.from(gpx),
    });
    await expect(page.locator(".app-toast--success")).toContainText("Track added");
    // The plate moved to fit the track, and the track's profile is ready.
    await expect(page.locator(".plate-profile svg")).toContainText("km");

    await page.getByRole("button", { name: "Add a pin: tap the plate" }).click();
    const box = (await page.locator(".plate-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
    await expect(page.locator(".plate-marker-row input[type=text]")).toHaveValue("Pin 1");

    await page.getByRole("button", { name: "Draw a line: tap two points" }).click();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.45);
    await expect(page.locator(".plate-profile svg")).toContainText("Measured line");

    // Pins and the track travel in share links.
    const draft = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("teetangart.plate.v1")!),
    );
    expect(draft.markers).toHaveLength(1);
    expect(draft.route.length).toBeGreaterThan(20);
  });
});

test.describe("stage text and moving the plate", () => {
  const rect = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });

  test("the drag hint never overlaps the data credits, however long they are", async ({ page }) => {
    // Satellite and buildings give the longest credit: three lines on a phone.
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&style=satellite&bld=1&km=3");
    await expect(page.locator(".plate-stage__hint")).toBeVisible();
    await expect(page.locator(".plate-credit")).toContainText("OpenStreetMap");
    const credit = await rect(page, ".plate-credit");
    const hint = await rect(page, ".plate-stage__hint");
    expect(credit.bottom - credit.top).toBeGreaterThan(30); // it does wrap
    expect(hint.bottom).toBeLessThanOrEqual(credit.top);
    // And the hint stays inside the stage.
    const stage = await rect(page, ".plate-stage");
    expect(hint.left).toBeGreaterThanOrEqual(stage.left);
    expect(hint.right).toBeLessThanOrEqual(stage.right);
  });

  /** Two fingers on the canvas move together, keeping their distance, like a drag. */
  async function twoFingerDrag(page: Page, dx: number, dy: number, steps = 3) {
    const box = (await page.locator(".plate-canvas").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const client = await page.context().newCDPSession(page);
    const points = (shiftX: number, shiftY: number) => [
      { x: cx - 40 + shiftX, y: cy + shiftY, id: 1 },
      { x: cx + 40 + shiftX, y: cy + shiftY, id: 2 },
    ];
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(0, 0),
    });
    // Each move redraws the plate, which is slow in software; a few steps are enough.
    for (let step = 1; step <= steps; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points((dx * step) / steps, (dy * step) / steps),
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  test("two fingers move the plate, and Re-centre brings it back", async ({ page }) => {
    await openPlate(page);
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);

    await twoFingerDrag(page, 90, -50);
    await expect(page.getByRole("button", { name: "Re-centre" })).toBeVisible();

    await page.getByRole("button", { name: "Re-centre" }).click();
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);
  });

  test("one finger only turns the plate", async ({ page }) => {
    await openPlate(page);
    const box = (await page.locator(".plate-canvas").boundingBox())!;
    const before = await page.locator(".plate-canvas").screenshot();
    const client = await page.context().newCDPSession(page);
    const at = (x: number) => [{ x, y: box.y + box.height / 2, id: 1 }];
    const from = box.x + box.width / 2 - 60;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(from) });
    // A few big moves: each one waits for a redraw, which is slow in software.
    for (let step = 1; step <= 3; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: at(from + step * 40),
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // The plate was turned (the picture changed) but not moved.
    await expect
      .poll(async () => !before.equals(await page.locator(".plate-canvas").screenshot()), {
        timeout: 20_000,
        intervals: [500, 1000],
      })
      .toBe(true);
    await expect(page.getByRole("button", { name: "Re-centre" })).toHaveCount(0);
  });

  /** Share of the canvas that is not the empty background (the plate, its box and shadow). */
  async function paintedShare(page: Page) {
    const { data, info } = await sharp(await page.locator(".plate-canvas").screenshot())
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (k: number) => [data[k], data[k + 1], data[k + 2], data[k + 3]];
    const background = pixel(0);
    let painted = 0;
    for (let k = 0; k < data.length; k += info.channels) {
      const p = pixel(k);
      if (p.some((value, c) => Math.abs(value - background[c]) > 12)) painted++;
    }
    return painted / (info.width * info.height);
  }

  test("a moved plate cannot be dragged out of reach", async ({ page }) => {
    await openPlate(page);
    const before = await paintedShare(page);
    expect(before).toBeGreaterThan(0.03);
    // One drag several times longer than the stage is wide: far past the limit.
    // (Each touch event waits for a redraw, so a single drag keeps this light in software.)
    await twoFingerDrag(page, 1500, 0, 3);
    await expect(page.getByRole("button", { name: "Re-centre" })).toBeVisible();
    // The plate is still in view: a good part of the canvas is still painted.
    await expect
      .poll(async () => (await paintedShare(page)) > before * 0.5, { timeout: 20_000 })
      .toBe(true);
  });
});

test.describe("the sun sweep", () => {
  const clock = async (page: Page) => (await page.locator("#plate-sun").inputValue()) as string;

  test("plays the sun across the day, and pausing or dragging stops it", async ({ page }) => {
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&km=10&sun=7");
    await page.getByRole("button", { name: "Adjust" }).click();
    const start = Number(await clock(page));
    expect(start).toBe(7);

    await page.getByRole("button", { name: "Play the sun across the day" }).click();
    await expect
      .poll(async () => Number(await clock(page)), { timeout: 15_000 })
      .toBeGreaterThan(start + 0.5);

    await page.getByRole("button", { name: "Pause the sun" }).click();
    const paused = Number(await clock(page));
    await page.waitForTimeout(1200);
    expect(Number(await clock(page))).toBe(paused);

    // Dragging the slider takes over from a playing sun.
    await page.getByRole("button", { name: "Play the sun across the day" }).click();
    await page.locator("#plate-sun").fill("9");
    await page.waitForTimeout(1200);
    expect(Number(await clock(page))).toBe(9);
    await expect(page.getByRole("button", { name: "Play the sun across the day" })).toBeVisible();
  });

  test("starts at sunrise from studio light, and stops at sunset", async ({ page }) => {
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&km=10");
    await page.getByRole("button", { name: "Adjust" }).click();
    await page.getByRole("button", { name: "Play the sun across the day" }).click();
    await expect.poll(async () => Number(await clock(page))).toBeGreaterThanOrEqual(6);
    expect(Number(await clock(page))).toBeLessThan(8);

    // Near the end of the day it runs out and the button goes back to Play.
    await page.getByRole("button", { name: "Pause the sun" }).click();
    await page.locator("#plate-sun").fill("17.5");
    await page.getByRole("button", { name: "Play the sun across the day" }).click();
    await expect(page.getByRole("button", { name: "Play the sun across the day" })).toBeVisible({
      timeout: 15_000,
    });
    expect(Number(await clock(page))).toBe(18);
  });
});
