// WEB-NF4-ZADATAK (NZ-3, NZ-4, NZ-5): the assignment form with groups, summary-only and outside tools, the
// "Pravila predaje" section and its panel on the edit page, and the exception for a late submission on the course card.
// axe at 390 and 1280 px in the dark and the light theme; the dialogs by keyboard. The institution server is faked per
// test over the shared contract defaults; invented data only.
import { axe, setTheme, type Theme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";

const K1 = "6b1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";
const A1 = "6b1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c11";
const A2 = "6b1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c12";
const S1 = "6b2b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c21";
const G1 = "6b5b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c51";
const G2 = "6b5b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c52";
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const task = (id: string, title: string, dueAt: string) => ({
  id, title, workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z", dueAt, currentVersion: 1, enrolledStudents: 1,
});
const COURSE = {
  id: K1, name: "Izmišljeni kolegij pravila", academicYear: "2026/2027", aiPolicy: "partially_allowed",
  assignments: [task(A1, "Izmišljeni seminar", "2099-12-15T22:59:00.000Z"), task(A2, "Izmišljeni esej", "2026-11-08T22:59:00.000Z")],
};

async function teacher(page: Page) {
  await page.route("**/api/v1/me", (route) => route.fulfill(json({
    role: "teacher", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" },
  })));
  await page.route("**/api/v1/teacher/courses", (route) => route.fulfill(json({ courses: [COURSE] })));
  await page.route(`**/api/v1/institution/courses/${K1}/groups`, (route) => route.fulfill(json({ groups: [
    { id: G1, name: "Grupa A", teachers: [], students: 3 }, { id: G2, name: "Grupa B", teachers: [], students: 2 },
  ] })));
}

async function checkAxe(page: Page, info: Parameters<typeof axe>[1], label: string) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"] as Theme[]) {
      await setTheme(page, theme);
      await axe(page, info, `${label}-${width}-${theme}`);
    }
  }
}

test("NZ-3 and NZ-4: groups, summary-only, tools and the submission rules reach the create body", async ({ page }, info) => {
  await teacher(page);
  const posts: Record<string, unknown>[] = [];
  const calls: string[] = [];
  await page.route(`**/api/v1/institution/courses/${K1}/assignments`, (route) => {
    posts.push(route.request().postDataJSON());
    return route.fulfill(json({ id: A1 }, 201));
  });
  await page.route(`**/api/v1/teacher/assignments/${A1}/submission-withdrawal`, (route) => {
    calls.push(`withdrawal ${route.request().postData()}`);
    return route.fulfill(json({ allowed: false, changedAt: "2026-11-24T10:00:00.000Z" }));
  });
  await page.route(`**/api/v1/institution/assignments/${A1}/late-submission`, (route) => {
    calls.push(`late ${route.request().method()} ${route.request().postData()}`);
    return route.fulfill(json({ lateSubmissionAllowed: false }));
  });
  await page.goto(`/app/web/nastavnik/zadatak/novi?kolegij=${K1}`);
  await expect(page.getByRole("group", { name: "Grupe" })).toBeVisible();
  await checkAxe(page, info, "form");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByLabel("Naslov zadatka").fill("Izmišljeni seminar");
  await page.getByLabel("Otvaranje").fill("2027-01-10T10:00");
  await page.getByLabel("Rok", { exact: true }).fill("2027-01-30T16:00");
  // By keyboard: a group box is unticked with Space, the radios of the other choices are reached with Tab and arrows.
  await page.getByLabel("Grupa B").focus();
  await page.keyboard.press("Space");
  await page.getByLabel("Samo sažimanje literature, uz izjavu").check();
  await page.getByLabel("Nisu dopušteni u ovom zadatku").check();
  // F4-NAS-R01: late submission is a working choice, allowed at the start.
  await expect(page.getByLabel("Dopuštena (predaja se označi kao kasna)")).toBeChecked();
  await page.getByLabel("Nije dopuštena", { exact: true }).check();
  await page.getByLabel("Student ne smije povući predaju").check();
  await expect(page.getByText("Student na koraku predaje vidi: nakon roka ne može predati; predaju ne može povući; izjavu mora ispuniti.")).toBeVisible();

  await page.getByRole("button", { name: "Pregled i objava" }).click();
  await expect(page.getByText("Grupa A", { exact: true })).toBeVisible();
  await expect(page.getByText("Samo sažimanje literature", { exact: true })).toBeVisible();
  await expect(page.getByText("nije dopuštena", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Objavi zadatak" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ groupIds: [G1], aiSummaryOnly: true, externalToolsAllowed: false, aiPurposes: ["literature_search"] });
  await expect.poll(() => calls).toEqual(['late PUT {"lateSubmissionAllowed":false}', 'withdrawal {"allowed":false}']);
});

test("NZ-3: no group ticked is refused with a sentence", async ({ page }) => {
  await teacher(page);
  await page.goto(`/app/web/nastavnik/zadatak/novi?kolegij=${K1}`);
  await page.getByLabel("Naslov zadatka").fill("Izmišljeni seminar");
  await page.getByLabel("Otvaranje").fill("2027-01-10T10:00");
  await page.getByLabel("Rok", { exact: true }).fill("2027-01-30T16:00");
  await page.getByLabel("Grupa A").uncheck();
  await page.getByLabel("Grupa B").uncheck();
  await page.getByRole("button", { name: "Pregled i objava" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "odaberite barem jednu grupu" }).first()).toBeVisible();
});

test("NZ-4: the edit page reads the switches, asks first and says saved only after the answer", async ({ page }, info) => {
  await teacher(page);
  const puts: string[] = [];
  await page.route(`**/api/v1/institution/assignments/${A1}`, (route) => route.fulfill(json({
    assignmentId: A1, courseId: K1, versionNo: 1, title: "Izmišljeni seminar", instructions: "", workType: "seminar_paper",
    opensAt: "2026-10-01T08:00:00.000Z", dueAt: "2099-12-15T22:59:00.000Z", aiPolicy: "partially_allowed", aiPurposes: ["literature_search"],
    evidenceProfile: "basic", importAllowed: false, wordMin: null, wordMax: null,
  })));
  await page.route(`**/api/v1/teacher/assignments/${A1}/submission-withdrawal`, (route) => route.request().method() === "GET"
    ? route.fulfill(json({ allowed: true, changedAt: null }))
    : (puts.push(route.request().postData() ?? ""), route.fulfill(json({ allowed: false, changedAt: "2026-11-24T10:00:00.000Z" }))));
  await page.route(`**/api/v1/teacher/assignments/${A1}/declaration-required`, (route) => route.fulfill(json({ required: true, changedAt: null })));
  await page.goto(`/app/web/nastavnik/zadatak/${A1}/uredi`);
  // The panel is the card around the section "Pravila predaje"; its button and note stand beside the section.
  const panel = page.locator("div.card").filter({ has: page.getByRole("region", { name: "Pravila predaje" }) });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Spremi pravila predaje" })).toBeDisabled();
  // F4-NAS-R01: the teacher has no route to read the late rule yet, so here it stays disabled and says so.
  await expect(panel.getByText("Postavka predaje nakon roka ovdje se zasad ne može pročitati ni promijeniti.")).toBeVisible();
  await expect(panel.getByLabel("Dopuštena (predaja se označi kao kasna)")).toBeDisabled();
  await checkAxe(page, info, "edit");
  await page.setViewportSize({ width: 1280, height: 900 });

  await panel.getByLabel("Student ne smije povući predaju").check();
  await panel.getByRole("button", { name: "Spremi pravila predaje" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Promjena pravila predaje" });
  await expect(dialog.getByText("Ova izmjena mijenja pravila koja su studenti već vidjeli.")).toBeVisible();
  expect(puts).toEqual([]);
  await dialog.getByRole("button", { name: "Spremi izmjenu" }).click();
  await expect(panel.getByText("Pravila predaje su spremljena.")).toBeVisible();
  expect(puts).toEqual(['{"allowed":false}']);
});

test("NZ-5: a student without a submission after the deadline gets an exception with a record", async ({ page }, info) => {
  await teacher(page);
  const posts: Record<string, unknown>[] = [];
  await page.route(`**/api/v1/teacher/courses/${K1}/students`, (route) => route.fulfill(json({ students: [{
    studentId: S1, givenName: "Ana", familyName: "Izmišljenić", groupName: null,
    assignments: [{ assignmentId: A1, documentId: null, workState: "not_started" }, { assignmentId: A2, documentId: null, workState: "not_started" }],
  }] })));
  for (const id of [A1, A2]) {
    await page.route(`**/api/v1/teacher/assignments/${id}/overview`, (route) => route.fulfill(json({ students: [
      { studentId: S1, givenName: "Ana", familyName: "Izmišljenić", groupName: null, submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
    ] })));
    await page.route(`**/api/v1/teacher/assignments/${id}/submissions`, (route) => route.fulfill(json({ submissions: [] })));
    await page.route(`**/api/v1/teacher/assignments/${id}/deadline-extensions`, (route) => {
      if (route.request().method() === "GET") return route.fulfill(json({ extensions: [] }));
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posts.push(body);
      return route.fulfill(json({ existingSubmissionsUnchanged: true, extension: {
        id: "6b4b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41", scope: "one", studentId: S1, previousDueAt: "2026-11-08T22:59:00.000Z",
        dueAt: body.dueAt, reasonId: body.reasonId, createdBy: "6b3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31", createdAt: "2026-11-24T10:00:00.000Z",
      } }, 201));
    });
  }
  await page.goto("/app/web/nastavnik");
  // Only the assignment whose deadline has passed offers the action to a student who never opened the work.
  await expect(page.getByRole("button", { name: /Dopusti predaju nakon roka… Ana/ })).toHaveCount(1);
  await page.getByRole("button", { name: /Dopusti predaju nakon roka… Ana/ }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Dopusti predaju nakon roka: Ana/ });
  await expect(dialog.getByText("Student vidi novi rok i razlog, a zapis se ne briše.")).toBeVisible();
  await checkAxe(page, info, "late");
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole("button", { name: "Zabilježi iznimku" }).click();
  await expect(dialog.getByText("Odaberite razlog s popisa.")).toBeVisible();
  await dialog.getByLabel("Razlog").selectOption("technical");
  await dialog.getByLabel("Novi rok (po zagrebačkom vremenu)").fill("2099-01-10T12:00");
  await dialog.getByRole("button", { name: "Zabilježi iznimku" }).click();
  // The message stays on screen after the facts are read again (it is not part of the row that is mounted again).
  await expect(page.getByRole("status").filter({ hasText: "Zabilježeno: predaja je dopuštena do" })).toBeVisible();
  expect(posts).toEqual([{ scope: "one", studentId: S1, dueAt: "2099-01-10T11:00:00.000Z", reasonId: "technical" }]);
});
