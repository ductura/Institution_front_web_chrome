// WEB-NF4-KOLEGIJ-2 (NZ-11, NZ-13, NZ-14, NZ-16; docs/nalazi/nove-funkcije-4-nastavnik-kolegiji-zadaci.md):
// the roster's state filter and order, the enrolment code's state, revocation and one-time display, the roles
// on the course and the teaching team, and the Merlin export from preparing the package to downloading it.
// Keyboard where the flow is driven; axe at 390 and 1280 px in the dark and the light theme. The institution
// server is faked per test (page.route over the contract defaults); invented people and courses only.
import AxeBuilder from "@axe-core/playwright";

import { BLOCKING, WCAG_TAGS } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";

const K1 = "7c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";
const A1 = "7c1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c11";
const A2 = "7c1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c12";
const S1 = "7c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c21";
const S2 = "7c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c22";
const S3 = "7c2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c23";
const TEACHER = "7c3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const ASSISTANT = "7c3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c32";
const GROUP = "7c4b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41";
const PACKAGE = "7c5b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c51";
const COURSE_NAME = "Izmišljeni kolegij upisa";
const CODE = "A1B2-C3D4-E5F6-0789";
const SHA = "c".repeat(64);

const COURSE = {
  id: K1, name: COURSE_NAME, academicYear: "2026/2027", aiPolicy: "partially_allowed",
  assignments: [
    { id: A1, title: "Izmišljeni seminar", workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z", dueAt: "2026-11-04T22:59:00.000Z", currentVersion: 1, enrolledStudents: 3 },
    { id: A2, title: "Izmišljeni završni rad", workType: "bachelor_thesis", opensAt: "2026-10-01T08:00:00.000Z", dueAt: "2099-06-30T21:59:00.000Z", currentVersion: 1, enrolledStudents: 3 },
  ],
};
// Ana submitted after the deadline, Iva is writing, Luka has not started (the same state in both assignments).
const PEOPLE = [
  { studentId: S1, givenName: "Ana", familyName: "Babić", state: "submitted" },
  { studentId: S2, givenName: "Iva", familyName: "Horvat", state: "in_progress" },
  { studentId: S3, givenName: "Luka", familyName: "Zorić", state: "not_started" },
] as const;
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

type Role = "holder" | "assistant";
type Calls = { codeState: number; revocations: number; issued: string[]; team: string[][]; packages: string[] };

async function teacher(page: Page, { role = "holder" as Role, code = "valid" as "valid" | "none" } = {}): Promise<Calls> {
  const calls: Calls = { codeState: 0, revocations: 0, issued: [], team: [], packages: [] };
  let assistantIds: string[] = [];
  await page.route("**/api/v1/me", (route) => route.fulfill(json({
    role: "teacher", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" },
  })));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json({ courses: [COURSE] })));
  await page.route(`**/api/v1/courses/${K1}/team/view`, (route) => route.fulfill(json(role === "holder" ? {
    role: "holder", holderId: TEACHER, assistants: [{ id: ASSISTANT, name: "Marko Izmišljeni" }],
    students: PEOPLE.map((p) => ({ id: p.studentId, name: `${p.givenName} ${p.familyName}`, groupId: GROUP })),
    groups: [{ id: GROUP, name: "Grupa 2", assistantIds: [] }],
  } : {
    role: "assistant",
    groups: [{ id: GROUP, name: "Grupa 2", students: PEOPLE.map((p) => ({ id: p.studentId, name: `${p.givenName} ${p.familyName}` })) }],
  })));
  await page.route(`**/api/v1/courses/${K1}/team/candidates`, (route) => route.fulfill(json({ candidates: [] })));
  await page.route(`**/api/v1/courses/${K1}/team`, async (route) => {
    if (route.request().method() === "GET") return route.fulfill(json({ holderId: TEACHER, assistantIds }));
    assistantIds = (route.request().postDataJSON() as { assistantIds: string[] }).assistantIds;
    calls.team.push(assistantIds);
    return route.fulfill(json({ updated: true }));
  });
  await page.route(`**/api/v1/institution/courses/${K1}/enrollment-code/state`, (route) => {
    calls.codeState += 1;
    return route.fulfill(json({ current: code === "valid" ? { validUntil: "2099-12-01T22:59:00.000Z" } : null }));
  });
  await page.route(`**/api/v1/institution/courses/${K1}/enrollment-code/revocation`, (route) => {
    calls.revocations += 1;
    return route.fulfill(json({ revoked: true }));
  });
  await page.route(`**/api/v1/institution/courses/${K1}/enrollment-code`, (route) => {
    calls.issued.push((route.request().postDataJSON() as { validUntil: string }).validUntil);
    return route.fulfill(json({ code: CODE }));
  });
  await page.route("**/api/v1/institution/assignments/*", (route) => route.fulfill(json({ code: "not_found" }, 404)));
  await page.route(`**/api/v1/teacher/courses/${K1}/students`, (route) => route.fulfill(json({ students: PEOPLE.map((p) => ({
    studentId: p.studentId, givenName: p.givenName, familyName: p.familyName, groupName: "Grupa 2",
    assignments: [A1, A2].map((assignmentId) => ({
      assignmentId, documentId: p.state === "not_started" ? null : `izmisljeni-rad-${p.givenName.toLowerCase()}`, workState: p.state,
    })),
  })) })));
  for (const id of [A1, A2]) {
    await page.route(`**/api/v1/teacher/assignments/${id}/overview`, (route) => route.fulfill(json({ students: PEOPLE.map((p) => ({
      studentId: p.studentId, givenName: p.givenName, familyName: p.familyName, groupName: "Grupa 2",
      submitted: p.state === "submitted", requestedMinute: p.state === "submitted" ? "2026-11-05T20:14:00.000Z" : null,
      afterDeadline: p.state === "submitted" ? true : null, evidenceRecord: p.state === "submitted" ? "continuous" : null,
    })) })));
    await page.route(`**/api/v1/teacher/assignments/${id}/submissions`, (route) => route.fulfill(json({ submissions: [
      { studentId: S1, documentId: "izmisljeni-rad-ana", submitted: true, revision: 2, requestedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: true },
    ] })));
    await page.route(`**/api/v1/teacher/assignments/${id}/deadline-extensions`, (route) => route.fulfill(json({ extensions: [] })));
  }
  // NZ-16: A1 has one submitted work, A2 none. The package is queued on the first read and ready on the next.
  const row = (familyName: string, givenName: string) => ({
    familyName, givenName, submitted: false, submittedMinute: null, afterDeadline: null, pdfName: null, pdfSha256: null, docxName: null, docxSha256: null,
  });
  await page.route(`**/api/v1/teacher/assignments/${A1}/merlin/roster`, (route) => route.fulfill(json({ rows: [
    { familyName: "Babić", givenName: "Ana", submitted: true, submittedMinute: "2026-11-05T20:14:00.000Z", afterDeadline: true,
      pdfName: "babic-ana-1a2b3c4d.pdf", pdfSha256: "a".repeat(64), docxName: "babic-ana-1a2b3c4d.docx", docxSha256: "b".repeat(64) },
    row("Horvat", "Iva"), row("Zorić", "Luka"),
  ], extensionReasons: [] })));
  await page.route(`**/api/v1/teacher/assignments/${A2}/merlin/roster`, (route) => route.fulfill(json({
    rows: [row("Babić", "Ana"), row("Horvat", "Iva"), row("Zorić", "Luka")], extensionReasons: [],
  })));
  await page.route(`**/api/v1/teacher/assignments/${A1}/merlin/packages`, (route) => {
    calls.packages.push((route.request().postDataJSON() as { requestKey: string }).requestKey);
    return route.fulfill(json({ id: PACKAGE, state: "queued" }, 202));
  });
  let reads = 0;
  await page.route(`**/api/v1/teacher/assignments/${A1}/merlin/packages/${PACKAGE}`, (route) => {
    reads += 1;
    return route.fulfill(json(reads === 1 ? { id: PACKAGE, state: "queued" } : {
      id: PACKAGE, state: "ready", downloadPath: `/api/v1/teacher/assignments/${A1}/merlin/packages/${PACKAGE}/download`,
      expiresAt: "2099-11-25T19:00:00.000Z", sha256: SHA,
    }));
  });
  await page.route(`**/api/v1/teacher/assignments/${A1}/merlin/packages/${PACKAGE}/download`, (route) => route.fulfill({
    status: 200, contentType: "application/zip", body: "PK izmisljeni paket",
    headers: { "content-disposition": 'attachment; filename="merlin-izmisljeni-seminar.zip"' },
  }));
  await page.route(`**/api/v1/teacher/assignments/${A1}/merlin/csv`, (route) => route.fulfill({
    status: 200, contentType: "text/csv; charset=utf-8", body: "Prezime;Ime\nBabić;Ana\n",
    headers: { "content-disposition": 'attachment; filename="merlin-izmisljeni-seminar.csv"' },
  }));
  return calls;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.filter((v) => BLOCKING.includes(v.impact ?? "")).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const shown = (page: Page) => page.getByTestId("n04-student").locator(".title");

test("NZ-11: the roster filters by state, orders by surname or by state and counts who has not started", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/kolegiji/${K1}/studenti`);
  await expect(page.getByText(/poredan po prezimenu ili po stanju rada, nikad po brojevima/)).toBeVisible();
  await expect(page.getByTestId("n04-not-started")).toHaveText("Nije započelo: 1");
  await expect(shown(page)).toHaveText(["Ana Babić · Grupa 2", "Iva Horvat · Grupa 2", "Luka Zorić · Grupa 2"]);
  const state = page.getByLabel("Stanje");
  await expect(state.locator("option")).toHaveText(["Sva stanja (3)", "Nije započelo (1)", "Piše (1)", "Predano (1)", "Nakon roka (1)", "Dorada (0)"]);
  // By keyboard: the arrow keys on the focused select choose, nothing else moves.
  await state.focus();
  await page.keyboard.press("ArrowDown");
  await expect(state).toHaveValue("notStarted");
  await expect(shown(page)).toHaveText(["Luka Zorić · Grupa 2"]);
  await state.selectOption("late");
  await expect(shown(page)).toHaveText(["Ana Babić · Grupa 2"]);
  await state.selectOption("revision");
  await expect(page.getByText("Nijedan student ne odgovara odabranom prikazu.")).toBeVisible();
  await state.selectOption("");
  await page.getByLabel("Poredak").selectOption("state");
  await expect(shown(page)).toHaveText(["Luka Zorić · Grupa 2", "Iva Horvat · Grupa 2", "Ana Babić · Grupa 2"]);
  await expect(page.getByTestId("n04-not-started")).toHaveText("Nije započelo: 1");
});

test("NZ-13: the holder sees the code's deadline, revokes it and issues a new one shown once, by keyboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const calls = await teacher(page);
  await page.goto("/aplikacija/nastavnik");
  const card = page.getByRole("region", { name: COURSE_NAME });
  await expect(card).toContainText("Vrijedi do 1. 12. 2099. u 23:59.");
  const revoke = card.getByRole("button", { name: `Opozovi kod: ${COURSE_NAME}` });
  await revoke.focus();
  await page.keyboard.press("Enter");
  const revokeDialog = page.getByRole("dialog", { name: "Opozvati kod za upis?" });
  await expect(revokeDialog).toContainText("Već upisani studenti ostaju upisani.");
  await revokeDialog.getByRole("button", { name: "Opozovi kod", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(revokeDialog).toBeHidden();
  await expect(page.getByText("Kod za upis je opozvan.")).toBeVisible();
  await expect(card).toContainText("Nema izdanog koda.");
  await expect(revoke).toHaveCount(0);
  expect(calls.revocations).toBe(1);

  await card.getByRole("button", { name: `Novi kod za upis: ${COURSE_NAME}` }).focus();
  await page.keyboard.press("Enter");
  const issueDialog = page.getByRole("dialog", { name: "Izdati novi kod za upis?" });
  await expect(issueDialog.getByLabel("Kod vrijedi do")).not.toHaveValue("");
  await issueDialog.getByRole("button", { name: "Izdaj novi kod" }).focus();
  await page.keyboard.press("Enter");
  await expect(issueDialog).toBeHidden();
  expect(calls.issued).toHaveLength(1);
  expect(Date.parse(calls.issued[0] ?? "")).toBeGreaterThan(Date.now());
  await expect(card.getByLabel("Kod za upis", { exact: true })).toHaveText(CODE);
  await expect(card).toContainText("Poslužitelj čuva samo sažetak koda, pa ga kasnije ne može ponovno prikazati.");
  await expect(card).toContainText("Studentima recite: upišite kod na stranici Upis.");
  await expect(card).toContainText("Vrijedi do");
  await card.getByRole("button", { name: "Stavi kod u međuspremnik" }).focus();
  await page.keyboard.press("Enter");
  await expect(card.getByText("Kod: kopirano u međuspremnik.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
  await expect(card.getByRole("button", { name: `Opozovi kod: ${COURSE_NAME}` })).toBeVisible();
  // The code is never read back: after a reload only its state is said.
  await page.reload();
  await expect(page.getByRole("region", { name: COURSE_NAME })).toContainText("Vrijedi do 1. 12. 2099. u 23:59.");
  await expect(page.getByText(CODE)).toHaveCount(0);
});

test("NZ-13: a collaborator is told who issues the code and the state is not read", async ({ page }) => {
  const calls = await teacher(page, { role: "assistant" });
  await page.goto("/aplikacija/nastavnik");
  const card = page.getByRole("region", { name: COURSE_NAME });
  await expect(card).toContainText("Izdaje nositelj kolegija.");
  await expect(card.getByRole("button", { name: /Novi kod za upis|Opozovi kod/ })).toHaveCount(0);
  expect(calls.codeState).toBe(0);
});

test("NZ-14: the card leads to the roles and the teaching team, and the holder adds an assistant", async ({ page }) => {
  const calls = await teacher(page);
  await page.goto("/aplikacija/nastavnik");
  const toggle = page.getByRole("button", { name: `Nastavni tim i grupe · ${COURSE_NAME}` });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const roles = page.getByRole("region", { name: "Uloge na kolegiju" });
  await expect(roles).toContainText("Vaša uloga: nositelj.");
  await expect(roles.getByRole("listitem")).toHaveText([
    /^Nositelj: vodi kolegij/, /^Suradnik: samo čita i komentira/, /^Mentor: prati radove studenata.*Radovi uz mentora$/,
  ]);
  await expect(roles.getByRole("link", { name: "Radovi uz mentora" })).toHaveAttribute("href", "/aplikacija/nastavnik/mentorstva");
  await expect(roles).toContainText("Nastavnika kojeg nema na popisu dodaje administrator ustanove");
  const member = page.getByRole("checkbox", { name: "Marko Izmišljeni" }).first();
  await member.focus();
  await page.keyboard.press("Space");
  await expect(member).toBeChecked();
  await page.getByRole("button", { name: "Spremi nastavni tim" }).click();
  await expect(page.getByText("Nastavni tim je spremljen na poslužitelju.")).toBeVisible();
  expect(calls.team).toEqual([[ASSISTANT]]);
});

test("NZ-14: a collaborator sees the role and only the students of the own group", async ({ page }) => {
  await teacher(page, { role: "assistant" });
  await page.goto("/aplikacija/nastavnik");
  await page.getByRole("button", { name: `Nastavni tim i grupe · ${COURSE_NAME}` }).click();
  const roles = page.getByRole("region", { name: "Uloge na kolegiju" });
  await expect(roles).toContainText("Vaša uloga: suradnik.");
  await expect(roles).not.toContainText("dodaje administrator ustanove");
  await expect(page.getByRole("table", { name: "Studenti u grupi Grupa 2" }).getByRole("row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Spremi nastavni tim" })).toHaveCount(0);
});

test("NZ-16: the package is prepared, becomes ready and is downloaded; the list downloads on its own", async ({ page }) => {
  const calls = await teacher(page);
  await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/merlin`);
  const chooser = page.getByLabel("Zadatak");
  await expect(chooser.locator("option")).toHaveText([
    "Izmišljeni seminar · Seminarski rad · rok je prošao", "Izmišljeni završni rad · Završni rad",
  ]);
  await expect(page.getByTestId("merlin-personal-data")).toHaveText("Datoteka sadrži imena studenata; čuvajte je prema pravilima fakulteta.");
  const table = page.getByRole("region", { name: "CSV popis" });
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /Babić/ })).toContainText("babic-ana-1a2b3c4d.pdf");

  const prepare = page.getByRole("button", { name: "Pripremi paket za Merlin" });
  await prepare.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("merlin-status")).toContainText("Paket se priprema.");
  expect(calls.packages).toHaveLength(1);
  expect(calls.packages[0]).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  // The queued package is read again after POLL_MS (3 s) and is then ready.
  const status = page.getByTestId("merlin-status");
  await expect(status).toContainText("Paket je spreman.", { timeout: 10_000 });
  await expect(status).toContainText("Poveznica vrijedi 24 h");
  await expect(status).toContainText(SHA);

  const download = page.waitForEvent("download");
  await status.getByRole("button", { name: "Preuzmi paket" }).focus();
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toBe("merlin-izmisljeni-seminar.zip");

  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Preuzmi samo popis" }).click();
  expect((await csv).suggestedFilename()).toBe("merlin-izmisljeni-seminar.csv");
  expect(calls.packages).toHaveLength(1);
});

test("NZ-16: choosing another assignment opens its export with the focus on the select, once", async ({ page }) => {
  await teacher(page);
  await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/merlin`);
  const chooser = page.getByLabel("Zadatak");
  await expect(chooser).toHaveValue(A1);
  await expect(chooser).not.toBeFocused();
  await chooser.selectOption(A2);
  await expect(page).toHaveURL(`/aplikacija/nastavnik/zadatak/${A2}/merlin`);
  await expect(page.getByLabel("Zadatak")).toHaveValue(A2);
  await expect(page.getByLabel("Zadatak")).toBeFocused();
  await expect(page.getByText("Nema predanih radova")).toBeVisible();
  // The wish travelled in the address and was dropped: a reload does not take the focus again.
  await page.reload();
  await expect(page.getByLabel("Zadatak")).toHaveValue(A2);
  await expect(page.getByLabel("Zadatak")).not.toBeFocused();
});

for (const width of [390, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`axe: roster, code, team and export, ${width} px, ${theme}`, async ({ page }) => {
      const setTheme = () => page.locator("html").evaluate((html, value) => html.setAttribute("data-theme", value), theme);
      const noScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await page.setViewportSize({ width, height: 900 });
      await teacher(page);

      await page.goto(`/aplikacija/nastavnik/kolegiji/${K1}/studenti`);
      await setTheme();
      await page.getByLabel("Stanje").selectOption("late");
      await expect(shown(page)).toHaveText(["Ana Babić · Grupa 2"]);
      expect(await axe(page)).toEqual([]);
      await noScroll();

      await page.goto("/aplikacija/nastavnik");
      await setTheme();
      const card = page.getByRole("region", { name: COURSE_NAME });
      await expect(card).toContainText("Vrijedi do 1. 12. 2099. u 23:59.");
      await page.getByRole("button", { name: `Nastavni tim i grupe · ${COURSE_NAME}` }).click();
      await expect(page.getByRole("region", { name: "Uloge na kolegiju" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await card.getByRole("button", { name: `Opozovi kod: ${COURSE_NAME}` }).click();
      await expect(page.getByRole("dialog", { name: "Opozvati kod za upis?" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.getByRole("dialog").getByRole("button", { name: "Odustani" }).click();
      await card.getByRole("button", { name: `Novi kod za upis: ${COURSE_NAME}` }).click();
      await page.getByRole("dialog", { name: "Izdati novi kod za upis?" }).getByRole("button", { name: "Izdaj novi kod" }).click();
      await expect(card.getByLabel("Kod za upis", { exact: true })).toHaveText(CODE);
      expect(await axe(page)).toEqual([]);
      await noScroll();

      await page.goto(`/aplikacija/nastavnik/zadatak/${A1}/merlin`);
      await setTheme();
      await page.getByRole("button", { name: "Pripremi paket za Merlin" }).click();
      await expect(page.getByTestId("merlin-status")).toContainText("Paket je spreman.", { timeout: 10_000 });
      expect(await axe(page)).toEqual([]);
      await noScroll();
    });
  }
}
