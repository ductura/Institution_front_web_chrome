import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { CATALOG_STATES } from "../src/coverage";

const COMPONENTS = [
  "Button", "TextField", "SaveState", "Card", "Icon", "Dialog", "ToastRegion", "Checkbox", "Select", "TextArea", "Tag", "Skeleton", "Details",
  "ErrorScreen", "RouteLoading",
];
const ADDITIONAL_COMPONENTS = ["DataTable", "Fingerprint", "KeyValueList", "StateTag", "Steps"];
const VISUAL_COMPONENTS = [...COMPONENTS, "ObjectToolbar", "PreviewDialog", "AppointmentCalendar"];
// The screens of src/components (DAN-753): on the shell only, one under another.
// PanelTabs (WEB-06) is a part of the shell's panel: on the shell only, like the screens.
const SCREENS = ["AppShell", "PanelTabs", "StudentHome", "MyAssignments", "EmptyHome", "OutlinePanel", "TeacherCourses", "MentoredWorks"];
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
      for (const name of [...COMPONENTS, ...ADDITIONAL_COMPONENTS]) {
        const section = page.getByRole("region", { name, exact: true });
        await expect(section.locator(".sheet[data-sheet-theme=light]")).toHaveCount(1);
        await expect(section.locator(":scope > div > dl > div > dt")).toHaveText([...CATALOG_STATES, ...CATALOG_STATES]);
      }
      for (const name of SCREENS) {
        const section = page.getByRole("region", { name, exact: true });
        await expect(section.locator(".sheet")).toHaveCount(0);
        await expect(section.locator(":scope > div > dl > div > dt")).toHaveText([...CATALOG_STATES]);
      }
      await expect(page.getByText(/^Spremljeno$/)).toHaveCount(0);
      expect(foreign).toEqual([]);
    });

    test("appointment calendars fit at 360 px and keep full-size day buttons", async ({ page }) => {
      await open(page, theme, 360);
      const section = page.getByRole("region", { name: "AppointmentCalendar", exact: true });
      const calendars = section.getByRole("group", { name: "Kalendar termina", exact: true });
      await expect(calendars).toHaveCount(6);
      for (const calendar of await calendars.all()) {
        const { frame, grid, day } = await calendar.evaluate((root) => ({
          frame: root.getBoundingClientRect().toJSON(),
          grid: root.querySelector("[role=grid]")!.getBoundingClientRect().toJSON(),
          day: root.querySelector("button[data-day]")!.getBoundingClientRect().toJSON(),
        }));
        expect(frame.right).toBeLessThanOrEqual(360);
        expect(grid.right).toBeLessThanOrEqual(frame.right);
        expect(day.width).toBeGreaterThanOrEqual(44);
        expect(day.height).toBeGreaterThanOrEqual(44);
      }

      const sheet = section.locator(".sheet");
      const confirmed = sheet.getByRole("button", { name: "14:00, potvrđeno", exact: true }).and(sheet.locator(":enabled"));
      await confirmed.click();
      await expect(confirmed).toHaveAttribute("aria-pressed", "true");
      await expect(sheet.getByText("Odabrano: 20. 11. 2026. u 14:00")).toBeVisible();
    });

    // 400 px is the width of the left panel's acceptance (DAN-977); the page is checked whole.
    for (const width of [1440, 400, 360]) {
      test(`has no WCAG 2.2 AA violations at ${width} px (axe)`, async ({ page }) => {
        test.setTimeout(60_000);
        await open(page, theme, width);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      });
    }

    for (const width of WIDTHS) {
      test(`matches its baselines at ${width} px`, async ({ page }) => {
        await open(page, theme, width);
        // Keep preceding entries from shifting the region's fractional pixel origin.
        await page.addStyleTag({ content: "#root > main > section:not([data-catalog-snapshot]) { display: none; }" });
        for (const name of [...VISUAL_COMPONENTS, ...SCREENS]) {
          await page.locator(`#${name}`).evaluate((section) => {
            section.parentElement!.querySelector("[data-catalog-snapshot]")?.removeAttribute("data-catalog-snapshot");
            section.setAttribute("data-catalog-snapshot", "");
          });
          await expect.soft(page.getByRole("region", { name, exact: true })).toHaveScreenshot(`${name}-${theme}-${width}.png`);
        }
      });
    }
  });
}
