import { expect, test } from "@playwright/test";

test("the budget shows a share, never money, and blocks sending once a limit is used up", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const entry = page.locator("#AssistantBudget");
  const full = entry.locator("dd").nth(3);
  await expect(full.getByRole("img", { name: "Iskorišten manji dio današnje granice" })).toBeVisible();
  await expect(full.getByRole("status")).toHaveText(/^Većina današnje granice je iskorištena\./u);
  await expect(full.getByRole("alert")).toHaveCount(2);
  for (const send of await full.getByRole("button", { name: "Pošalji Asistentu" }).all()) {
    await expect(send).toHaveAttribute("aria-disabled", "true");
  }
  await expect(entry).not.toContainText(/[0-9€]/u);
});
