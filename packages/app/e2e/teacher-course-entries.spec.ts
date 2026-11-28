// WEB-NUZ-NZ (NZ-1, NZ-2, NZ-10): the teacher reaches every screen of an assignment from the course card,
// chooses the assignment for an extension or the Merlin export (one whose deadline has passed too), and
// reads the overview and the roster with the facts the contract gives. axe at 390 and 1280 px in the dark
// and the light theme; the chooser by keyboard. The institution server is faked per test; invented data only.
import AxeBuilder from "@axe-core/playwright";

import { BLOCKING, WCAG_TAGS } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";

const K1 = "6b1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";
const A1 = "6b1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c11";
const A2 = "6b1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c12";
const S1 = "6b2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c21";
const S2 = "6b2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c22";
const S3 = "6b2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c23";
const TEACHER = "6b3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const task = (id: string, title: string, dueAt: string) => ({
  id, title, workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z", dueAt, currentVersion: 1, enrolledStudents: 3,
});
const COURSE = {
  id: K1, name: "Izmišljeni kolegij ulaza", academicYear: "2026/2027", aiPolicy: "partially_allowed",
  assignments: [task(A1, "Izmišljeni seminar", "2099-12-15T22:59:00.000Z"), task(A2, "Izmišljeni esej", "2026-11-08T22:59:00.000Z")],
};
const person = (studentId: string, givenName: string) => ({ studentId, givenName, familyName: "Izmišljenić", groupName: "Grupa 2" });
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

async function teacher(page: Page, { students = true } = {}) {
  await page.route("**/api/v1/me", (route) => route.fulfill(json({
    role: "teacher", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" },
  })));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json({ courses: [COURSE] })));
  await page.route(`**/api/v1/courses/${K1}/team/view`, (route) => route.fulfill(json({
    role: "holder", holderId: TEACHER, assistants: [], students: [], groups: [],
  })));
  await page.route(`**/api/v1/courses/${K1}/team/candidates`, (route) => route.fulfill(json({ candidates: [] })));
  await page.route(`**/api/v1/courses/${K1}/team`, (route) => route.request().method() === "GET"
    ? route.fulfill(json({ holderId: TEACHER, assistantIds: [] })) : route.fallback());
  await page.route(`**/api/v1/institution/assignments/*`, (route) => route.fulfill(json({ code: "not_found" }, 404)));
  await page.route(`**/api/v1/teacher/courses/${K1}/students`, (route) => route.fulfill(json({ students: students ? [
    { ...person(S1, "Ana"), assignments: [{ assignmentId: A1, documentId: "izmisljeni-rad-1", workState: "submitted" }, { assignmentId: A2, documentId: null, workState: "not_started" }] },
    { ...person(S2, "Iva"), assignments: [{ assignmentId: A1, documentId: "izmisljeni-rad-2", workState: "in_progress" }, { assignmentId: A2, documentId: null, workState: "not_started" }] },
    { ...person(S3, "Luka"), assignments: [{ assignmentId: A1, documentId: null, workState: "not_started" }, { assignmentId: A2, documentId: null, workState: "not_started" }] },
  ] : [] })));
  const overview = [
    { ...person(S1, "Ana"), submitted: true, requestedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: false, evidenceRecord: "continuous" },
    { ...person(S2, "Iva"), submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
    { ...person(S3, "Luka"), submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
  ];
  for (const id of [A1, A2]) {
    await page.route(`**/api/v1/teacher/assignments/${id}/overview`, (route) => route.fulfill(json({ students: id === A1 ? overview : overview.map((r) => ({ ...r, submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null })) })));
    await page.route(`**/api/v1/teacher/assignments/${id}/submissions`, (route) => route.fulfill(json({ submissions: id === A1
      ? [{ studentId: S1, documentId: "izmisljeni-rad-1", submitted: true, revision: 3, requestedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: false }] : [] })));
    await page.route(`**/api/v1/teacher/assignments/${id}/deadline-extensions`, (route) => route.request().method() === "GET"
      ? route.fulfill(json({ extensions: id === A1 ? [{
        id: "6b4b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41", scope: "one", studentId: S2, previousDueAt: "2099-12-15T22:59:00.000Z",
        dueAt: "2099-12-20T22:59:00.000Z", reasonId: "justified", createdBy: TEACHER, createdAt: "2026-11-20T08:00:00.000Z",
      }] : [] }))
      : route.fallback());
  }
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.filter((v) => BLOCKING.includes(v.impact ?? "")).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("NZ-1: every assignment of the card leads to its own screens", async ({ page }) => {
  await teacher(page);
  await page.goto("/aplikacija/nastavnik");
  const entries = page.getByRole("group", { name: "Radnje zadatka: Izmišljeni esej" });
  await expect(entries.getByRole("link")).toHaveText(["Predaje", "Uredi (nova verzija)", "Dupliciraj zadatak", "Produljenje", "Izvoz", "Brz put kroz radove"]);
  await expect(entries.getByRole("link", { name: /Brz put kroz radove/ })).toHaveAttribute("href", `/aplikacija/nastavnik/brz-put?zadatak=${A2}`);
  await expect(entries.getByRole("link", { name: /Dupliciraj zadatak/ })).toHaveAttribute("href", `/aplikacija/nastavnik/zadatak/${A2}/uredi?kopiraj=1`);
  await expect(page.getByRole("link", { name: "Zbirni pregled", exact: true })).toHaveAttribute("href", `/aplikacija/nastavnik/zbirni?kolegij=${K1}`);
});

test("NZ-2: the extension chooser offers a passed deadline and N-13 says it has passed", async ({ page }) => {
  await teacher(page);
  await page.goto("/aplikacija/nastavnik");
  // By keyboard: focus the button, open with Enter, choose, go.
  await page.getByRole("button", { name: "Produljenje roka…" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Produljenje roka" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nastavi" }).click();
  await expect(dialog.getByText("Odaberite zadatak da biste nastavili.")).toBeVisible();
  await dialog.getByLabel("Zadatak").selectOption({ label: "Izmišljeni esej, rok je prošao" });
  await dialog.getByRole("link", { name: "Nastavi" }).click();
  await expect(page).toHaveURL(`/aplikacija/nastavnik/zadatak/${A2}/produljenje`);
  await expect(page.getByText("Rok ovog zadatka je prošao.")).toBeVisible();
  await expect(page.getByText(/posebnu iznimku za predaju nakon roka.*oznaku „iznimka”/)).toBeVisible();
});

test("NZ-2: the Merlin chooser goes to the export of the chosen assignment", async ({ page }) => {
  await teacher(page);
  await page.goto("/aplikacija/nastavnik");
  await page.getByRole("button", { name: "Izvoz za Merlin…" }).click();
  const dialog = page.getByRole("dialog", { name: "Izvoz za Merlin" });
  await dialog.getByLabel("Zadatak").selectOption({ label: "Izmišljeni seminar, rok 15. 12. 2099. u 23:59" });
  await expect(dialog.getByRole("link", { name: "Nastavi" })).toHaveAttribute("href", `/aplikacija/nastavnik/zadatak/${A1}/merlin`);
});

test("NZ-1: the redirect of /nastavnik/kolegiji keeps the interrupted-publish banner", async ({ page }) => {
  await teacher(page);
  await page.goto("/aplikacija/nastavnik/kolegiji?objava=prekinuta&zadatak=Izmi%C5%A1ljeni%20esej");
  await expect(page).toHaveURL(/\/aplikacija\/nastavnik\?objava=prekinuta&zadatak=/);
  await expect(page.getByText("Objava zadatka „Izmišljeni esej” prekinuta je i ishod nije poznat.")).toBeVisible();
});

test("NZ-10: the overview of one course joins version, state, deadline and the link to the work", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/zbirni?kolegij=${K1}`);
  await expect(page.getByText("Kolegij: Izmišljeni kolegij ulaza.")).toBeVisible();
  const card = page.getByRole("region", { name: /Izmišljeni seminar/ }).first();
  const table = page.getByRole("region", { name: "Tablica predaja" }).first();
  await expect(table.getByRole("columnheader")).toHaveText(["Student", "Stanje", "Predaja", "Nakon roka", "Rok", "Stanje zapisa", "Dorada"]);
  await expect(table.getByRole("row", { name: /Ana Izmišljenić/ })).toContainText("5. 11. 2026. u 21:14, verzija 3");
  await expect(table.getByRole("link", { name: "Ana Izmišljenić" })).toHaveAttribute("href", "/aplikacija/nastavnik/rad/izmisljeni-rad-1");
  await expect(table.getByRole("row", { name: /Iva Izmišljenić/ })).toContainText("u pisanju, rok produljen");
  await expect(table.getByRole("row", { name: /Iva Izmišljenić/ })).toContainText("Rok produljen do 20. 12. 2099. u 23:59");
  await expect(table.getByRole("row", { name: /Luka Izmišljenić/ })).toContainText("nije započeo");
  await expect(card).toBeVisible();
  await expect(page.getByRole("group", { name: "Radnje zadatka: Izmišljeni esej" }).getByRole("link", { name: "Produljenje" }))
    .toHaveAttribute("href", `/aplikacija/nastavnik/zadatak/${A2}/produljenje`);
});

test("F4-PM2-R08: the overview shows the accommodation mark the server holds, only on the marked student; axe", async ({ page }) => {
  await teacher(page);
  const asked: string[] = [];
  // D-50: the server answers the mark only (teacher.student-accommodation.get); Ana is marked, the others are not.
  await page.route("**/api/v1/teacher/assignments/*/students/*/accommodation", (route) => {
    asked.push(route.request().url());
    return route.fulfill(json({ marked: route.request().url().includes(S1) }));
  });
  await page.goto(`/aplikacija/nastavnik/zbirni?kolegij=${K1}`);
  const table = page.getByRole("region", { name: "Tablica predaja" }).first();
  await expect(table.getByRole("row", { name: /Ana Izmišljenić/ })).toBeVisible();
  await expect(page.getByText("Oznake odobrene prilagodbe trenutačno nisu dostupne. Pokušajte ponovno.")).toHaveCount(0);
  await expect(table.getByRole("row", { name: /Ana Izmišljenić/ }).getByText("(odobrena prilagodba)")).toBeVisible();
  await expect(table.getByRole("row", { name: /Iva Izmišljenić/ }).getByText("(odobrena prilagodba)")).toHaveCount(0);
  expect(asked.length).toBeGreaterThan(0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await axe(page)).toEqual([]);
  }
});

test("NZ-10: the roster says time, version and the extended deadline", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/kolegiji/${K1}/studenti`);
  const ana = page.getByTestId("n04-student").filter({ hasText: "Ana Izmišljenić" });
  await expect(ana).toContainText("Predano 5. 11. 2026. u 21:14, prije roka, verzija 3, zapis je cjelovit");
  await expect(page.getByTestId("n04-student").filter({ hasText: "Iva Izmišljenić" })).toContainText("Rok produljen do 20. 12. 2099. u 23:59.");
});

test("NZ-1: an empty roster's „Izdaj novi kod” opens dk-h on the course card", async ({ page }) => {
  await teacher(page, { students: false });
  await page.goto(`/aplikacija/nastavnik/kolegiji/${K1}/studenti`);
  await page.getByRole("link", { name: "Izdaj novi kod" }).click();
  await expect(page).toHaveURL(`/aplikacija/nastavnik?kod=${K1}`);
  await expect(page.getByRole("dialog", { name: "Izdati novi kod za upis?" })).toBeVisible();
});

test("NZ-1: Brz put without an assignment shows the first one with the chooser", async ({ page }) => {
  await teacher(page);
  await page.route("**/api/v1/teacher/fast-path", (route) => route.fulfill(json({ kind: "ok", students: [] })));
  await page.goto("/aplikacija/nastavnik/brz-put");
  await expect(page.getByLabel("Zadatak")).toHaveValue(A1);
  await page.getByLabel("Zadatak").selectOption(A2);
  await expect(page).toHaveURL("/aplikacija/nastavnik/brz-put");
  await page.getByRole("button", { name: "Otvori" }).click();
  await expect(page).toHaveURL(`/aplikacija/nastavnik/brz-put?zadatak=${A2}`);
});

test("NZ-1: the Brz put chooser opens an assignment only through Otvori, by keyboard, and keeps the focus", async ({ page }) => {
  await teacher(page);
  await page.route("**/api/v1/teacher/fast-path", (route) => route.fulfill(json({ kind: "ok", students: [] })));
  await page.goto(`/aplikacija/nastavnik/brz-put?zadatak=${A1}`);
  const chooser = page.getByLabel("Zadatak");
  await expect(chooser).toHaveValue(A1);
  await chooser.focus();
  // An arrow key on the closed select only chooses (WCAG 3.2.2): no navigation, the focus stays.
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(`/aplikacija/nastavnik/brz-put?zadatak=${A1}`);
  await expect(chooser).toBeFocused();
  await chooser.selectOption(A2);
  await expect(page).toHaveURL(`/aplikacija/nastavnik/brz-put?zadatak=${A1}`);
  await page.keyboard.press("Tab");
  const open = page.getByRole("button", { name: "Otvori" });
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/aplikacija/nastavnik/brz-put?zadatak=${A2}`);
  await expect(page.getByLabel("Zadatak")).toHaveValue(A2);
  await expect(open).toBeFocused();
});

test("NZ-1 and NZ-2: the empty overview leads to the assignment form", async ({ page }) => {
  await teacher(page);
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json({ courses: [] })));
  await page.goto("/aplikacija/nastavnik/zbirni");
  await expect(page.getByRole("link", { name: "Dodaj zadatak" })).toHaveAttribute("href", "/aplikacija/nastavnik/zadatak/novi");
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`axe: card with the chooser open and the overview, ${width} px, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);
      await page.goto("/aplikacija/nastavnik");
      await page.locator("html").evaluate((html, value) => html.setAttribute("data-theme", value), theme);
      await expect(page.getByRole("group", { name: "Radnje zadatka: Izmišljeni esej" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.getByRole("button", { name: "Produljenje roka…" }).click();
      await expect(page.getByRole("dialog", { name: "Produljenje roka" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto(`/aplikacija/nastavnik/zbirni?kolegij=${K1}`);
      await page.locator("html").evaluate((html, value) => html.setAttribute("data-theme", value), theme);
      await expect(page.getByText("verzija 3")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll).toBeLessThanOrEqual(0);
    });
  }
}
