// WEB-NF3-PITANJE (NF-3 PR-20, NF-4 NZ-15, NF-5 PG-6): the teacher's question beside the declaration.
// The student answers it on step 2 „Izjava” (by keyboard, on the server's draft); after submission it is
// read only. The teacher sees the question and the answer in the declaration card of „Pregled rada”, and
// the assignment form takes the question (teacher.declaration-question.put). axe at 390 and 1280 px in both
// themes. The server is faked per test over the contract's vectors; every person, text and id is invented.
import { readFileSync } from "node:fs";

import type ContractVectors from "../../../src/client/migration-contract-vectors.generated.json";

import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const QUESTION = { questionId: "00000000-0000-4000-8000-0000000000e1", text: "Koji Vam je izmišljeni izvor najviše pomogao?" };
const ANSWER = { questionId: QUESTION.questionId, questionText: QUESTION.text, text: "Izmišljeni udžbenik iz metodologije." };
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const DRAFT_STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, payload: null, declarationSha256: null, uploads: [],
  declarationRequired: true, teacherQuestion: QUESTION, questionAnswer: null as typeof ANSWER | null,
  draft: {
    baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false }, humanHelp: { received: false, entries: [] },
    ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] }, confirm: false,
  },
};

/** The "puno" student on T1, with a declaration that keeps the answer each PUT sends. */
async function student(page: Page, start = DRAFT_STATE) {
  const server = generatedServer("puno");
  let declaration = { ...start };
  const puts: Record<string, unknown>[] = [];
  await page.clock.setFixedTime(new Date(FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/declaration")) {
      if (req.method() === "PUT") {
        const put = req.postDataJSON() as Record<string, unknown> & { questionAnswer?: { questionId: string; text: string } | null };
        puts.push(put);
        declaration = {
          ...declaration, version: declaration.version + 1,
          questionAnswer: put.questionAnswer ? { ...put.questionAnswer, questionText: QUESTION.text } : put.questionAnswer === null ? null : declaration.questionAnswer,
        };
      }
      return route.fulfill({ json: declaration });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    return route.fulfill(result);
  });
  return { puts };
}

const main = (page: Page) => page.locator("main");

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-20: the student answers the teacher's question by keyboard and it is saved on the server (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const { puts } = await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
      await setTheme(page, theme);
      const block = main(page).locator('[data-nf3="PR-20"]');
      await expect(block.getByRole("heading", { name: "Pitanje nastavnika" })).toBeVisible();
      await expect(block.getByText(QUESTION.text, { exact: true })).toBeVisible();
      await expect(block.getByText("Odgovor vidi nastavnik uz izjavu.", { exact: false })).toBeVisible();
      await axe(page, info, `nf3-pitanje-${width}-${theme}`);
      const field = block.getByLabel("Odgovor (nije obavezan)");
      await field.focus();
      await page.keyboard.type("Izmišljeni odgovor iz izmišljene knjige.");
      await page.keyboard.press("Tab");
      await expect(block.getByRole("button", { name: "Spremi odgovor" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(block.getByRole("status")).toHaveText("Odgovor je spremljen na poslužitelju.");
      expect(puts.at(-1)).toMatchObject({ baseVersion: 4, confirm: false, questionAnswer: { questionId: QUESTION.questionId, text: "Izmišljeni odgovor iz izmišljene knjige." } });
      // The step read again: the field holds what the server keeps.
      await expect(field).toHaveValue("Izmišljeni odgovor iz izmišljene knjige.");
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll).toBeLessThanOrEqual(0);
    });
  }
}

test("PR-20: without a question the step has no question block", async ({ page }) => {
  await student(page, { ...DRAFT_STATE, teacherQuestion: null as unknown as typeof QUESTION });
  await page.goto(`/aplikacija/rad/${T1}/predaja/izjava`);
  await expect(main(page).getByRole("heading", { name: "Izjava o korištenju generativne umjetne inteligencije" })).toBeVisible();
  await expect(main(page).locator('[data-nf3="PR-20"]')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// The teacher: PG-6 in „Pregled rada”, NZ-15 in the assignment form.

const documentId = "rad-izmisljeni-pitanje";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e2";
const BOUND = {
  state: "bound", declarationSha256: "b".repeat(64), question: QUESTION, questionAnswer: ANSWER, payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "d1000000-0000-4000-8000-000000000001", declarationVersion: 1,
    principalId: studentId, assignmentId, assignmentVersion: 1, documentId, revision: 3,
    form: FORM, ownWork: { confirmed: true }, humanHelp: { received: false, entries: [] },
    ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-20T10:00:00.000000Z",
  },
};

const vectors = JSON.parse(readFileSync(
  new URL("../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8",
)) as typeof ContractVectors;
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;

async function teacher(page: Page, declaration: unknown) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case "/api/v1/me": return route.fulfill({ json: { ...profile, roles: ["teacher"] } });
      case "/api/v1/teacher/access": return route.fulfill({ json: { access: "allowed", scope: "a".repeat(64) } });
      case "/api/v1/profile/interface-locale": return route.fulfill({ json: { locale: null } });
      case `/api/v1/teacher/works/${documentId}`: return route.fulfill({ json: {
        documentId, studentId, studentName: "Student A", assignmentId, state: "predano", prevDocumentId: null, nextDocumentId: null,
      } });
      case `/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/declaration`: return route.fulfill({ json: declaration });
      default: return route.fallback();
    }
  });
}

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PG-6: the question and the student's answer in the declaration card (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await teacher(page, BOUND);
      await page.goto(`/aplikacija/nastavnik/rad/${documentId}/pregled?kartica=izjava`);
      await setTheme(page, theme);
      const block = page.locator('[data-nf5="PG-6"]');
      await expect(block.getByRole("heading", { name: "Pitanje nastavnika i odgovor studenta" })).toBeVisible();
      await expect(block.getByText(QUESTION.text, { exact: true })).toBeVisible();
      await expect(block.getByText(ANSWER.text, { exact: true })).toBeVisible();
      await expect(page.getByText(/Učitavam/)).toHaveCount(0);
      await axe(page, info, `nf5-pg6-pitanje-${width}-${theme}`);
    });
  }
}

test("PG-6: a declaration not given yet says the answer waits for it", async ({ page }) => {
  await teacher(page, { state: "none", payload: null, declarationSha256: null, question: QUESTION, questionAnswer: null });
  await page.goto(`/aplikacija/nastavnik/rad/${documentId}/pregled?kartica=izjava`);
  await expect(page.locator('[data-nf5="PG-6"]').getByText("Student još nije predao izjavu; odgovor će se vidjeti uz izjavu.")).toBeVisible();
});

const K1 = "6b1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e11";

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`NZ-15: the question field in the assignment form takes a question and names its limit (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/v1/me", (route) => route.fulfill({ json: {
        role: "teacher", displayName: "Iva Izmišljena", institution: { slug: "izm", displayName: "Izmišljeni fakultet" },
      } }));
      await page.route("**/api/v1/teacher/courses", (route) => route.fulfill({ json: { courses: [{
        id: K1, name: "Izmišljeni kolegij", academicYear: "2026/2027", aiPolicy: "partially_allowed", assignments: [],
      }] } }));
      await page.route(`**/api/v1/institution/courses/${K1}/groups`, (route) => route.fulfill({ json: { groups: [] } }));
      await page.goto(`/aplikacija/nastavnik/zadatak/novi?kolegij=${K1}`);
      await setTheme(page, theme);
      const field = page.getByLabel("Pitanje studentu uz izjavu (nije obavezno)");
      await expect(field).toBeEnabled();
      await expect(page.getByText("Do 500 znakova.", { exact: false })).toBeVisible();
      await expect(page.getByText("trenutačno nije dostupno", { exact: false })).toHaveCount(0);
      await field.fill("Koji Vam je izmišljeni izvor najviše pomogao?");
      await expect(field).toHaveValue("Koji Vam je izmišljeni izvor najviše pomogao?");
      await field.fill("x".repeat(501));
      await expect(page.getByText("Pitanje može imati najviše 500 znakova.")).toBeVisible();
      await axe(page, info, `nf4-nz15-${width}-${theme}`);
    });
  }
}
