import { expect, test } from "@playwright/test";

test("a level 2 purpose that is off stays focusable, says why and ignores Enter", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const full = page.locator("#AssistantPurposePicker").locator("dd").nth(3);
  const proofreading = full.getByRole("button", { name: "Lektura" });
  const off = full.getByRole("button", { name: "Restrukturiranje" });
  await expect(proofreading).toHaveAttribute("aria-pressed", "true");
  await expect(off).toHaveAttribute("aria-disabled", "true");
  await expect(off).toHaveAccessibleDescription("Nije uključeno na ovom zadatku.");
  await off.focus();
  await expect(off).toBeFocused();
  await off.press("Enter");
  await off.press(" ");
  await expect(off).toHaveAttribute("aria-pressed", "false");
  await expect(proofreading).toHaveAttribute("aria-pressed", "true");
  const translation = full.getByRole("button", { name: "Prijevod" });
  await translation.press("Enter");
  await expect(translation).toHaveAttribute("aria-pressed", "true");
  await expect(proofreading).toHaveAttribute("aria-pressed", "false");
});

test("a switched-off picker keeps every choice in the tab order with the reason", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const disabled = page.locator("#AssistantPurposePicker").locator("dd").nth(4);
  const proofreading = disabled.getByRole("button", { name: "Lektura" });
  await expect(proofreading).toHaveAttribute("aria-disabled", "true");
  await expect(proofreading).toHaveAccessibleDescription("Pomoćnik je na ovom zadatku isključen.");
  await proofreading.press("Enter");
  await expect(proofreading).toHaveAttribute("aria-pressed", "false");
});

test("a provider failure is announced and offers retry and close", async ({ page }) => {
  await page.goto("/?theme=light", { waitUntil: "domcontentloaded" });
  const notice = page.locator("#AssistantProviderError").locator("dd").first();
  await expect(notice.getByRole("alert")).toHaveText("Pomoćnik trenutačno ne odgovara. Ništa nije preneseno u rad.");
  await expect(notice.getByRole("button", { name: "Pokušaj ponovno" })).toBeEnabled();
  await expect(notice.getByRole("button", { name: "Zatvori" })).toBeEnabled();
});
