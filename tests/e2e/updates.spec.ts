import { expect, test } from "./fixtures";

test.describe("what's new", () => {
  test("a returning user sees the release notes once, in their language", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("last_seen_version", "2.0.0");
        localStorage.setItem("teetangart.lang", "km");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/create");
    const modal = page.locator(".updates-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("អ្វីថ្មី");
    await expect(modal.locator(".updates-try-link")).toHaveAttribute("href", "/plate");

    await modal.getByRole("button", { name: "យល់ហើយ" }).click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".mobile-nav-tab")).toHaveCount(5);
    await expect(page.locator(".updates-modal")).toHaveCount(0);
  });

  test("the home page shows what's new and links to the 3D plate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-new-pill")).toHaveAttribute("href", "/plate");
    const section = page.locator("#whats-new");
    await expect(section.locator(".home-whats-new__list li")).toHaveCount(4);
    await expect(section.locator(".home-whats-new__cta")).toHaveAttribute("href", "/plate");
  });
});
