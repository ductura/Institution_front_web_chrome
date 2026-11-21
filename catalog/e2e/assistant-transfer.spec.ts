import { expect, test } from "@playwright/test";

test("the comparison shows both texts, cancel returns focus, apply marks it transferred", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const full = page.locator("#AssistantTransfer").locator("dd").nth(3);
  const transfer = full.getByRole("button", { name: "Prenesi u rad" });
  await transfer.press("Enter");
  const compare = full.getByRole("region", { name: "Usporedba prije primjene" });
  await expect(compare.locator('[data-side="before"]')).toHaveText("Izmišljeno selo Lipovac ima tri bunara i staru školu.");
  await expect(compare.locator('[data-side="after"]')).toHaveText("Izmišljeno selo Lipovac ima četiri bunara i obnovljenu staru školu.");
  await compare.getByRole("button", { name: "Odustani" }).press("Enter");
  await expect(compare).toHaveCount(0);
  await expect(transfer).toBeFocused();
  await expect(full.getByRole("status")).toHaveText("");
  await transfer.press("Enter");
  await full.getByRole("button", { name: "Primijeni" }).click();
  await expect(full.getByRole("status")).toHaveText("Preneseno u rad.");
  await expect(transfer).toHaveAttribute("aria-disabled", "true");
});
