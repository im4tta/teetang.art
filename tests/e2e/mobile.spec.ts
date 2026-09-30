import {
  auditTouchSizes,
  closeSheet,
  expect,
  openEditor,
  openSheet,
  settleAnimations,
  test,
} from "./fixtures";

const draft = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("teetangart.draft.v1") ?? "null"));

test.describe("layout", () => {
  test("the editor fits the phone: no sideways scroll, controls above the tab bar", async ({
    page,
  }) => {
    await openEditor(page);
    const { overflowsSideways } = await auditTouchSizes(page);
    expect(overflowsSideways).toBe(false);

    const controls = await page.locator(".preview-panel .map-controls").boundingBox();
    const nav = await page.locator(".mobile-nav").boundingBox();
    expect(controls, "map controls").not.toBeNull();
    expect(nav, "tab bar").not.toBeNull();
    expect(controls!.y + controls!.height, "controls end above the tab bar").toBeLessThanOrEqual(
      nav!.y,
    );
  });

  test("every screen meets touch and text size minimums", async ({ page }) => {
    await openEditor(page);
    const screens: [string, () => Promise<void>][] = [
      ["editor", async () => {}],
      ["place", () => openSheet(page, "place")],
      ["style", () => openSheet(page, "look")],
      ["text", () => openSheet(page, "text")],
      ["add", () => openSheet(page, "add")],
      [
        "settings",
        async () => {
          await page.locator(".general-header-actions .general-header-icon-btn").last().click();
          await settleAnimations(page);
        },
      ],
    ];
    for (const [name, open] of screens) {
      await open();
      const audit = await auditTouchSizes(page);
      expect.soft(audit.smallTargets, `${name}: tap targets under 44px`).toEqual([]);
      expect.soft(audit.smallInputs, `${name}: fields under 16px`).toEqual([]);
      expect.soft(audit.tinyText, `${name}: text under 12px`).toEqual([]);
      if (name !== "editor") await closeSheet(page);
    }
  });
});

test.describe("speed", () => {
  test("the editor UI appears without waiting for the map library", async ({ page }) => {
    // Hold back MapLibre: everything else must still render.
    await page.route(/vendor-maplibre|MapPreview/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      await route.continue();
    });
    await page.goto("/create");
    await expect(page.locator(".mobile-nav-tab")).toHaveCount(5, { timeout: 4_000 });
    await expect(page.locator(".map-loading")).toBeVisible();
  });

  test("the home page stays light", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-hero-title")).toBeVisible();
    // Scripts the page needed to load; the editor it preloads later when idle
    // is not counted.
    const scriptBytes = await page.evaluate(() => {
      const loadEnd = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return performance
        .getEntriesByType("resource")
        .filter(
          (entry) =>
            (entry as PerformanceResourceTiming).initiatorType === "script" ||
            entry.name.endsWith(".js"),
        )
        .filter((entry) => entry.startTime <= loadEnd.loadEventEnd)
        .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0);
    });
    // Uncompressed; about 94 kB gzipped when this budget was set.
    expect(scriptBytes).toBeLessThan(330_000);
  });
});

test.describe("editing", () => {
  test("theme strip changes the theme and undo brings it back", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(".general-header-icon-btn[aria-label='Undo']")).toBeDisabled();
    await openSheet(page, "look");
    const items = page.locator(".theme-strip__item");
    const before = await page.locator(".theme-strip__item[aria-pressed='true']").innerText();
    await items.nth(3).click();
    await expect(items.nth(3)).toHaveAttribute("aria-pressed", "true");
    await closeSheet(page);

    await page.locator(".general-header-icon-btn[aria-label='Undo']").click();
    await openSheet(page, "look");
    await expect(page.locator(".theme-strip__item[aria-pressed='true']")).toHaveText(before);
  });

  test("typing in a sheet field keeps focus", async ({ page }) => {
    await openEditor(page);
    await openSheet(page, "text");
    const city = page.locator(".mobile-drawer-content input[name='displayCity']");
    await city.fill("");
    await city.pressSequentially("Kep", { delay: 30 });
    await expect(city).toHaveValue("Kep");
    await expect(city).toBeFocused();
  });

  test("the sheet steps between peek, half and full height", async ({ page }) => {
    await openEditor(page);
    await openSheet(page, "look");
    const sheet = page.locator(".mobile-drawer-sheet");
    await expect(sheet).toHaveAttribute("data-snap", "peek");
    await page.locator(".mobile-drawer-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "half");
    await page.locator(".mobile-drawer-handle").click();
    await expect(sheet).toHaveAttribute("data-snap", "full");
  });
});

test.describe("download and share", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("Download tab saves a PNG and confirms it", async ({ page }) => {
    await openEditor(page);
    await page.locator(".mobile-nav-tab[data-tab='download']").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".export-modal-save").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await expect(page.locator(".app-toast--success")).toBeVisible();
  });

  test("copy link gives a teetang.art link that reopens the design", async ({ page }) => {
    await openEditor(page, "/create?lat=10.4833&lon=104.3167&city=Kep&country=Cambodia&theme=ruby");
    await expect(page).toHaveURL(/\/create$/);
    await page.locator(".mobile-nav-tab[data-tab='download']").click();
    await page.getByRole("button", { name: "Copy link" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain("https://teetang.art/create?");
    expect(link).toContain("theme=ruby");
    expect(link).toContain("city=Kep");
  });
});

test.describe("robustness", () => {
  test("the design survives a reload", async ({ page }) => {
    await openEditor(page, "/create?theme=ruby&city=Kep&lat=10.48&lon=104.31");
    await expect
      .poll(async () => (await draft(page))?.form.theme, { timeout: 15_000 })
      .toBe("ruby");
    await page.reload();
    await expect(page.locator(".mobile-nav-tab")).toHaveCount(5);
    expect((await draft(page)).form.displayCity).toBe("Kep");
  });

  test("going offline and back shows a notice", async ({ page, context }) => {
    await openEditor(page);
    await context.setOffline(true);
    await expect(page.locator(".app-toast")).toContainText("offline");
    await context.setOffline(false);
    await expect(page.locator(".app-toast")).toContainText("Back online");
  });
});

test.describe("first visit", () => {
  test.use({ quickStartSeen: false });

  test("quick start shows once", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(".quick-start")).toBeVisible();
    await page.locator(".quick-start__go").click();
    await page.reload();
    await expect(page.locator(".mobile-nav-tab")).toHaveCount(5);
    await expect(page.locator(".quick-start")).toHaveCount(0);
  });
});
