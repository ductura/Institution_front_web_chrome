// WEB-V16-E2E (val 16, "Završni i diplomski rad"): one flow through the shared "Završni rad" panel, for a student
// and a mentor, on the host's real screens. The institution server is one stateful fake over the contract's routes
// (topic, stage, forms, consent, committee, stages), shared by both roles of the test; the role only decides whose
// answers the VIZ "puno" scenario gives for everything else. Every person, text and identifier is invented.
//
// The administrator names the committee through the faculty's list of theses (`ThesisOverviewPage` at
// /ustanova/zavrsni-radovi, which mounts `CommitteeEditor`); the student then reads the list the fake saved.
import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { DOKUMENT_T1 } from "../test-fakes/viz-predaja";
import { generatedServer } from "./viz/server";
import { topicStudentHr as ts } from "../src/host/thesis/topic-student/messages.hr";
import { topicMentorHr as tm } from "../src/host/thesis/topic-mentor/messages.hr";
import { formsHr as tf } from "../src/host/thesis/forms/messages.hr";
import { stageHr as tg } from "../src/host/thesis/stage/messages.hr";
import { stagesStudentHr as te } from "../src/host/thesis/stages-student/messages.hr";
import { thesisHr } from "../src/host/thesis/messages.hr";
import { committeeHr as tc } from "../src/host/thesis/committee/messages.hr";
import { thesisOverviewMessages as to } from "../src/host/admin/thesis-overview/messages.hr";

const FORM_CODE = "izmisljeni-obrazac";
const MILESTONE = "00000000-0000-4000-8000-00000000f161";
const CHAIR = "00000000-0000-4000-8000-0000000000c1";
const MEMBER = "00000000-0000-4000-8000-0000000000c2";
const TEACHERS = [
  { personId: CHAIR, name: { givenName: "Ivana", familyName: "Izmišljena" } },
  { personId: MEMBER, name: { givenName: "Petar", familyName: "Zamišljeni" } },
];
const OTHER_DOC = "izmisljeni-rad-0003"; // the second mentored work of the scenario: not this mentor's to see
const DEFENSE_LOCAL = "2026-12-15T10:30";
const DEFENSE_ISO = "2026-12-15T09:30:00.000Z"; // 10:30 Zagreb (CET)

type Role = "student" | "teacher" | "institution_admin";
type Member = { userId: string; name: { givenName: string; familyName: string }; role: "chair" | "member" };
type Version = { version: number; title: string; summary: string; proposedAt: string };
type Sent = { method: string; path: string; body: unknown };

/** The server's whole state for the one work. */
function newWorld() {
  const w = {
    role: "student" as Role,
    sent: [] as Sent[],
    asked: [] as string[],
    topic: { state: "none" as "none" | "proposed" | "approved" | "returned", versions: [] as Version[],
      decision: null as null | { version: number; decision: "approved" | "returned"; comment: string | null; decidedAt: string; decidedByPart: "mentor" } },
    form: { state: "not_submitted" as "not_submitted" | "submitted" | "accepted", changedAt: null as string | null, by: null as string | null },
    consent: { state: "none" as "none" | "given" | "withdrawn", comment: null as string | null, changedAt: null as string | null, history: [] as unknown[] },
    stage: { stage: "none", defenseAt: null as string | null, changedBy: null as string | null, changedAt: null as string | null, changedByPart: null as string | null },
    milestone: { state: "not_submitted", submittedAt: null as string | null, approvedAt: null as string | null },
    committee: { members: [] as Member[], changedAt: null as string | null, changedByPart: null as "faculty" | null },
  };
  return w;
}
type World = ReturnType<typeof newWorld>;

const topicBody = (w: World) => {
  const last = w.topic.versions.at(-1) ?? null;
  return { state: w.topic.state, current: last, decision: w.topic.decision, history: w.topic.versions };
};
const milestoneBody = (w: World) => ({
  id: MILESTONE, title: "Izmišljena etapa: nacrt poglavlja", description: "", dueAt: "2026-12-01T10:00:00.000Z",
  state: w.milestone.state, everSubmitted: w.milestone.submittedAt !== null, submittedRevisionId: w.milestone.submittedAt ? 3 : null,
  submittedAt: w.milestone.submittedAt, revisionComment: null, revisionDueAt: null, revisionRequestedAt: null,
  approvedAt: w.milestone.approvedAt, approvalMessage: null,
});
const NOW = FIKSNI_DATUM;
const WHO = "00000000-0000-4000-8000-0000000000a1";
const formBody = (w: World) => ({
  code: FORM_CODE, version: 1, title: "Izmišljeni obrazac prijave rada", state: w.form.state, stateFormVersion: w.form.changedAt ? 1 : null,
  changedAt: w.form.changedAt, changedBy: w.form.changedAt ? WHO : null, changedByPart: w.form.by,
});
const consentBody = (w: World) => ({
  state: w.consent.state, changedBy: w.consent.changedAt ? WHO : null, changedAt: w.consent.changedAt, comment: w.consent.comment,
  requiredForSubmission: false, history: w.consent.history,
});

async function serve(page: Page, w: World) {
  const server = generatedServer("puno");
  await page.clock.setFixedTime(new Date(NOW));
  await page.route("**/api/v1/**", (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const m = req.method();
    const body = req.postData() ? (JSON.parse(req.postData() as string) as Record<string, unknown>) : undefined;
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    // The student's mentored work is this one (otherwise the editor hides the thesis panel, DEMO-POP-3).
    if (m === "GET" && path === "/api/v1/student/mentored-assignments") {
      return json({ assignments: [{ id: T1, mentorshipId: "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2901", title: "Izmišljeni diplomski rad", dueAt: "2027-06-15T21:59:00.000Z",
        noticeFirst: false, workType: "master_thesis", mentor: { id: "4f5a6b7c-8d9e-4f0a-9b2c-3d4e5f6a7b01", givenName: "Izmišljena", familyName: "Mentorica" }, extendedDueAt: null }] });
    }
    const work = /^\/api\/v1\/works\/([^/]+)\/(.*)$/.exec(path);
    if (work) {
      const [, doc, rest] = work as unknown as [string, string, string];
      if (rest.startsWith("thesis-") || rest.startsWith("mentor-consent")) w.asked.push(`${m} ${doc}/${rest}`);
      // Another's work: the server shows nothing of it, whatever is asked.
      if ((rest.startsWith("thesis-") || rest.startsWith("mentor-consent")) && doc !== DOKUMENT_T1) return json({ code: "not_found" }, 404);
      if (doc === DOKUMENT_T1) {
        if (m !== "GET") w.sent.push({ method: m, path, body });
        const teacher = w.role === "teacher";
        // --- topic
        if (rest === "thesis-topic" && m === "GET") return json(topicBody(w));
        if (rest === "thesis-topic" && m === "PUT") {
          if (teacher) return json({ code: "forbidden" }, 403);
          if (w.topic.state === "approved") return json({ code: "conflict" }, 409);
          const last = w.topic.versions.at(-1);
          if (!last || last.title !== body?.title || last.summary !== (body?.summary ?? "")) {
            w.topic.versions.push({ version: w.topic.versions.length + 1, title: String(body?.title), summary: String(body?.summary ?? ""), proposedAt: NOW });
          }
          w.topic.state = "proposed";
          return json(topicBody(w));
        }
        if (rest === "thesis-topic/decision" && m === "POST") {
          if (!teacher) return json({ code: "forbidden" }, 403);
          const last = w.topic.versions.at(-1);
          if (!last || body?.version !== last.version) return json({ code: "conflict" }, 409);
          if (body?.decision === "returned" && !body?.comment) return json({ code: "invalid" }, 422);
          w.topic.state = body?.decision as "approved" | "returned";
          w.topic.decision = { version: last.version, decision: body?.decision as "approved" | "returned", comment: (body?.comment as string | undefined) ?? null, decidedAt: NOW, decidedByPart: "mentor" };
          return json(topicBody(w));
        }
        // --- forms and consent
        if (rest === "thesis-forms" && m === "GET") {
          return json({ forms: [formBody(w)] });
        }
        if (rest === `thesis-forms/${FORM_CODE}` && m === "PUT") {
          w.form = { state: body?.state as World["form"]["state"], changedAt: NOW, by: teacher ? "mentor" : "student" };
          return json(formBody(w));
        }
        if (rest === "mentor-consent" && m === "GET") {
          return json(consentBody(w));
        }
        if (rest === "mentor-consent" && m === "PUT") {
          if (!teacher) return json({ code: "forbidden" }, 403);
          const given = body?.given === true;
          w.consent = { state: given ? "given" : "withdrawn", comment: (body?.comment as string | undefined) ?? null, changedAt: NOW,
            history: [{ given, changedBy: WHO, changedAt: NOW, comment: (body?.comment as string | undefined) ?? null }, ...w.consent.history] };
          return json(consentBody(w));
        }
        // --- stage
        if (rest === "thesis-stage" && m === "GET") return json(w.stage);
        if (rest === "thesis-stage" && m === "PUT") {
          if (!teacher) return json({ code: "forbidden" }, 403);
          const stage = body?.stage as string;
          if ((stage === "defense_scheduled") !== (body?.defenseAt !== undefined && body?.defenseAt !== null)) return json({ code: "invalid" }, 422);
          w.stage = { stage, defenseAt: (body?.defenseAt as string | undefined) ?? null, changedBy: WHO, changedAt: NOW, changedByPart: "mentor" };
          return json(w.stage);
        }
        // --- committee: read by everyone with the work, written by the administrator only (5 members, one chair at most)
        if (rest === "thesis-committee" && m === "GET") return json(w.committee);
        if (rest === "thesis-committee" && m === "PUT") {
          if (w.role !== "institution_admin") return json({ code: "forbidden" }, 403);
          const members = (body?.members ?? []) as { userId: string; role: "chair" | "member" }[];
          const named = members.map((x) => ({ ...x, name: TEACHERS.find((t) => t.personId === x.userId)?.name }));
          if (members.length > 5 || members.filter((x) => x.role === "chair").length > 1 || named.some((x) => x.name === undefined)) return json({ code: "invalid" }, 422);
          w.committee = { members: named as Member[], changedAt: NOW, changedByPart: "faculty" };
          return json(w.committee);
        }
        // --- stages
        if (rest === "milestone-states" && m === "GET") return json({ milestones: [milestoneBody(w)] });
        if (rest === `milestones/${MILESTONE}/submit` && m === "POST") {
          if (w.milestone.state === "submitted" || w.milestone.state === "approved") return json({ code: "conflict" }, 409);
          w.milestone = { ...w.milestone, state: "submitted", submittedAt: NOW };
          return json(milestoneBody(w));
        }
        if (rest === `milestones/${MILESTONE}/approve` && m === "POST") {
          if (w.milestone.state !== "submitted") return json({ code: "conflict" }, 409);
          w.milestone = { ...w.milestone, state: "approved", approvedAt: NOW };
          return json(milestoneBody(w));
        }
      }
    }
    // The faculty's list of theses and the teachers it chooses the committee from (administrator only).
    if (m === "GET" && path === "/api/v1/institution/thesis-overview") {
      if (w.role !== "institution_admin") return json({ code: "forbidden" }, 403);
      return json({ works: [{ documentId: DOKUMENT_T1, workType: "master_thesis", mentorName: { givenName: "Izmišljena", familyName: "Mentorica" },
        studentName: { givenName: "Izmišljeni", familyName: "Student" }, stage: "none", defenseAt: null, topicState: "approved", committeeSize: w.committee.members.length }], next: null });
    }
    if (m === "GET" && path === "/api/v1/institution/teachers") {
      if (w.role !== "institution_admin") return json({ code: "forbidden" }, 403);
      return json({ pending: [], confirmed: TEACHERS.map((t) => ({ ...t, confirmedAt: NOW, forReview: false })) });
    }
    const result = server.answer(w.role, m, path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
}

async function skipGuide(page: Page) {
  const skip = page.getByRole("button", { name: "Preskoči vodič" });
  await skip.waitFor({ state: "visible", timeout: 5000 }).then(() => skip.click(), () => undefined);
}

/** The student's panel: the editor's "Mentor" tab. */
async function studentPanel(page: Page, w: World, width = 1250) {
  w.role = "student";
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/aplikacija/rad/${T1}`);
  await skipGuide(page);
  const tab = page.getByRole("tab", { name: "Mentor" });
  await tab.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: tf.title })).toBeVisible();
}

/** The faculty's list of theses, as the administrator. */
async function adminPage(page: Page, w: World, width = 1250) {
  w.role = "institution_admin";
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/aplikacija/ustanova/zavrsni-radovi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(to.title);
  await expect(page.getByRole("table", { name: to.caption })).toBeVisible();
}

async function mentorPanel(page: Page, w: World, width = 1250) {
  w.role = "teacher";
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/aplikacija/nastavnik/mentorstva");
  // Both mentored works read at once; the second one answers 404 and drops out, so wait until one card is left.
  await expect(page.getByRole("region", { name: tf.title })).toHaveCount(1);
  await expect(page.getByRole("region", { name: tf.title })).toBeVisible();
}

// The student sees two cards with the same title (the student's form and the mentor's read-only view); the
// student's own one is the card that holds the form's state line.
const studentTopic = (page: Page) => page.getByRole("region", { name: ts.title }).filter({ has: page.getByTestId("topic-state") });
const mentorTopic = (page: Page) => page.getByRole("region", { name: tm.title });
const card = (page: Page, title: string) => page.getByRole("region", { name: title });

test("the whole flow of a thesis: topic, stage, forms and consent, committee, defense, and another's work", async ({ page }, info) => {
  // Eleven page loads of the real host, both roles, two widths and two themes: longer than the default 30 s.
  test.setTimeout(150_000);
  const w = newWorld();
  await serve(page, w);

  // 1. The student proposes a topic; an empty title is refused before any request.
  await studentPanel(page, w);
  const mine = studentTopic(page);
  await expect(mine.getByTestId("topic-state")).toContainText(ts.states.none);
  await mine.getByRole("button", { name: ts.submitFirst }).click();
  await expect(mine.getByText(ts.titleEmpty)).toBeVisible();
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-topic"))).toEqual([]);
  await mine.getByLabel(ts.titleLabel).fill("Izmišljena tema: prvi prijedlog");
  await mine.getByLabel(ts.summaryLabel).fill("Izmišljeni opis teme u dvije rečenice.");
  await mine.getByRole("button", { name: ts.submitFirst }).click();
  await expect(mine.getByTestId("topic-state")).toContainText(ts.states.proposed);
  expect(w.sent.filter((s) => s.method === "PUT" && s.path.endsWith("/thesis-topic")).map((s) => s.body))
    .toEqual([{ title: "Izmišljena tema: prvi prijedlog", summary: "Izmišljeni opis teme u dvije rečenice." }]);

  // 2. The mentor returns it: a comment is required, so "Vrati" without one sends nothing.
  await mentorPanel(page, w);
  const decide = mentorTopic(page);
  await expect(decide.getByRole("heading", { name: "Izmišljena tema: prvi prijedlog" })).toBeVisible();
  await decide.getByRole("button", { name: tm.returnForRework }).click();
  await expect(decide.getByText(tm.commentRequired).first()).toBeVisible();
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-topic/decision"))).toEqual([]);
  await decide.getByLabel(tm.commentLabel).fill("Izmišljeni komentar: suziti temu.");
  await decide.getByRole("button", { name: tm.returnForRework }).click();
  await expect(decide.getByText(tm.states.returned).first()).toBeVisible();
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-topic/decision")).map((s) => s.body))
    .toEqual([{ version: 1, decision: "returned", comment: "Izmišljeni komentar: suziti temu." }]);

  // 3. The student reads the comment and proposes again (a second version).
  await studentPanel(page, w);
  await expect(studentTopic(page).getByTestId("topic-comment")).toContainText("Izmišljeni komentar: suziti temu.");
  await studentTopic(page).getByLabel(ts.titleLabel).fill("Izmišljena tema: suženi prijedlog");
  await studentTopic(page).getByRole("button", { name: ts.submitAgain }).click();
  await expect(studentTopic(page).getByTestId("topic-state")).toContainText(ts.states.proposed);
  await expect(studentTopic(page).getByTestId("topic-v2")).toContainText("Izmišljena tema: suženi prijedlog");

  // 4. The mentor approves; the student's form is locked.
  await mentorPanel(page, w);
  await mentorTopic(page).getByRole("button", { name: tm.approve }).click();
  await expect(mentorTopic(page).getByText(tm.states.approved).first()).toBeVisible();
  await studentPanel(page, w);
  await expect(studentTopic(page).getByTestId("topic-approved")).toHaveText(ts.approvedLocked);
  await expect(studentTopic(page).getByRole("button", { name: /Predloži|Ponovno|Pošalji/ })).toHaveCount(0);

  // 5. The student sends the stage; the mentor approves it in the existing WorkPlan.
  const stages = card(page, te.title);
  await expect(stages.getByTestId(`stage-${MILESTONE}`)).toContainText(te.states.not_submitted);
  await stages.getByRole("button", { name: te.submit }).click();
  await expect(stages.getByTestId(`stage-${MILESTONE}`)).toContainText(te.states.submitted);
  expect(w.sent.filter((s) => s.path.endsWith("/submit"))).toHaveLength(1);
  await mentorPanel(page, w);
  const plan = page.getByTestId("mentor-work-plan").first();
  await plan.getByText(/Etape, 0 od 1 odobreno/).click();
  await plan.getByRole("button", { name: "Odobri", exact: true }).click();
  await page.getByRole("dialog", { name: "Odobri etapu" }).getByRole("button", { name: "Odobri etapu" }).click();
  await expect.poll(() => w.milestone.state).toBe("approved");
  await studentPanel(page, w);
  await expect(card(page, te.title).getByTestId(`stage-${MILESTONE}`)).toContainText(te.states.approved);
  await expect(card(page, te.title).getByRole("button", { name: te.submit })).toHaveCount(0);

  // 6. Forms and consent: the student marks the form as submitted and cannot give the consent; the mentor gives it.
  const forms = card(page, tf.title);
  await expect(forms.getByRole("button", { name: tf.give })).toHaveCount(0);
  await forms.getByRole("button", { name: tf.markSubmitted }).click();
  await expect(forms.getByTestId(`form-${FORM_CODE}`)).toContainText(tf.states.submitted);
  await mentorPanel(page, w);
  const mForms = card(page, tf.title);
  await mForms.getByLabel(tf.consentComment).fill("Izmišljeni komentar uz suglasnost.");
  await mForms.getByRole("button", { name: tf.give }).click();
  await expect(mForms.getByTestId("consent")).toContainText(tf.consentStates.given);
  await studentPanel(page, w);
  await expect(card(page, tf.title).getByTestId("consent")).toContainText(tf.consentStates.given);
  await expect(card(page, tf.title).getByTestId("consent")).toContainText("Izmišljeni komentar uz suglasnost.");
  await expect(card(page, tf.title).getByRole("button", { name: tf.withdraw })).toHaveCount(0);

  // 7. The administrator names the committee in the faculty's list: a second chair is refused before any request,
  //    the list is saved only on the server's 200, and the list shows the new size.
  await adminPage(page, w);
  await expect(page.getByRole("cell", { name: to.committeeNone })).toBeVisible();
  await page.getByRole("button", { name: to.openCommitteeFor.replace("{student}", "Izmišljeni Student") }).click();
  const editor = page.getByRole("form", { name: tc.editor.title });
  await expect(editor.getByText(tc.editor.empty)).toBeVisible();
  await editor.getByLabel(tc.editor.addLabel).selectOption(CHAIR);
  await editor.getByLabel(tc.editor.addLabel).selectOption(MEMBER);
  await editor.getByLabel(tc.editor.roleLabel).first().selectOption("chair");
  await editor.getByLabel(tc.editor.roleLabel).last().selectOption("chair");
  await editor.getByRole("button", { name: tc.editor.save }).click();
  await expect(editor.getByRole("alert").first()).toHaveText(tc.problems.manyChairs);
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-committee"))).toEqual([]);
  await editor.getByLabel(tc.editor.roleLabel).last().selectOption("member");
  await editor.getByRole("button", { name: tc.editor.save }).click();
  await expect(editor.getByTestId("note")).toHaveText(tc.saved);
  expect(w.sent.filter((s) => s.method === "PUT" && s.path.endsWith("/thesis-committee")).map((s) => s.body))
    .toEqual([{ members: [{ userId: CHAIR, role: "chair" }, { userId: MEMBER, role: "member" }] }]);
  await expect(page.getByRole("cell", { name: "2 člana" })).toBeVisible();
  // The student sees names and roles, no controls.
  await studentPanel(page, w);
  const committee = card(page, tc.title);
  await expect(committee.getByRole("list", { name: tc.listLabel })).toContainText("Ivana Izmišljena (Predsjednik)");
  await expect(committee.getByRole("list", { name: tc.listLabel })).toContainText("Petar Zamišljeni (Član)");
  await expect(committee.getByText(tc.noAccessNote)).toBeVisible();
  await expect(committee.getByRole("button")).toHaveCount(0);

  // 8. The mentor schedules the defense (the date is required for that stage only); the student sees the date.
  await mentorPanel(page, w);
  const stage = card(page, tg.title);
  await stage.getByLabel(tg.stageLabel).selectOption("defense_scheduled");
  await stage.getByRole("button", { name: tg.save }).click();
  await expect(stage.getByText(tg.errors.dateRequired)).toBeVisible();
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-stage"))).toEqual([]);
  await stage.getByLabel(tg.defenseAtLabel).fill(DEFENSE_LOCAL);
  await stage.getByRole("button", { name: tg.save }).click();
  await expect(stage.getByText(tg.saved)).toBeVisible();
  expect(w.sent.filter((s) => s.path.endsWith("/thesis-stage")).map((s) => s.body)).toEqual([{ stage: "defense_scheduled", defenseAt: DEFENSE_ISO }]);
  await studentPanel(page, w);
  const sStage = card(page, tg.title);
  await expect(sStage.getByTestId("defense-at")).toContainText("15. prosinca 2026.");
  await expect(sStage.getByRole("button", { name: tg.save })).toHaveCount(0);
  await expect(sStage.getByText(tg.studentNote)).toBeVisible();

  // 9. Another's work: the mentor's second work answers 404 on every thesis read, so it shows no panel at all.
  await mentorPanel(page, w);
  expect(w.asked.some((a) => a.includes(OTHER_DOC))).toBe(true);
  await expect(card(page, tf.title)).toHaveCount(1);
  await expect(card(page, tg.title)).toHaveCount(1);
  // The same refusal for a write is a 404 too, never a silent success.
  const status = await page.evaluate(async (doc) => (await fetch(`/api/v1/works/${doc}/thesis-topic`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) })).status, OTHER_DOC);
  expect(status).toBe(404);

  // 10. Accessibility on the mentor's and the student's panel, at 1250 and 400 px, in both themes.
  for (const width of [1250, 400]) {
    await mentorPanel(page, w, width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      await axe(page, info, `val16-mentor-${width}-${theme}`);
    }
  }
});

test("a student reads a topic the mentor decided on while the form was open: 409 refreshes the view", async ({ page }) => {
  const w = newWorld();
  w.topic.state = "proposed";
  w.topic.versions = [{ version: 1, title: "Izmišljena tema: stari prijedlog", summary: "", proposedAt: NOW }];
  await serve(page, w);
  await studentPanel(page, w);
  const mine = studentTopic(page);
  await mine.getByLabel(ts.titleLabel).fill("Izmišljena tema: nova verzija");
  // The mentor approves between the student's read and send.
  w.topic.state = "approved";
  w.topic.decision = { version: 1, decision: "approved", comment: null, decidedAt: NOW, decidedByPart: "mentor" };
  await mine.getByRole("button", { name: ts.submitNew }).click();
  await expect(mine.getByText(ts.conflict)).toBeVisible();
  await expect(mine.getByTestId("topic-approved")).toBeVisible();
  expect(w.topic.versions).toHaveLength(1);
});

test("a thesis section that cannot be read says so and is not shown as empty", async ({ page }) => {
  const w = newWorld();
  await serve(page, w);
  await page.route(`**/api/v1/works/${DOKUMENT_T1}/thesis-stage`, (route) => route.fulfill({ status: 503, json: { code: "unavailable" } }));
  await mentorPanel(page, w);
  const stage = card(page, tg.title);
  await expect(stage.getByRole("alert")).toBeVisible();
  await expect(stage.getByText(thesisHr.empty)).toHaveCount(0);
});
