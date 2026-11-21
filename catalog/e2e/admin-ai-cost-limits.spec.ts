import { expect, test } from "@playwright/test";

test("a limit above the cap blocks the preview; a valid one is published after the preview", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const full = page.locator("#AdminAiCostLimits").locator("dd").nth(3);
  const day = full.getByLabel("Dnevna granica po studentu", { exact: true });
  const review = full.getByRole("button", { name: "Pregledaj prije objave" });

  await day.fill("60");
  await expect(full.getByRole("alert")).toHaveText("Granica ne smije biti veća od stropa operatera (50,00 EUR). Upišite 50,00 EUR ili manje.");
  await expect(review).toHaveAttribute("aria-disabled", "true");
  await review.press("Enter");
  await expect(full.getByRole("button", { name: "Objavi novu verziju" })).toHaveCount(0);

  await day.fill("5");
  await expect(review).not.toHaveAttribute("aria-disabled", "true");
  await review.press("Enter");
  const preview = full.getByRole("region", { name: "Pregled nove verzije" });
  await expect(preview.getByRole("heading", { name: "Pregled nove verzije" })).toBeFocused();
  await expect(preview).toContainText("5,00 EUR");
  await preview.getByRole("button", { name: "Objavi novu verziju" }).click();
  await expect(full.getByRole("status")).toHaveText("Verzija 4 je objavljena.");
  await expect(full.getByRole("region", { name: "Povijest verzija" }).getByRole("listitem")).toHaveCount(4);
});

test("without a cap the review stays focusable but inert, with the reason", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const off = page.locator("#AdminAiCostLimits").locator("dd").nth(4);
  const review = off.getByRole("button", { name: "Pregledaj prije objave" });
  await expect(review).toHaveAttribute("aria-disabled", "true");
  await expect(review).toHaveAccessibleDescription(/Operater još nije objavio strop/u);
  await expect(off.getByLabel("Dnevna granica po studentu", { exact: true })).toHaveAttribute("readonly", "");
});
