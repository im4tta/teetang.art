import { test as base, expect, type Page } from "@playwright/test";

/** Local-only network, English UI, release notes and quick start already seen. */
export const test = base.extend<{ quickStartSeen: boolean }>({
  quickStartSeen: [true, { option: true }],
  page: async ({ page, quickStartSeen }, use) => {
    await page.route(
      (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort(),
    );
    await page.addInitScript((seen) => {
      localStorage.setItem("last_seen_version", "999.0.0");
      localStorage.setItem("teetangart.lang", "en");
      if (seen) localStorage.setItem("teetangart.quickstart.v1", "1");
    }, quickStartSeen);
    await use(page);
  },
});

export { expect };

export async function openEditor(page: Page, path = "/create") {
  await page.goto(path);
  await expect(page.locator(".mobile-nav-tab")).toHaveCount(5);
}

export async function openSheet(page: Page, tab: "place" | "look" | "text" | "add") {
  await page.locator(`.mobile-nav-tab[data-tab="${tab}"]`).click();
  await expect(page.locator(".mobile-drawer-sheet")).toBeVisible();
  await settleAnimations(page);
}

/** Waits for finite CSS animations (sheet slide-in, toasts) to finish; looping ones are ignored. */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== "running"),
  );
}

export async function closeSheet(page: Page) {
  await page.locator(".mobile-drawer-close").click();
  await expect(page.locator(".mobile-drawer-sheet")).toHaveCount(0);
}

/** Touch/readability problems among the visible UI (the poster artwork is excluded). */
export function auditTouchSizes(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== "hidden" &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        !el.closest(".poster-frame")
      );
    };
    const smallTargets: string[] = [];
    const smallInputs: string[] = [];
    const tinyText: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, [role=button], label.ios-toggle",
    )) {
      if (!visible(el)) continue;
      if (el instanceof HTMLInputElement && ["checkbox", "radio", "hidden"].includes(el.type))
        continue;
      const box = el.getBoundingClientRect();
      const name = `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`;
      if (box.width < 44 || box.height < 44)
        smallTargets.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
      const isTextField =
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLInputElement && !["range", "color"].includes(el.type));
      if (isTextField && parseFloat(getComputedStyle(el).fontSize) < 16) smallInputs.push(name);
    }
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (hasText && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 12) {
        tinyText.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
      }
    }
    return {
      smallTargets: [...new Set(smallTargets)],
      smallInputs: [...new Set(smallInputs)],
      tinyText: [...new Set(tinyText)],
      overflowsSideways: document.documentElement.scrollWidth > innerWidth,
    };
  });
}
