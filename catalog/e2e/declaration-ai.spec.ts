import { expect, test } from "@playwright/test";

test("required conversations stay attached and the confirmation waits for the review", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const ready = page.locator("#DeclarationAi [data-declaration='ready']").first(); // the catalog renders each entry on two surfaces
  const required = ready.getByRole("checkbox", { name: "Razgovor 1 · Lektura · 2. 11. 14:05" });
  await expect(required).toBeChecked();
  await expect(required).toHaveAttribute("aria-disabled", "true");
  await required.click({ force: true }); // aria-disabled: Playwright would wait for "enabled"
  await expect(required).toBeChecked();

  const confirm = ready.getByRole("button", { name: "Potvrdi izjavu" });
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await ready.getByRole("button", { name: /^Pregledaj točne verzije/u }).click();
  await expect(ready.getByRole("heading", { name: "Razgovori uz izjavu (2)" })).toBeFocused();
  await expect(ready.locator("ol li > span:last-child").first()).toHaveCSS("white-space", "pre-wrap");
  await ready.getByRole("button", { name: "Gotov pregled, natrag na izjavu" }).click();
  await expect(confirm).not.toHaveAttribute("aria-disabled", "true");

  const stale = page.locator("#DeclarationAi [data-declaration='stale']").first();
  await expect(stale.getByRole("alert")).toHaveText("Razgovor se promijenio, pregledaj ponovno.");
  await expect(stale.getByRole("button", { name: "Potvrdi izjavu" })).toHaveAttribute("aria-disabled", "true");
});
