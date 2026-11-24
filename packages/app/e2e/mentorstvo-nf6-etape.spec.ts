// WEB-NF6-ETAPE (NF-6 MK-5, MK-6, MK-7): on N-16 the mentor sees, per started work, the stages with due dates,
// descriptions and notes, adds a stage or applies the faculty template, and reads what was agreed at the
// latest consultation; "Otvori mentorstvo" is not available yet. The student sees the mentor of an approved
// request and sends a declined one to another teacher. The server is the VIZ "puno" scenario over the
// contract's vectors, with this page's reads and writes answered per test. Every person, text and identifier is invented.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";
import { mentorPlanText as t } from "../src/host/teacher/mentorships/messages.hr";
import { mentorshipRequestText as s } from "../src/host/student/mentorship-request/messages.hr";

const STAGES = { milestones: [
  { id: "00000000-0000-4000-8000-00000000e601", title: "Izmišljena prijava teme", description: "Izmišljeni opis: naslov i tri rečenice o temi.",
    dueAt: "2026-10-20T10:00:00.000Z", state: "approved", everSubmitted: true, submittedRevisionId: 1, submittedAt: "2026-10-18T10:00:00.000Z",
    revisionComment: null, revisionDueAt: null, revisionRequestedAt: null, approvedAt: "2026-10-21T10:00:00.000Z", approvalMessage: "Izmišljena poruka: tema je jasna." },
  { id: "00000000-0000-4000-8000-00000000e602", title: "Izmišljeni nacrt uvoda", description: "",
    dueAt: "2026-12-01T10:00:00.000Z", state: "revision_requested", everSubmitted: true, submittedRevisionId: 3, submittedAt: "2026-11-10T10:00:00.000Z",
    revisionComment: "Izmišljena napomena: proširiti metodu.", revisionDueAt: "2026-12-05T10:00:00.000Z", revisionRequestedAt: "2026-11-12T10:00:00.000Z",
    approvedAt: null, approvalMessage: null },
] };
const RECORDS = { records: [{
  id: "00000000-0000-4000-8000-00000000e6a1", heldOn: "2026-11-14", revision: 3, topic: "Izmišljena tema: metoda",
  agreement: "Izmišljeni dogovor: dovršiti uvod do idućeg tjedna.", additions: [],
}] };
const PLAN = { milestones: [{ id: "00000000-0000-4000-8000-00000000e603", position: 3, title: "Izmišljena etapa", dueAt: null, submits: "current_version" }] };

type Sent = { method: string; path: string; body: unknown };

async function serveTeacher(page: Page) {
  const server = generatedServer("puno");
  const sent: Sent[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData() as string) as unknown : undefined;
    if (path.includes("milestone-plan")) sent.push({ method: req.method(), path, body });
    if (req.method() === "GET" && path.endsWith("/milestone-states")) return route.fulfill({ json: STAGES });
    if (req.method() === "GET" && path.endsWith("/consultation-records")) return route.fulfill({ json: RECORDS });
    if (req.method() === "POST" && path.endsWith("/milestone-plan/milestones")) return route.fulfill({ status: 201, json: PLAN });
    if (req.method() === "POST" && path.endsWith("/milestone-plan/apply-template")) return route.fulfill({ status: 409, json: { code: "conflict" } });
    const result = server.answer("teacher", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return sent;
}

test("the mentor sees each work's stages and agreement, adds a stage, and is told a template conflict", async ({ page }, info) => {
  const sent = await serveTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/app/web/nastavnik/mentorstva");
  const plans = page.getByTestId("mentor-work-plan");
  await expect(plans).toHaveCount(2);
  const first = plans.first();
  await expect(first.getByText("Etape · 1 od 2 odobreno")).toBeVisible();
  await first.getByText("Etape · 1 od 2 odobreno").click();
  await expect(first.getByText("Izmišljeni opis: naslov i tri rečenice o temi.")).toBeVisible();
  await expect(first.getByText("Izmišljena napomena: proširiti metodu.")).toBeVisible();
  await expect(first.getByText("Izmišljeni dogovor: dovršiti uvod do idućeg tjedna.")).toBeVisible();
  await expect(first.getByText(t.agreed.tasks)).toBeVisible();
  await expect(page.getByRole("button", { name: t.open.button })).toBeDisabled();
  await expect(page.getByText(t.open.unavailable)).toBeVisible();
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    await axe(page, info, `mentorstva-1280-${theme}`);
  }

  // Keyboard: open "Dodaj etapu", Escape closes it, the focus returns.
  const add = first.getByRole("button", { name: t.plan.add });
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: t.plan.addTitle });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();

  await add.click();
  await dialog.getByRole("button", { name: t.plan.save }).click();
  await expect(dialog.getByText(t.plan.titleNeeded)).toBeVisible();
  expect(sent).toEqual([]);
  await dialog.getByLabel(t.plan.title).fill("Izmišljena etapa");
  await dialog.getByLabel(t.plan.submits).selectOption("topic_text");
  await dialog.getByRole("button", { name: t.plan.save }).click();
  await expect(first.getByText(t.plan.added)).toBeVisible();
  expect(sent).toEqual([{ method: "POST", path: "/api/v1/works/izmisljeni-rad-0001/milestone-plan/milestones", body: { title: "Izmišljena etapa", submits: "topic_text" } }]);

  await first.getByRole("button", { name: t.plan.template }).click();
  await page.getByRole("dialog", { name: t.plan.templateTitle }).getByRole("button", { name: t.plan.templateConfirm }).click();
  await expect(first.getByText(t.plan.conflict)).toBeVisible();
});

test("on a phone the mentor's plan has no sideways scroll and no axe findings", async ({ page }, info) => {
  await serveTeacher(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/web/nastavnik/mentorstva");
  await expect(page.getByTestId("mentor-work-plan")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    await axe(page, info, `mentorstva-390-${theme}`);
  }
});

const TEACHER = { teacherId: "10000000-0000-4000-8000-000000000001", name: { givenName: "Marko", familyName: "Izmišljeni" }, department: null };
const base = { teacherId: TEACHER.teacherId, teacherName: TEACHER.name, requestedAt: "2026-11-01T10:00:00.000Z" };
const REQUESTS = { requests: [
  { ...base, requestId: "00000000-0000-4000-8000-0000000000b1", workType: "master_thesis", state: "approved", endedAt: "2026-11-03T10:00:00.000Z", mentorshipId: "00000000-0000-4000-8000-0000000000c1" },
  { ...base, requestId: "00000000-0000-4000-8000-0000000000b2", workType: "bachelor_thesis", state: "declined", endedAt: "2026-11-04T10:00:00.000Z", mentorshipId: null },
] };

for (const width of [1280, 390]) {
  test(`the student sees the mentor and sends a declined request to another teacher (${width} px)`, async ({ page }, info) => {
    const server = generatedServer("puno");
    await page.route("**/api/v1/**", (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (path.endsWith("/student/mentorship-requests")) return route.fulfill({ json: REQUESTS });
      if (path.endsWith("/student/mentor-candidates")) return route.fulfill({ json: { candidates: [TEACHER] } });
      const result = server.answer("student", req.method(), path);
      if (result === "hang") return undefined;
      return route.fulfill(result);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app/web/zadaci/mentorstvo");
    await expect(page.getByRole("heading", { name: s.mine.title })).toBeVisible();
    await expect(page.getByTestId("my-mentorship")).toHaveText(/Diplomski rad: mentor Marko Izmišljeni/);
    await expect(page.getByText(s.mine.openedOn.replace("{date}", "3. studenoga 2026."))).toBeVisible();
    await expect(page.getByText(s.declinedReason)).toBeVisible();
    await page.getByLabel(s.fieldTeacher).selectOption(TEACHER.teacherId);
    await page.getByRole("button", { name: `${s.retarget}: ${s.workTypes.bachelor_thesis}` }).click();
    await expect(page.getByText(s.retargetNote)).toBeVisible();
    await expect(page.getByLabel(s.fieldTeacher)).toBeFocused();
    await expect(page.getByLabel(s.fieldTeacher)).toHaveValue("");
    await expect(page.getByLabel(s.fieldType)).toHaveValue("bachelor_thesis");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `mentorstvo-student-${width}-${theme}`);
    }
  });
}
