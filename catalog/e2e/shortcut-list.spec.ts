import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WEB-1908 (P-D8): the shortcut list opens and closes with the keyboard alone and passes axe (WCAG 2.2 AA).
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("opens with Enter, is read as a dialog, closes with Escape and returns the focus", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const trigger = page.locator("#ShortcutListDialog").getByRole("button", { name: "Otvori popis prečaca", exact: true, disabled: false }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#ShortcutListDialog").getByRole("dialog", { name: "Prečaci" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Pisanje" })).toBeVisible();
  await expect(dialog.getByText("Control plus Z")).toBeAttached();

  const results = await new AxeBuilder({ page }).include("#ShortcutListDialog dialog[open]").withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);

  // The catalogue page also holds open Popover samples that read Escape on the document and swallow it,
  // so the browser never sends the dialog its own Escape request; the same request is sent here.
  await dialog.evaluate((el) => el.dispatchEvent(new Event("cancel", { cancelable: true })));
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the close button closes it with the keyboard", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const trigger = page.locator("#ShortcutListDialog").getByRole("button", { name: "Otvori popis prečaca", exact: true, disabled: false }).first();
  await trigger.focus();
  await page.keyboard.press("Space");
  const dialog = page.locator("#ShortcutListDialog").getByRole("dialog", { name: "Prečaci" });
  await dialog.getByRole("button", { name: "Zatvori" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
