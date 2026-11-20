import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("source form opens by keyboard, reports errors, adds a source and returns focus", async ({ page }) => {
  await page.goto("/");
  const example = page.getByRole("region", { name: "SourceForm", exact: true });
  const trigger = example.getByRole("button", { name: "Novi izvor" }).first();
  await trigger.press("Enter");
  const form = page.getByRole("dialog", { name: "Dodaj izvor" }).filter({ has: page.getByRole("button", { name: "Dodaj i citiraj" }) });
  const type = form.getByLabel("Vrsta izvora");
  await expect(type).toBeFocused();
  await type.selectOption("web");
  await expect(form.getByLabel("Nakladnik")).toHaveCount(0);
  await form.getByRole("button", { name: "Dodaj i citiraj" }).click();
  await expect(form.getByLabel("Naslov")).toBeFocused();
  await expect(form.getByLabel("Naslov")).toHaveAccessibleDescription("Ispunite ovo polje.");
  const { violations } = await new AxeBuilder({ page }).include('[aria-label="Dodaj izvor"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);

  await form.getByLabel("Naslov").fill("Izmišljeni mrežni izvor");
  await form.getByLabel("Godina izdanja").fill("2026");
  await form.getByLabel("Prezime").fill("Autor A");
  await form.getByLabel("Ime", { exact: true }).fill("Demo");
  await form.getByLabel("Mrežna adresa").fill("https://izvor.example/");
  await form.getByLabel("Datum pristupa").fill("2026-11-20");
  await form.getByRole("button", { name: "Samo u literaturu" }).click();
  await expect(example.getByText("Izmišljeni mrežni izvor")).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await type.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(form).toHaveCount(0);
});
