import { expect, test, type Locator, type Page } from "@playwright/test";

import { messagesHr as t } from "../../locales/hr.ts";
import { CATALOG_STATES, type CatalogState } from "../src/coverage";

// web 2.c2 (DAN-751): every catalogue component, in every state, on both
// surfaces, at every plan width (web.md §6 B5), in both shells (D-188). The
// pixel comparison stays in catalog.spec.ts; this checks layout and semantics.
const COMPONENTS = ["Button", "TextField", "SaveState", "Card"] as const;
type Component = (typeof COMPONENTS)[number];
const WIDTHS = [1440, 1024, 768, 390, 360];
const THEMES = ["dark", "light"] as const;
const SURFACES = ["Ljuska", "Bijeli list"] as const;
// The screens of src/components (DAN-753) show only on the shell (catalog/src/main.tsx).
const SCREENS = ["AppShell", "ErrorScreen", "RouteLoading"] as const;
type Screen = (typeof SCREENS)[number];

async function open(page: Page, theme: (typeof THEMES)[number], width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(theme === "light" ? "/?theme=light" : "/");
  await page.evaluate(async () => { await document.fonts.ready; });
}

/** The <dd> holding one state of one component on one surface. */
function cell(page: Page, name: Component | Screen, surface: (typeof SURFACES)[number], state: CatalogState): Locator {
  return page.getByRole("region", { name })
    .locator("div", { has: page.locator(":scope > p", { hasText: new RegExp(`^${surface}$`) }) })
    .locator("dl > div", { has: page.locator(":scope > dt", { hasText: new RegExp(`^${state}$`) }) })
    .locator(":scope > dd");
}

/** Semantics each state must show to a user and to assistive technology. */
const SEMANTICS: Record<Component, Record<CatalogState, (c: Locator) => Promise<void>>> = {
  Button: {
    prazno: async (c) => { await expect(c.getByRole("button", { name: "Odustani" })).toBeEnabled(); },
    učitavanje: async (c) => {
      const b = c.getByRole("button", { name: "Spremanje…" });
      await expect(b).toHaveAttribute("aria-busy", "true");
      await expect(b).not.toHaveAttribute("disabled", /.*/);
      await b.focus();
      await expect(b).toBeFocused();
    },
    greška: async (c) => { await expect(c.getByRole("button", { name: "Pokušajte ponovno" })).toBeEnabled(); },
    puno: async (c) => { await expect(c.getByRole("button", { name: "Predaj rad" })).toBeEnabled(); },
    onemogućeno: async (c) => { await expect(c.getByRole("button", { name: "Predaj rad" })).toBeDisabled(); },
  },
  TextField: {
    prazno: async (c) => {
      const f = c.getByRole("textbox", { name: "Naslov rada" });
      await expect(f).toHaveValue("");
      await expect(f).toBeEditable();
    },
    učitavanje: async (c) => {
      const f = c.getByRole("textbox", { name: "Naslov rada" });
      await expect(f).not.toBeEditable();
      await expect(f).toHaveAccessibleDescription("Učitavanje…");
    },
    greška: async (c) => {
      const f = c.getByRole("textbox", { name: "Naslov rada" });
      await expect(f).toHaveAttribute("aria-invalid", "true");
      await expect(f).toHaveAccessibleDescription("Upišite naslov rada.");
    },
    puno: async (c) => {
      const f = c.getByRole("textbox", { name: "Naslov rada" });
      await expect(f).toHaveValue("Javne politike u lokalnoj zajednici");
      await expect(f).toHaveAccessibleDescription("Najviše 120 znakova.");
    },
    onemogućeno: async (c) => { await expect(c.getByRole("textbox", { name: "Naslov rada" })).toBeDisabled(); },
  },
  SaveState: {
    prazno: async (c) => { await expect(c.getByRole("status")).toHaveText(["Uređivanje"]); },
    učitavanje: async (c) => { await expect(c.getByRole("status")).toHaveText(["Spremam lokalno", "Sinkroniziram"]); },
    greška: async (c) => {
      await expect(c.getByRole("status")).toHaveText(["Sukob", "Greška", "Potreban oporavak"]);
    },
    puno: async (c) => {
      await expect(c.getByRole("status")).toHaveText(["Spremljeno na uređaju", "Spremljeno na poslužitelju"]);
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("status")).toHaveText(["Dokument je otvoren u drugoj kartici."]);
    },
  },
  Card: {
    prazno: async (c) => { await expect(c.getByRole("region", { name: "Moji radovi" })).toContainText("Još nema radova."); },
    učitavanje: async (c) => {
      const r = c.getByRole("region", { name: "Moji radovi" });
      await expect(r).toHaveAttribute("aria-busy", "true");
      await expect(r).toContainText("Učitavanje…");
    },
    greška: async (c) => { await expect(c.getByRole("alert")).toHaveText("Popis se nije učitao. Pokušajte ponovno."); },
    puno: async (c) => {
      await expect(c.getByRole("region", { name: "Seminarski rad" })).toContainText("Uvod u temu i plan poglavlja.");
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("region", { name: "Moji radovi" })).toHaveAttribute("aria-disabled", "true");
    },
  },
};

const shellOf = async (c: Locator, nav: boolean, crumb: string | null) => {
  await expect(c.getByRole("link", { name: t.shell.homeCrumb, exact: true })).toBeVisible();
  // ☰ shows only below 800 px and the side bar is a closed drawer there, so both are read from the DOM.
  await expect(c.locator('button[aria-controls="bocna-navigacija"]')).toHaveAttribute("aria-expanded", "false");
  await expect(c.locator(`nav[aria-label="${t.shell.workNav}"]`)).toHaveCount(nav ? 1 : 0);
  if (crumb !== null) await expect(c.getByRole("navigation", { name: t.shell.breadcrumb })).toContainText(crumb);
};
const studentNav = async (c: Locator) => {
  // The side bar is a drawer below 800 px, so the items are read from the DOM, not by visibility.
  const items = c.locator(`nav[aria-label="${t.shell.workNav}"] a`);
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveAttribute("aria-current", "page");
  await expect(items.first()).toHaveAttribute("href", "/zadaci");
};
const loading = (label: string) => async (c: Locator) => {
  await expect(c.getByRole("main")).toHaveAttribute("aria-busy", "true");
  await expect(c.getByRole("status")).toHaveText(label);
  await expect(c.getByRole("heading", { level: 1 })).toHaveCount(0);
};
const errorScreen = (title: string, retry: boolean) => async (c: Locator) => {
  await expect(c.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(c.getByRole("link", { name: t.auth.home })).toHaveAttribute("href", "/");
  await expect(c.getByRole("button", { name: t.auth.retry })).toHaveCount(retry ? 1 : 0);
  await expect(c.getByRole("alert")).toHaveCount(retry ? 1 : 0);
};

/** Semantics of each state of each screen, on the shell only. */
const SCREEN_SEMANTICS: Record<Screen, Record<CatalogState, (c: Locator) => Promise<void>>> = {
  AppShell: {
    prazno: async (c) => {
      await shellOf(c, false, null);
      await expect(c.getByText(t.shell.role.student, { exact: true })).toHaveCount(0);
    },
    učitavanje: async (c) => {
      await shellOf(c, true, t.shell.nav.assignments);
      await studentNav(c);
      await expect(c.getByRole("status")).toHaveText(t.student.loading);
    },
    greška: async (c) => {
      await shellOf(c, true, t.shell.nav.assignments);
      await expect(c.getByRole("alert")).toHaveText(t.errorPage.errorBody);
    },
    puno: async (c) => {
      await shellOf(c, true, t.shell.nav.assignments);
      await studentNav(c);
      await expect(c.locator("aside").getByText(t.shell.role.student, { exact: true })).toHaveCount(1);
    },
    onemogućeno: async (c) => {
      await shellOf(c, false, null);
      await expect(c.getByText(t.shell.role.student, { exact: true })).toHaveCount(0);
    },
  },
  ErrorScreen: {
    prazno: errorScreen(t.errorPage.notFoundTitle, false),
    učitavanje: loading(t.student.loading),
    greška: errorScreen(t.errorPage.errorTitle, true),
    puno: errorScreen(t.errorPage.notFoundTitle, false),
    onemogućeno: errorScreen(t.errorPage.errorTitle, false),
  },
  RouteLoading: {
    prazno: loading(t.workspace.panelLoading),
    učitavanje: loading(t.fastPath.loading),
    greška: loading(t.student.loading),
    puno: loading(t.workspace.statusLoading),
    onemogućeno: loading(t.workspace.panelLoading),
  },
};

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`${theme} shell at ${width} px: every state of every component fits and keeps its semantics`, async ({ page }) => {
      await open(page, theme, width);
      // No sideways scrolling of the page at any plan width.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      for (const name of COMPONENTS) {
        for (const surface of SURFACES) {
          for (const state of CATALOG_STATES) {
            const where = `${name} · ${surface} · ${state}`;
            const c = cell(page, name, surface, state);
            await expect(c, where).toHaveCount(1);
            await expect(c, where).toBeVisible();
            // Every child of the state sits inside the viewport and is not clipped by its cell.
            const boxes = await c.evaluate((dd) => [...dd.children].map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, width: r.width, height: r.height };
            }));
            expect(boxes.length, where).toBeGreaterThan(0);
            for (const b of boxes) {
              expect.soft(b.width * b.height, `${where}: rendered`).toBeGreaterThan(0);
              expect.soft(b.left, `${where}: left edge`).toBeGreaterThanOrEqual(0);
              expect.soft(b.right, `${where}: right edge`).toBeLessThanOrEqual(width);
            }
            await SEMANTICS[name][state](c);
          }
        }
      }

      for (const name of SCREENS) {
        for (const state of CATALOG_STATES) {
          const where = `${name} · Ljuska · ${state}`;
          const c = cell(page, name, "Ljuska", state);
          await expect(c, where).toHaveCount(1);
          await expect(c, where).toBeVisible();
          const box = await c.evaluate((dd) => {
            const r = dd.getBoundingClientRect();
            return { left: r.left, right: r.right, width: r.width, height: r.height };
          });
          expect.soft(box.width * box.height, `${where}: rendered`).toBeGreaterThan(0);
          expect.soft(box.left, `${where}: left edge`).toBeGreaterThanOrEqual(0);
          expect.soft(box.right, `${where}: right edge`).toBeLessThanOrEqual(width);
          await SCREEN_SEMANTICS[name][state](c);
        }
      }
    });
  }
}

test("the semantics table covers every component and state the catalogue shows", () => {
  for (const name of COMPONENTS) expect(Object.keys(SEMANTICS[name])).toEqual([...CATALOG_STATES]);
  for (const name of SCREENS) expect(Object.keys(SCREEN_SEMANTICS[name])).toEqual([...CATALOG_STATES]);
});
