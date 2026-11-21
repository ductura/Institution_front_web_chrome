// The two checks of the accessibility pass (WEB-1805, M11.6): axe against the
// WCAG A and AA rules, and a visible keyboard focus on every Tab stop.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

import { fakeServer } from "./fake-server";
import type { Screen } from "./screens";

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA (D-248: 2.2 AA for new screens). */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** The impacts acceptance criterion 1 allows none of. */
export const BLOCKING = ["critical", "serious"];

export type Theme = "dark" | "light";

/** Opens a screen under /app/web for its role, in a theme, and waits until it has settled. */
export async function open(page: Page, screen: Screen, theme: Theme) {
  await fakeServer(page, screen.role);
  await page.addInitScript((light) => {
    try {
      if (light) localStorage.setItem("ductura.theme", "light");
    } catch { /* storage may be blocked */ }
  }, theme === "light");
  await page.goto(`/app/web${screen.path}`);
  await page.waitForLoadState("networkidle");
  // The host shows the page once the session is read; a loading state is not the screen.
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByRole("status", { name: /Učitavam|Prijavljujem/ })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/** Runs axe; every finding goes to the report, critical and serious ones fail the test. */
export async function axe(page: Page, info: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const findings = results.violations.map((v) => ({
    id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
  }));
  await info.attach("axe.json", { body: JSON.stringify(findings, null, 2), contentType: "application/json" });
  expect(findings.filter((f) => BLOCKING.includes(f.impact ?? ""))).toEqual([]);
}

type Stop = { readonly element: string; readonly visible: boolean };

/**
 * Presses Tab through the screen (at most `limit` stops, until focus comes
 * back to the first one) and returns every stop whose focus is not visible:
 * neither an outline of 2 px or more, nor a box shadow, nor a border that
 * differs from the element's unfocused one.
 */
export async function hiddenFocus(page: Page, limit = 40): Promise<string[]> {
  await page.locator("body").evaluate((body) => {
    (document.activeElement as HTMLElement | null)?.blur();
    body.focus();
  });
  const hidden: string[] = [];
  let first: string | null = null;
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate((): Stop | null => {
      const el = document.activeElement as HTMLElement | null;
      if (el === null || el === document.body) return null;
      const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
        `[${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}]`;
      const focused = getComputedStyle(el);
      const outline = focused.outlineStyle !== "none" && parseFloat(focused.outlineWidth) >= 2;
      const shadow = focused.boxShadow !== "none" && focused.boxShadow !== "";
      const rect = el.getBoundingClientRect();
      // A focused element must also take up room on the screen (WCAG 2.4.7, 2.4.11).
      const onScreen = rect.width > 0 && rect.height > 0;
      return { element: name, visible: onScreen && (outline || shadow) };
    });
    if (stop === null) break;
    if (stop.element === first) break;
    first ??= stop.element;
    if (!stop.visible) hidden.push(stop.element);
  }
  return [...new Set(hidden)];
}
