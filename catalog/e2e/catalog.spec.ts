import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { CATALOG_STATES } from "../src/coverage";

const COMPONENTS = ["Button", "TextField", "SaveState", "Card"];
// The screens of src/components (DAN-753): on the shell only, one under another.
const SCREENS = ["AppShell", "ErrorScreen", "RouteLoading", "SignInPanel", "StudentHome", "MyAssignments", "EmptyHome", "OutlinePanel", "TeacherCourses", "MentoredWorks"];
const WIDTHS = [1440, 1024, 768, 390, 360];
const THEMES = ["dark", "light"] as const;

async function open(page: Page, theme: (typeof THEMES)[number], width: number): Promise<string[]> {
  const foreign: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://127.0.0.1:4174/")) foreign.push(r.url()); });
  await page.setViewportSize({ width, height: 900 });
  // The progress pulse stops under reduced motion (SaveState.module.css), so pixels are stable.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(theme === "light" ? "/?theme=light" : "/");
  await page.evaluate(async () => { await document.fonts.ready; });
  return foreign;
}

// QA FAIL on aa4b3c5: in a real form, the busy submit button submits nothing and keeps focus.
test("a busy submit button in a form does not submit and stays focusable", async ({ page }) => {
  await open(page, "dark", 1440);
  const section = page.getByRole("region", { name: "Button" });
  await section.locator("button[aria-busy=true]").first().evaluate((button) => {
    const ready = [...document.querySelectorAll("button")].find((b) => b.textContent === "Predaj rad" && !b.disabled)!;
    const form = document.createElement("form");
    button.replaceWith(form);
    form.append(button, ready);
    for (const [b, id] of [[button, "busy"], [ready, "ready"]] as const) {
      (b as HTMLButtonElement).type = "submit";
      b.setAttribute("data-testid", id);
    }
    form.addEventListener("submit", (e) => { e.preventDefault(); document.body.dataset.submitted = "yes"; });
  });
  const busy = page.getByTestId("busy");
  await busy.click({ force: true }); // aria-disabled: Playwright would wait for "enabled"
  await busy.press("Enter");
  await expect(busy).toBeFocused();
  await expect(page.locator("body")).not.toHaveAttribute("data-submitted", "yes");
  // Control: the same form submits through its button that is not busy.
  await page.getByTestId("ready").click();
  await expect(page.locator("body")).toHaveAttribute("data-submitted", "yes");
});

// Review FAIL on aa4b3c5: a busy field takes no typing; the same field when not busy does.
test("a busy text field takes no input, a normal one does", async ({ page }) => {
  await open(page, "dark", 1440);
  const section = page.getByRole("region", { name: "TextField" });
  const busy = section.locator("input[aria-busy=true]").first();
  await busy.click();
  await busy.pressSequentially("Uvod");
  await busy.press("Backspace");
  await expect(busy).toHaveValue("");
  await expect(busy).not.toBeEditable();
  const empty = section.getByPlaceholder("Npr. Javne politike u lokalnoj zajednici").first();
  await empty.pressSequentially("Uvod");
  await expect(empty).toHaveValue("Uvod");
});

for (const theme of THEMES) {
  test.describe(`${theme} shell`, () => {
    test("shows every component in all five states, on the shell and on the white sheet", async ({ page }) => {
      const foreign = await open(page, theme, 1440);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const name of COMPONENTS) {
        const section = page.getByRole("region", { name });
        await expect(section.locator(".sheet[data-sheet-theme=light]")).toHaveCount(1);
        for (const state of CATALOG_STATES) await expect(section.getByText(state, { exact: true })).toHaveCount(2);
      }
      for (const name of SCREENS) {
        const section = page.getByRole("region", { name });
        await expect(section.locator(".sheet")).toHaveCount(0);
        for (const state of CATALOG_STATES) await expect(section.getByText(state, { exact: true })).toHaveCount(1);
      }
      await expect(page.getByText(/^Spremljeno$/)).toHaveCount(0);
      expect(foreign).toEqual([]);
    });

    test("has no WCAG 2.2 AA violations (axe)", async ({ page }) => {
      // 400 px is the width of the left panel's acceptance (DAN-977); the page is checked whole.
      for (const width of [1440, 400, 360]) {
        await open(page, theme, width);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      }
    });

    for (const width of WIDTHS) {
      test(`matches its baselines at ${width} px`, async ({ page }) => {
        await open(page, theme, width);
        for (const name of [...COMPONENTS, ...SCREENS]) {
          await expect.soft(page.getByRole("region", { name })).toHaveScreenshot(`${name}-${theme}-${width}.png`);
        }
      });
    }
  });
}
