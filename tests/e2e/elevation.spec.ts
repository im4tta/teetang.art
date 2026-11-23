import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { serveTiles, SUMMIT_METRES } from "./plateTiles";
import {
  COPERNICUS_PEAK,
  SUMMIT,
  serve3dep,
  serveCopernicus,
  serveOpenTopography,
} from "./demTiles";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function openPlate(page: Page, path = "/plate") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveTiles(page);
  await page.goto(path);
  await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true", {
    timeout: 20_000,
  });
}

/** The highest point in metres, or 0 while the plate is still loading. */
const highest = async (page: Page) => {
  const match = (await page.locator(".plate-place__meta").innerText()).match(/([\d,]+) m/);
  return match ? Number(match[1].replace(",", "")) : 0;
};

const openAdjust = async (page: Page) => {
  await page.getByRole("button", { name: "Adjust" }).click();
};

const pick = (page: Page, name: RegExp) => page.getByRole("button", { name }).click();

test.describe("elevation sources", () => {
  test("says which dataset the worldwide tiles used here", async ({ page }) => {
    await openPlate(page);
    await expect(page.locator(".plate-credit")).toContainText("SRTM (NASA) via AWS Terrain Tiles");
    await openAdjust(page);
    await expect(page.getByTestId("elevation-using")).toContainText("SRTM (NASA)");
    // 30 m data is the weak spot, so the sheet points at an independent model.
    await expect(page.getByText("independent 30 m model")).toBeVisible();
  });

  test("Copernicus GLO-30 builds the plate from ranged reads of its tiles", async ({ page }) => {
    const requests = await serveCopernicus(page);
    await openPlate(page);
    expect(await highest(page)).toBeLessThanOrEqual(SUMMIT_METRES);

    await openAdjust(page);
    await pick(page, /^Copernicus GLO-30/);
    await expect
      .poll(() => highest(page), { timeout: 20_000 })
      .toBeGreaterThan(COPERNICUS_PEAK - 60);
    expect(await highest(page)).toBeLessThanOrEqual(COPERNICUS_PEAK);

    await expect(page.getByTestId("elevation-using")).toContainText("Copernicus DEM GLO-30");
    await expect(page.locator(".plate-credit")).toContainText("Copernicus DEM GLO-30 © ESA");

    // Only byte ranges were asked for, never a whole tile.
    const tiles = requests.map((r) => new URL(r.url()).searchParams.get("tile"));
    expect(tiles).toContain("N12E104");
    expect(tiles).toContain("N11E104");
    expect(requests.every((r) => /^bytes=\d+-\d+$/.test(r.headers()["range"] ?? ""))).toBe(true);
  });

  test("the choice is in the share link and reopens", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await serveCopernicus(page);
    await openPlate(page);
    await openAdjust(page);
    await pick(page, /^Copernicus GLO-30/);
    await expect
      .poll(() => highest(page), { timeout: 20_000 })
      .toBeGreaterThan(COPERNICUS_PEAK - 60);
    await page.locator(".plate-sheet__header button").click();

    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get("dem")).toBe("copernicus");

    await page.evaluate(() => localStorage.removeItem("teetangart.plate.v1"));
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect
      .poll(() => highest(page), { timeout: 20_000 })
      .toBeGreaterThan(COPERNICUS_PEAK - 60);
  });

  test("a link with an unknown source opens with the worldwide data", async ({ page }) => {
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&dem=nonsense");
    expect(await highest(page)).toBeLessThanOrEqual(SUMMIT_METRES);
    await expect(page.locator(".plate-credit")).toContainText("AWS Terrain Tiles");
  });

  for (const [label, fulfil] of [
    ["a proxy that errors", { status: 500 }],
    ["a proxy that is not deployed", { status: 404 }],
  ] as const) {
    test(`falls back to the worldwide tiles with ${label}`, async ({ page }) => {
      await serveCopernicus(page, fulfil);
      await openPlate(page);
      await openAdjust(page);
      await pick(page, /^Copernicus GLO-30/);
      await expect(page.locator(".plate-note--warn")).toContainText("worldwide data is shown");
      // Never a flat plate: the terrain is the worldwide one.
      expect(await highest(page)).toBeGreaterThan(SUMMIT_METRES - 60);
      expect(await highest(page)).toBeLessThanOrEqual(SUMMIT_METRES);
      await expect(page.locator(".plate-credit")).toContainText("AWS Terrain Tiles");
    });
  }

  test("USGS 3DEP is offered only inside the United States", async ({ page }) => {
    await openPlate(page);
    await openAdjust(page);
    await expect(page.getByRole("button", { name: /^USGS 3DEP lidar/ })).toBeDisabled();

    const rainier = { lat: 46.85, lon: -121.76, peak: 4392 };
    const requests = await serve3dep(page, rainier);
    await page.goto(`/plate?lat=${rainier.lat}&lon=${rainier.lon}&km=10&name=Rainier&dem=usgs3dep`);
    await expect(page.locator(".plate-canvas")).toHaveAttribute("data-ready", "true", {
      timeout: 20_000,
    });
    await expect.poll(() => highest(page), { timeout: 20_000 }).toBeGreaterThan(4300);
    expect(requests.length).toBeGreaterThan(0);
    const params = new URL(requests[0].url()).searchParams;
    expect(params.get("pixelType")).toBe("F32");
    expect(params.get("bboxSR")).toBe("4326");
    await expect(page.locator(".plate-credit")).toContainText("USGS 3D Elevation Program");
  });

  test("OpenTopography needs a key, keeps it on the device and out of links", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const requests = await serveOpenTopography(page, { ...SUMMIT, peak: 2000 });
    await openPlate(page);
    await openAdjust(page);
    await pick(page, /^ALOS World 3D 30 m/);

    // No key yet: the worldwide data stays, and the sheet says why.
    await expect(page.locator(".plate-note--warn")).toContainText("Add your OpenTopography key");
    expect(requests).toHaveLength(0);

    const field = page.getByLabel("OpenTopography key");
    await field.fill("not a key");
    await page.getByRole("button", { name: "Save key" }).click();
    await expect(page.getByRole("alert")).toContainText("doesn't look like");
    expect(requests).toHaveLength(0);

    const key = "abcdef0123456789abcdef0123456789";
    await field.fill(key);
    await page.getByRole("button", { name: "Save key" }).click();
    await expect.poll(() => highest(page), { timeout: 20_000 }).toBeGreaterThan(1900);

    const params = new URL(requests[0].url()).searchParams;
    expect(params.get("demtype")).toBe("AW3D30");
    expect(params.get("API_Key")).toBe(key);
    expect(params.get("outputFormat")).toBe("GTiff");
    expect(await page.evaluate(() => localStorage.getItem("teetangart.opentopo.key"))).toBe(key);

    await page.locator(".plate-sheet__header button").click();
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get("dem")).toBe("ot:AW3D30");
    expect(link).not.toContain(key);
    // Nor in the saved draft.
    expect(await page.evaluate(() => localStorage.getItem("teetangart.plate.v1"))).not.toContain(
      key,
    );
  });
});

test.describe("what can be seen from a pin", () => {
  // The mock plate is one round mountain: 1,500 m at the centre, a plain at 200 m.
  const foot = "12.0333,104.1222,Foot";
  const top = "12.0333,104.1667,Summit";

  const sees = async (page: Page) => {
    const text = await page.getByTestId("view-panel").getByRole("status").innerText();
    return Number(text.match(/Can see (\d+)%/)![1]);
  };

  test("a pin at the edge of the plate cannot see past the mountain", async ({ page }) => {
    await openPlate(page, `/plate?lat=12.0333&lon=104.1667&km=10&mk=${foot}&vs=0`);
    await page.getByRole("button", { name: "Route & pins" }).click();
    await expect(page.getByTestId("view-panel")).toBeVisible();
    const share = await sees(page);
    // The mountain stands between the pin and the east side of the plate.
    expect(share).toBeGreaterThan(2);
    expect(share).toBeLessThan(50);
    await expect(page.getByTestId("view-panel")).toContainText("km");
  });

  test("a taller eye sees more, and the view is in the share link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPlate(page, `/plate?lat=12.0333&lon=104.1667&km=10&mk=${foot}&vs=0`);
    await page.getByRole("button", { name: "Route & pins" }).click();
    const onFoot = await sees(page);
    await page.getByRole("button", { name: /Tower/ }).click();
    await expect.poll(() => sees(page)).toBeGreaterThan(onFoot);

    await page.locator(".plate-sheet__header button").click();
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(link.searchParams.get("vs")).toBe("0");
    expect(link.searchParams.get("ve")).toBe("50");
  });

  test("the eye button turns the view on and off, and deleting the pin clears it", async ({
    page,
  }) => {
    await openPlate(page, `/plate?lat=12.0333&lon=104.1667&km=10&mk=${top}|${foot}`);
    await page.getByRole("button", { name: "Route & pins" }).click();
    await expect(page.getByTestId("view-panel")).toHaveCount(0);

    const eye = page.getByRole("button", { name: /What can I see from here\? Foot/ });
    await eye.click();
    await expect(eye).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("view-panel")).toBeVisible();
    await eye.click();
    await expect(page.getByTestId("view-panel")).toHaveCount(0);

    await eye.click();
    await page.getByRole("button", { name: "Remove pin" }).last().click();
    await expect(page.getByTestId("view-panel")).toHaveCount(0);
  });
});

test.describe("steepness map", () => {
  // The mock mountain is a smooth cone: 1,500 m high on a 200 m plain, 3 km wide.
  // Its steepest ground is at 2.1 km from the summit, about 20° (atan of 0.37).
  test("colours the ground by slope and reports the steepest angle", async ({ page }) => {
    await openPlate(page);
    await openAdjust(page);
    await expect(page.getByTestId("slope-key")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Steepness map" }).check();
    await expect(page.getByTestId("slope-key")).toContainText("over 45°");
    const note = page.getByTestId("slope-key").locator(".plate-note");
    await expect(note).toContainText("Steepest");
    const text = await note.innerText();
    const steepest = Number(text.match(/Steepest (\d+)°/)![1]);
    expect(steepest).toBeGreaterThanOrEqual(17);
    expect(steepest).toBeLessThanOrEqual(23);
    // Nothing on the cone reaches 30°.
    expect(text).toContain("30° or more: 0%");

    await page.getByRole("checkbox", { name: "Steepness map" }).uncheck();
    await expect(page.getByTestId("slope-key")).toHaveCount(0);
  });

  test("is in the share link and reopens", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPlate(page, "/plate?lat=12.0333&lon=104.1667&slp=1");
    await openAdjust(page);
    await expect(page.getByRole("checkbox", { name: "Steepness map" })).toBeChecked();
    await page.locator(".plate-sheet__header button").click();
    await page.getByRole("button", { name: "Download", exact: true }).click();
    await page.locator(".plate-download[data-kind=link]").click();
    const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(link.searchParams.get("slp")).toBe("1");
  });
});
