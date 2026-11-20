import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("searches sources without diacritics and picks a result by keyboard", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const region = page.getByRole("region", { name: "SearchableList", exact: true });
  const search = region.getByRole("combobox", { name: "Pretraži primjere izvora" }).first();
  const example = search.locator("xpath=ancestor::dd");
  await expect(region.getByText("Još nema izvora.").first()).toBeVisible();
  await search.fill("2026 zupanijski");
  await expect(example.getByRole("option")).toHaveCount(1);
  await search.press("ArrowDown");
  await expect(example.getByRole("option", { selected: true })).toContainText("Izmišljeni županijski zbornik");
  await expect(search).toBeFocused();
  const { violations } = await new AxeBuilder({ page }).include("#SearchableList").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);

  await search.press("Enter");
  await expect(example.getByRole("status").filter({ hasText: "Izmišljeni županijski zbornik" })).toBeVisible();
  await search.fill("nepostojeće");
  await expect(example.getByText("Nema izvora koji odgovaraju pretrazi.")).toBeVisible();
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await expect(example.getByRole("listbox")).toHaveCount(0);
});
