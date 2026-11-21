import { expect, test, type Locator, type Page } from "@playwright/test";

import { messagesHr as t } from "../../locales/hr.ts";
import { OUTLINE_HR } from "../../src/components/i18n/hr.ts";
import { messagesHr as lib } from "../../src/lib/i18n/messages.hr.ts";
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
const SCREENS = ["AppShell", "ErrorScreen", "RouteLoading", "StudentHome", "MyAssignments", "EmptyHome", "OutlinePanel", "TeacherCourses", "MentoredWorks", "AssignmentOverview"] as const;
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
  for (const button of [
    c.getByRole("button", { name: OUTLINE_HR.collapseAll, exact: true }),
    c.getByRole("button", { name: OUTLINE_HR.headingsOnly, exact: true }),
    c.getByRole("combobox", { name: OUTLINE_HR.levels }),
  ]) {
    expect(await button.evaluate((b) => b.getBoundingClientRect().right <= b.closest("dd")!.getBoundingClientRect().right)).toBe(true);
  }
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

/** Every id in the cell is the only one with that value on the page (DAN-871). */
const ownIds = async (c: Locator) => {
  const counts = await c.locator("[id]").evaluateAll((els) => els.map((el) => el.ownerDocument.querySelectorAll(`[id="${el.id}"]`).length));
  expect(counts.length).toBeGreaterThan(0);
  expect(counts.every((n) => n === 1)).toBe(true);
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
      await expect(c.getByRole("button", { name: OUTLINE_HR.headingsOnly })).toHaveAttribute("aria-pressed", "true");
    },
  },
  // DAN-871 (871-1): the teacher's courses; texts from locales/ only. Every state has
  // its own course ids, so each aria-labelledby names its own section (ownIds).
  TeacherCourses: {
    prazno: async (c) => {
      await expect(c.getByRole("heading", { level: 2 })).toHaveText(t.teacherCourses.empty);
      await expect(c.getByRole("link", { name: t.teacherCourses.newCourse })).toHaveAttribute("href", "/nastavnik/zadatak/novi");
      await expect(c.getByText(t.teacherCourses.countNote)).toHaveCount(0);
    },
    učitavanje: loading(t.workspace.panelLoading),
    greška: async (c) => {
      await expect(c.getByRole("status")).toHaveText(t.teacherCourses.worksUnavailable);
      await expect(c.locator('a[href^="/nastavnik/rad/"]')).toHaveCount(0);
      await ownIds(c);
    },
    puno: async (c) => {
      await expect(c.getByRole("heading", { level: 2 })).toHaveText(["Izmišljeni kolegij C", "Izmišljeni kolegij D"]);
      await expect(c.getByRole("list", { name: t.teacherCourses.worksLabel }).getByRole("listitem")).toHaveCount(3);
      await expect(c.getByText(t.teacherCourses.accommodation, { exact: false })).toHaveCount(1);
      await expect(c.getByText(t.teacherCourses.countNote)).toBeVisible();
      await ownIds(c);
      // Every link of a work stays inside its course card at every width (CI 360 px baseline, 871-1).
      const outside = await c.locator("section").evaluateAll((sections) => sections.flatMap((s) => {
        const edge = s.getBoundingClientRect().right;
        return [...s.querySelectorAll("li")].filter((li) => li.getBoundingClientRect().right > edge + 0.5).map((li) => li.textContent);
      }));
      expect(outside).toEqual([]);
    },
    onemogućeno: async (c) => {
      await expect(c.getByText(t.teacherCourses.noWorks)).toBeVisible();
      await expect(c.locator('a[href^="/nastavnik/rad/"]')).toHaveCount(0);
      await ownIds(c);
    },
  },
  // DAN-871 (871-2): mentored works by family name, Croatian order; texts from locales/ only.
  MentoredWorks: {
    prazno: async (c) => {
      await expect(c.getByRole("heading", { level: 2 })).toHaveText(t.mentoredWorks.empty);
      await expect(c.getByText(t.mentoredWorks.orderNote)).toHaveCount(0);
    },
    učitavanje: loading(t.workspace.panelLoading),
    greška: async (c) => {
      await expect(c.getByRole("listitem")).toHaveCount(1);
      await expect(c.getByText(t.mentoredWorks.unnamed)).toBeVisible();
      await expect(c.getByRole("link")).toHaveCount(0);
    },
    puno: async (c) => {
      await expect(c.getByRole("heading", { level: 2 })).toHaveText(t.mentoredWorks.listTitle);
      await expect(c.getByRole("listitem")).toHaveText([/^Borna Crtić/, /^Ante Čvorić/, /^Ana Izmišljenić/, /^Vesna Žbunić/]);
      await expect(c.getByRole("link", { name: t.mentoredWorks.open })).toHaveCount(3);
      await expect(c.getByText(t.mentoredWorks.orderNote)).toBeVisible();
      // Every row stays inside the list at every width (as TeacherCourses, 871-1).
      const outside = await c.locator("ul").evaluateAll((lists) => lists.flatMap((ul) => {
        const edge = ul.getBoundingClientRect().right;
        return [...ul.querySelectorAll("li, li > *")].filter((el) => el.getBoundingClientRect().right > edge + 0.5).map((el) => el.textContent);
      }));
      expect(outside).toEqual([]);
    },
    onemogućeno: async (c) => {
      await expect(c.getByText(t.mentoredWorks.state.not_started)).toBeVisible();
      await expect(c.getByRole("link")).toHaveCount(0);
    },
  },
  // WEB-33 (N-17): one assignment's submissions as a table; texts from src/lib/i18n only.
  AssignmentOverview: {
    prazno: async (c) => {
      await expect(c.locator("caption")).toHaveText("Predaje zadatka Izmišljeni seminar");
      await expect(c.getByRole("cell", { name: lib.teacherSummary.noStudents })).toBeVisible();
    },
    učitavanje: async (c) => {
      await expect(c.getByRole("table")).toHaveAttribute("aria-busy", "true");
      await expect(c.locator("tbody tr")).toHaveCount(1);
    },
    greška: async (c) => {
      await expect(c.getByRole("alert")).toHaveText(lib.teacherSummary.unavailable);
      await expect(c.getByRole("table")).toHaveCount(0);
      await expect(c.getByRole("link", { name: lib.teacherSummary.retry })).toHaveAttribute("href", "/nastavnik/zbirni");
    },
    puno: async (c) => {
      await expect(c.getByRole("columnheader")).toHaveText(Object.values(lib.teacherSummary.columns).map((h) => new RegExp(`^${h}`)));
      await expect(c.getByRole("rowheader")).toHaveText([/Osoba 1/, /Osoba 2/, /Osoba 3/, /Osoba 4/]);
      // Each state tag carries its text beside the colour (WEB-29).
      for (const [state, count, text] of [["submitted", 3, "Predano"], ["not_submitted", 1, "Nije predano"], ["late", 1, "Nakon roka"],
        ["gap", 1, "Praznina u zapisu"], ["pending", 1, "Čeka potvrdu"]] as const) {
        await expect(c.locator(`[data-state=${state}]`)).toHaveCount(count);
        await expect(c.locator(`[data-state=${state}]`).first()).toContainText(text);
      }
    },
    onemogućeno: async (c) => {
      await expect(c.getByRole("rowheader")).toHaveText(`${lib.teacherSummary.noName} · ${lib.teacherSummary.noGroup}`);
      await expect(c.getByRole("link")).toHaveCount(0);
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
      // Every component x surface x state is walked; the catalogue has outgrown the 30 s default on the CI runner.
      test.setTimeout(180_000);
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

// DAN-978 (978-3): "Samo naslovi" is a toggle with a constant label; each press is reported once,
// the list of headings stays, and the pressed state shows without colour.
test("headings only toggles, reports each press once and leaves the list", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "dark", 360);
  const c = cell(page, "OutlinePanel", "Ljuska", "puno");
  const only = c.getByRole("button", { name: OUTLINE_HR.headingsOnly, exact: true });
  const log = c.locator("[data-headings-log]");
  const look = () => only.evaluate((b) => [getComputedStyle(b).fontWeight, getComputedStyle(b).borderTopColor].join(" "));
  await expect(log).toHaveAttribute("data-headings-log", "");
  await expect(only).toHaveAttribute("aria-pressed", "false");
  const off = await look();
  await only.click();
  await expect(only).toHaveAttribute("aria-pressed", "true");
  expect((await look()).split(" ")[0]).not.toBe(off.split(" ")[0]);
  await only.press("Enter");
  await expect(only).toHaveAttribute("aria-pressed", "false");
  await only.press("Space");
  await expect(only).toHaveAttribute("aria-pressed", "true");
  await expect(log).toHaveAttribute("data-headings-log", "true,false,true");
  await expect(only).toBeFocused();
  await expect(outlineNav(c).locator("[data-number]:visible")).toHaveCount(6);
  // Without a listener (state onemogućeno, pressed from the start) a press still toggles, with no error.
  const quiet = cell(page, "OutlinePanel", "Ljuska", "onemogućeno").getByRole("button", { name: OUTLINE_HR.headingsOnly });
  await quiet.click();
  await expect(quiet).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

// DAN-979 (979-2), Linear acceptance: panel settings survive a reload; without storage the panel works with defaults.
const puno = (page: Page) => cell(page, "OutlinePanel", "Ljuska", "puno");
const uvod = (page: Page) => puno(page).getByRole("button", { name: "Potpoglavlja: 1 Uvod" });
const onlyButton = (page: Page) => puno(page).getByRole("button", { name: OUTLINE_HR.headingsOnly, exact: true });
const levelsChoice = (page: Page) => puno(page).getByRole("combobox", { name: OUTLINE_HR.levels });
const shownNumbers = (page: Page) => outlineNav(puno(page)).locator("[data-number]:visible");
async function changeAndReload(page: Page, errors: string[]) {
  await expect(uvod(page)).toHaveAttribute("aria-expanded", "true");
  await expect(onlyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(levelsChoice(page)).toHaveValue("3");
  await uvod(page).click();
  await onlyButton(page).click();
  await expect(uvod(page)).toHaveAttribute("aria-expanded", "false");
  await expect(onlyButton(page)).toHaveAttribute("aria-pressed", "true");
  // 979-3: the levels choice is saved too (and works in memory without a store).
  await levelsChoice(page).selectOption("2");
  await expect(shownNumbers(page)).toHaveText(["1", "2", "2.1"]);
  await page.reload();
  expect(errors).toEqual([]);
}

test("panel settings survive a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "dark", 1440);
  await changeAndReload(page, errors);
  await expect(uvod(page)).toHaveAttribute("aria-expanded", "false");
  await expect(puno(page).locator(`[id="${await uvod(page).getAttribute("aria-controls")}"]`)).toBeHidden();
  await expect(onlyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(levelsChoice(page)).toHaveValue("2");
  await expect(shownNumbers(page)).toHaveText(["1", "2", "2.1"]);
  // The restored state is not reported as a press: the editor reads the same store (README).
  await expect(puno(page).locator("[data-headings-log]")).toHaveAttribute("data-headings-log", "");
  expect(errors).toEqual([]);
});

for (const [name, script] of [
  ["a throwing localStorage", () => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("izmišljeno", "SecurityError"); } })],
  ["a full quota", () => { Storage.prototype.setItem = () => { throw new DOMException("izmišljeno", "QuotaExceededError"); }; }],
] as const) {
  test(`without storage (${name}) the panel works with defaults`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(script);
    await open(page, "light", 390);
    await changeAndReload(page, errors);
    await expect(uvod(page)).toHaveAttribute("aria-expanded", "true");
    await expect(onlyButton(page)).toHaveAttribute("aria-pressed", "false");
    await expect(levelsChoice(page)).toHaveValue("3");
    await expect(shownNumbers(page)).toHaveText(["1", "1.1", "1.1.1", "2", "2.1", "2.1.3"]);
    expect(errors).toEqual([]);
  });
}

// DAN-979 (979-3): the chosen level hides the headings below it and survives a reload; a search shows every level.
test("levels choice hides deeper headings and survives a reload", async ({ page }) => {
  await open(page, "dark", 360);
  const marked = puno(page).locator("[aria-current=location] > span [data-number]");
  const collapseAll = puno(page).getByRole("button", { name: OUTLINE_HR.collapseAll, exact: true });
  await levelsChoice(page).selectOption("1");
  await expect(shownNumbers(page)).toHaveText(["1", "2"]);
  await expect(outlineNav(puno(page)).getByRole("button")).toHaveCount(0);
  await expect(collapseAll).toHaveCount(0);
  await expect(marked).toHaveText("1");
  await levelsChoice(page).selectOption("2");
  await expect(shownNumbers(page)).toHaveText(["1", "1.1", "2", "2.1"]);
  await expect(marked).toHaveText("1.1");
  await collapseAll.click();
  await levelsChoice(page).selectOption("3");
  await expect(shownNumbers(page)).toHaveText(["1", "2"]);
  await puno(page).getByRole("button", { name: OUTLINE_HR.expandAll, exact: true }).click();
  await levelsChoice(page).selectOption("1");
  await page.reload();
  await expect(levelsChoice(page)).toHaveValue("1");
  await expect(shownNumbers(page)).toHaveText(["1", "2"]);
  const field = puno(page).getByRole("searchbox", { name: OUTLINE_HR.search });
  await field.fill("pojam");
  await expect(shownNumbers(page)).toHaveText(["1", "1.1", "1.1.1"]);
  await field.fill("");
  await expect(shownNumbers(page)).toHaveText(["1", "2"]);
  await expect(marked).toHaveText("1");
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
      await expect(links).toHaveCount(8); // logo, five items, "Kako Ductura radi", "Izjava o pristupačnosti" (WEB-1805)
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

// WEB-33 (N-17): sorting by submission time from the keyboard; rows without a time stay last.
test("the assignment overview sorts by submission time with Enter and Space", async ({ page }) => {
  await open(page, "dark", 390);
  const c = cell(page, "AssignmentOverview", "Ljuska", "puno");
  const header = c.getByRole("columnheader", { name: /Vrijeme predaje/ });
  const button = header.getByRole("button");
  const names = c.getByRole("rowheader");
  await button.focus();
  await button.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(names).toHaveText([/Osoba 3/, /Osoba 4/, /Osoba 1/, /Osoba 2/]);
  await expect(c.getByRole("status")).toHaveText("Poredano po stupcu Vrijeme predaje, uzlazno.");
  await button.press("Space");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await expect(names).toHaveText([/Osoba 1/, /Osoba 4/, /Osoba 3/, /Osoba 2/]);
  await expect(button).toBeFocused();
});
