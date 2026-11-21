import { expect, test } from "@playwright/test";

test("the teacher reads an attached conversation up to the confirmed version and returns to the list", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const section = page.locator("#TeacherAiAttachments");
  await expect(section.getByRole("heading", { name: "Priloženi razgovori (2)" }).first()).toBeVisible();

  const open = section.getByRole("button", { name: "Otvori Razgovor 1 · Lektura · 2. 11. 14:05" }).first();
  await open.click();
  await expect(section.getByRole("heading", { name: /^Razgovor 1 · Lektura/u }).first()).toBeFocused();
  await expect(section.getByText("Predlažem blaži poredak rečenica. Izmišljen primjer odgovora.").first()).toBeVisible();
  await expect(section.getByText("Poruka napisana nakon potvrde izjave.")).toHaveCount(0);
  await expect(section.getByRole("textbox")).toHaveCount(0);

  await section.getByRole("button", { name: "Natrag na uporabu AI-ja" }).first().click();
  await expect(open).toBeFocused();
});
