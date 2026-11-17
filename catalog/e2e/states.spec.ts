import { expect, test, type Locator, type Page } from "@playwright/test";

import { messagesHr as t } from "../../locales/hr.ts";
import { OUTLINE_HR } from "../../src/components/i18n/hr.ts";
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
const SCREENS = ["AppShell", "ErrorScreen", "RouteLoading", "StudentHome", "MyAssignments", "EmptyHome", "OutlinePanel"] as const;
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
  await expect(c.locator('button[aria-controls^="bocna-navigacija-"]')).toHaveAttribute("aria-expanded", "false");
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

const home = t.student.home;
// The invented list of catalog/src/entries.tsx: course A with two assignments (the second's notice first), course B empty.
const studentList = async (c: Locator) => {
  const links = c.locator('a[href^="/rad?zadatak="]');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toContainText(home.open);
  await expect(links.nth(1)).toContainText(home.readNotice);
  await expect(c.getByText("Rok: 30. studenoga 2026. u 23:59")).toHaveCount(1);
  await expect(c.getByText(t.student.assignments.noAssignments)).toHaveCount(1);
  await expect(c.locator('[data-motif="city"]')).toHaveCount(1);
  await expect(c.locator('[data-motif="research"]')).toHaveCount(1);
};
const unavailable = async (c: Locator) => {
  await expect(c.getByRole("alert")).toContainText(home.unavailableHeading);
  await expect(c.getByRole("alert")).toContainText(home.unavailableBody);
  await expect(c.locator('a[href^="/rad?zadatak="]')).toHaveCount(0);
};
const firstArrival = async (c: Locator) => {
  await expect(c.getByRole("heading", { name: home.empty.heading })).toBeVisible();
  await expect(c.getByRole("heading", { name: home.empty.codeHeading })).toBeVisible();
  await expect(c.locator("ol > li")).toHaveCount(3);
  await expect(c.getByRole("alert")).toHaveCount(0);
};

// DAN-977 (977-2): the outline of entries.tsx, three levels; one number per item, nothing sticks out.
const outlineNav = (c: Locator) => c.getByRole("navigation", { name: t.outline.label });
const outlineList = (numbers: string[]) => async (c: Locator) => {
  const nav = outlineNav(c);
  await expect(nav.locator("ol[data-depth]")).toHaveCount(5);
  await expect(nav.locator("ol[data-depth='3'] > li")).toHaveCount(2);
  await expect(nav.locator("[data-number]")).toHaveText(numbers);
  expect(await nav.locator("li").evaluateAll((li) => li.map((e) => getComputedStyle(e).listStyleType)))
    .toEqual(Array(6).fill("none"));
  const fit = await nav.evaluate((n) => ({
    scroll: n.scrollWidth <= n.clientWidth,
    inside: n.getBoundingClientRect().right <= n.closest("dd")!.getBoundingClientRect().right,
  }));
  expect(fit).toEqual({ scroll: true, inside: true });
  // The search field (978-1) sits outside the nav and must fit the cell too.
  const field = c.getByRole("searchbox", { name: OUTLINE_HR.search });
  expect(await field.evaluate((f) => f.getBoundingClientRect().right <= f.closest("dd")!.getBoundingClientRect().right)).toBe(true);
  const all = c.getByRole("button", { name: OUTLINE_HR.collapseAll, exact: true });
  expect(await all.evaluate((b) => b.getBoundingClientRect().right <= b.closest("dd")!.getBoundingClientRect().right)).toBe(true);
};

/**
 * DAN-891 (891-1): where the text of the h1 and of its lede sits in the
 * screen's root, measured on the text itself (a Range), not on the block box.
 * "centre": both centred within 1 px; "start": the h1 starts at the content edge.
 */
const headingAt = (where: "centre" | "start") => async (c: Locator) => {
  const m = await c.locator(":scope > div").first().evaluate((root) => {
    const style = getComputedStyle(root);
    const r = root.getBoundingClientRect();
    const left = r.left + parseFloat(style.paddingLeft);
    const right = r.right - parseFloat(style.paddingRight);
    const text = (el: Element | null) => {
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const b = range.getBoundingClientRect();
      return { left: b.left, centre: (b.left + b.right) / 2 };
    };
    return { centre: (left + right) / 2, left, h1: text(root.querySelector("h1")), lede: text(root.querySelector("h1 + p")) };
  });
  expect(m.h1).not.toBeNull();
  if (where === "start") {
    expect(Math.abs(m.h1!.left - m.left)).toBeLessThanOrEqual(1);
    return;
  }
  expect(Math.abs(m.h1!.centre - m.centre)).toBeLessThanOrEqual(1);
  expect(m.lede).not.toBeNull();
  expect(Math.abs(m.lede!.centre - m.centre)).toBeLessThanOrEqual(1);
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
  StudentHome: {
    prazno: async (c) => {
      await expect(c.getByRole("heading", { level: 1 })).toHaveText(home.heading);
      await firstArrival(c);
      await headingAt("centre")(c);
    },
    učitavanje: loading(t.workspace.panelLoading),
    greška: async (c) => {
      await expect(c.getByRole("heading", { level: 1 })).toHaveText(home.heading);
      await unavailable(c);
      await expect(c.getByRole("link", { name: t.auth.retry })).toHaveAttribute("href", "/zadaci");
      // Negative: the unavailable state keeps its heading at the start (891-1 centres only a list that loaded).
      await headingAt("start")(c);
    },
    puno: async (c) => {
      await expect(c.getByText(home.lede)).toBeVisible();
      await expect(c.locator('a[href="/upis"]')).toHaveCount(1);
      await studentList(c);
      await headingAt("centre")(c);
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("status")).toHaveText(t.student.assignments.signedOut);
      await expect(c.getByRole("link", { name: t.student.signIn })).toHaveAttribute("href", "/prijava?returnTo=%2Fzadaci");
      await expect(c.locator('a[href^="/rad?zadatak="]')).toHaveCount(0);
    },
  },
  MyAssignments: {
    prazno: async (c) => {
      await expect(c.getByRole("heading", { level: 3 })).toHaveText("Izmišljeni kolegij B");
      await expect(c.getByText(t.student.assignments.noAssignments)).toBeVisible();
    },
    učitavanje: loading(t.workspace.panelLoading),
    greška: async (c) => {
      await expect(c.getByRole("heading", { level: 1 })).toHaveText(home.courses);
      await unavailable(c);
      await expect(c.getByRole("link", { name: t.auth.retry })).toHaveAttribute("href", "/zadaci/kolegiji");
      await headingAt("start")(c);
    },
    puno: async (c) => {
      await expect(c.getByRole("heading", { level: 3 })).toHaveCount(2);
      await studentList(c);
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("heading", { level: 2 })).toHaveCount(2);
      await expect(c.getByRole("heading", { level: 3 })).toHaveCount(0);
    },
  },
  EmptyHome: {
    prazno: firstArrival,
    učitavanje: loading(t.workspace.panelLoading),
    greška: unavailable,
    puno: firstArrival,
    onemogućeno: firstArrival,
  },
  OutlinePanel: {
    prazno: async (c) => {
      await expect(outlineNav(c)).toHaveText(t.workspace.structureEmpty);
      await expect(c.locator("ol")).toHaveCount(0);
    },
    učitavanje: loading(t.workspace.panelLoading),
    greška: async (c) => {
      await expect(outlineNav(c).locator("li")).toHaveCount(1);
      await expect(c.getByText(t.outline.untitledHeading, { exact: true })).toHaveCount(1);
      await expect(c.getByText(/Nula|Četiri/)).toHaveCount(0);
      await expect(c.getByRole("alert")).toHaveCount(0);
    },
    puno: async (c) => {
      await outlineList(["1", "1.1", "1.1.1", "2", "2.1", "2.1.3"])(c);
      await expect(c.locator("[aria-current=location]")).toHaveCount(1);
      await expect(c.locator("[aria-current=location] [data-number]")).toHaveText("1.1.1");
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("searchbox", { name: OUTLINE_HR.search })).toHaveValue("uzorak");
      await expect(outlineNav(c).locator("li > span")).toHaveText(["Metoda", "Izmišljeni uzorak"]);
      await expect(c.locator("[data-number]")).toHaveCount(0);
      await expect(outlineNav(c).getByRole("button")).toHaveCount(0);
      await expect(c.locator("[aria-current=location] > span")).toHaveText("Izmišljeni uzorak");
      await expect(c.getByRole("status")).toHaveText("");
    },
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

// DAN-977 (977-3): a branch collapses and opens by mouse, Enter and Space; the active
// chapter's mark moves to the visible parent and back, and focus stays on the toggle.
test("an outline branch collapses and opens, and the active chapter stays marked once", async ({ page }) => {
  await open(page, "dark", 390);
  const c = cell(page, "OutlinePanel", "Ljuska", "puno");
  const toggle = c.getByRole("button", { name: "Potpoglavlja: 1 Uvod" });
  const child = c.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
  const marked = c.locator("[aria-current=location]");
  for (const act of [() => toggle.click(), () => toggle.press("Enter"), () => toggle.press("Space")]) {
    await act();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(child).toBeHidden();
    await expect(c.getByText("Izmišljeni pojam")).toBeHidden();
    await expect(marked).toHaveCount(1);
    await expect(marked.locator(":scope > span [data-number]")).toHaveText("1");
    await expect(toggle).toBeFocused();
    await act();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(child).toBeVisible();
    await expect(marked.locator(":scope > span [data-number]")).toHaveText("1.1.1");
  }
});

// DAN-978 (978-1): a hit in a subheading shows its parents open, without toggles; clearing
// the query brings the collapsed branch back.
test("an outline search shows the parents of a hit and gives the collapsed state back", async ({ page }) => {
  await open(page, "light", 360);
  const c = cell(page, "OutlinePanel", "Ljuska", "puno");
  const toggle = c.getByRole("button", { name: "Potpoglavlja: 1 Uvod" });
  const child = c.locator(`[id="${await toggle.getAttribute("aria-controls")}"]`);
  await toggle.click();
  await expect(child).toBeHidden();
  const field = c.getByRole("searchbox", { name: OUTLINE_HR.search });
  await field.fill("pojam");
  await expect(outlineNav(c).locator("[data-number]")).toHaveText(["1", "1.1", "1.1.1"]);
  await expect(c.getByText("Izmišljeni pojam", { exact: true })).toBeVisible();
  await expect(outlineNav(c).getByRole("button")).toHaveCount(0);
  await field.fill("nema takvog");
  await expect(c.getByRole("status")).toHaveText(OUTLINE_HR.noMatch);
  await expect(outlineNav(c).locator("li")).toHaveCount(0);
  await field.fill("");
  await expect(c.getByRole("status")).toHaveText("");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(child).toBeHidden();
  await expect(outlineNav(c).locator("[data-number]:visible")).toHaveText(["1", "2", "2.1", "2.1.3"]);
});

// DAN-978 (978-2): "Sklopi sve" leaves only the roots, with the mark on the active chapter's root;
// a single toggle still works after it, and "Rasklopi sve" brings everything back.
test("collapse all leaves the roots and keeps the active chapter marked once", async ({ page }) => {
  await open(page, "dark", 360);
  const c = cell(page, "OutlinePanel", "Ljuska", "puno");
  const numbers = outlineNav(c).locator("[data-number]:visible");
  const marked = c.locator("[aria-current=location] > span [data-number]");
  const collapse = c.getByRole("button", { name: OUTLINE_HR.collapseAll, exact: true });
  const expand = c.getByRole("button", { name: OUTLINE_HR.expandAll, exact: true });
  await collapse.click();
  await expect(numbers).toHaveText(["1", "2"]);
  await expect(marked).toHaveText("1");
  await expect(expand).toBeFocused();
  await c.getByRole("button", { name: "Potpoglavlja: 1 Uvod" }).click();
  await expect(numbers).toHaveText(["1", "1.1", "2"]);
  await expect(marked).toHaveText("1.1");
  await expect(collapse).toBeVisible();
  await collapse.click();
  await expand.press("Enter");
  await expect(numbers).toHaveText(["1", "1.1", "1.1.1", "2", "2.1", "2.1.3"]);
  await expect(marked).toHaveText("1.1.1");
  await expect(collapse).toBeFocused();
});

test("the semantics table covers every component and state the catalogue shows", () => {
  for (const name of COMPONENTS) expect(Object.keys(SEMANTICS[name])).toEqual([...CATALOG_STATES]);
  for (const name of SCREENS) expect(Object.keys(SCREEN_SEMANTICS[name])).toEqual([...CATALOG_STATES]);
});

// DAN-891 (891-3, D-202 t. 1): from 800 px the shell's side bar is the reference's
// 64 px rail; below it, the same drawer behind ☰ as before. Negative cases first.
test("below 800 px the side bar stays a 248 px drawer behind ☰", async ({ page }) => {
  for (const width of [768, 390]) {
    await open(page, "dark", width);
    const c = cell(page, "AppShell", "Ljuska", "puno");
    const aside = c.locator("aside");
    await expect(aside).toBeHidden();
    await c.getByRole("button", { name: t.shell.openNav }).click();
    await expect(aside).toBeVisible();
    expect((await aside.boundingBox())!.width, `${width} px`).toBe(248);
    const item = aside.getByRole("link", { name: t.shell.nav.assignments });
    expect(await item.evaluate((a) => getComputedStyle(a).textAlign), `${width} px`).not.toBe("center");
  }
});

for (const theme of THEMES) {
  for (const width of [1440, 1024, 800]) {
    test(`${theme} shell at ${width} px: the side bar is a 64 px rail from 800 px`, async ({ page }) => {
      await open(page, theme, width);
      const c = cell(page, "AppShell", "Ljuska", "puno");
      const aside = c.locator("aside");
      const rail = (await aside.boundingBox())!;
      expect(rail.width).toBe(64);
      const area = (await c.locator("header").boundingBox())!;
      expect(Math.abs(area.x - (rail.x + rail.width))).toBeLessThanOrEqual(0.5);

      const links = aside.locator("a");
      await expect(links).toHaveCount(7); // logo, five items, "Kako Ductura radi"
      for (const box of await links.evaluateAll((all) => all.map((a) => a.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.left).toBeGreaterThanOrEqual(rail.x);
        expect(box.right).toBeLessThanOrEqual(rail.x + rail.width);
      }
      // The text itself, not only its box: nothing is cut off at the rail's edge.
      const texts = await aside.evaluate((a) => [...a.querySelectorAll("a, span")]
        .filter((el) => el.textContent!.trim() !== "" && el.getClientRects().length > 0)
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const b = range.getBoundingClientRect();
          return { text: el.textContent!.trim(), left: b.left, right: b.right };
        }));
      const n = t.shell.nav;
      expect(texts.map((x) => x.text)).toEqual(expect.arrayContaining(
        [n.assignments, n.courses, n.works, n.workspace, n.enroll, t.shell.howItWorks, t.shell.role.student]));
      for (const x of texts) {
        expect(x.left, x.text).toBeGreaterThanOrEqual(rail.x);
        expect(x.right, x.text).toBeLessThanOrEqual(rail.x + rail.width);
      }
      await expect(aside.getByText(t.shell.role.student, { exact: true })).toBeVisible();
    });
  }
}
