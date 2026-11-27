// WEB-NUZ-PREDAJA-2 (NF-3 PR-3, PR-7, PR-8, PR-9; Daniel's answer 3): step 3 lists what to look at, the
// dialog "Predati rad?" says only what is true and asks a late submission twice, a refused, not open or
// unknown outcome is a panel of its own, and an unknown one is read again. The server is the VIZ "puno"
// scenario over the contract's vectors, with the declaration, the text, the deadline and the answer of
// the submission set per test. Every person, course, text and identifier is invented.
import { createHash } from "node:crypto";

import { axe, setTheme } from "./a11y/check";
import { expect, test, type Page } from "./fixtures/test";
import { FIKSNI_DATUM, T1 } from "../test-fakes/viz-scenariji";
import { generatedServer } from "./viz/server";

const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const CONFIRMED = {
  submitted: false, currentRevision: 2, version: 5, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, uploads: [],
  state: "confirmed", draft: null, declarationSha256: "d".repeat(64),
  payload: {
    declarationSchema: "ductura-declaration-v1", declarationId: "00000000-0000-4000-8000-0000000000d1", declarationVersion: 5,
    principalId: "00000000-0000-4000-8000-0000000000e1", assignmentId: T1, assignmentVersion: 1,
    documentId: "dokument-izmisljeni-zv-1", revision: 2, form: FORM, ownWork: { confirmed: true },
    humanHelp: { received: false, entries: [] }, ai: { use: "not_used", declaredTools: [], recorded: [], attachments: [] },
    confirmedAt: "2026-11-04T10:00:00.000000Z",
  },
};

/** The invented text on the server: one place before any heading, one under a heading. */
const DOCUMENT = Buffer.from(JSON.stringify({
  nodes: [
    { id: "5f0c1e8a-3b7d-4c2e-9a61-0d4e8b2f7c13", type: "paragraph", children: [{ type: "text", text: "Kućno kompostiranje u gradu [izvor] širi se među susjedima.", marks: [] }] },
    { id: "8b3e2d71-6c4f-4a90-b5d2-e17f0a9c3b46", type: "heading", level: 1, children: [{ type: "text", text: "2. Izmišljena analiza", marks: [] }] },
    { id: "9c4f3e82-7d5a-4b01-86e3-f28a1b0d4c57", type: "paragraph", children: [{ type: "text", text: "Broj izmišljenih kućanstava [?] raste.", marks: [] }] },
  ],
  schemaVersion: 1,
}));
const OPENED = {
  status: "opened", documentId: "dokument-izmisljeni-zv-1", evidenceProfileId: "standard-v1", currentRevision: 2,
  documentHash: createHash("sha256").update(DOCUMENT).digest("hex"), headSegmentHash: "2".repeat(64), lastSequenceTo: 4,
  document: DOCUMENT.toString("base64"), submitted: false,
  receiptKeys: [{ algorithm: "Ed25519", keyId: "ductus-golden-rfc8032-test-1", keyVersion: "1", encoding: "spki-der",
    keyBase64Url: "MCowBQYDK2VwAyEA11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo", evidenceDomainId: "d21fe0a3-103c-42e5-a29e-c102f9030af5",
    purpose: "receipt", validFrom: "2026-01-01T00:00:00.000Z", validTo: null, revokedAt: null }],
};
const EXCEPTION_UNTIL = "2026-11-12T22:59:00.000Z";

type Answers = {
  /** The answer of submission.submit-second.post: a status and a body. */
  submit?: { status: number; body: unknown };
  /** student.submission.get: a status to answer with (503 keeps the outcome unknown). */
  state?: number;
  /** The teacher's exception for this student until EXCEPTION_UNTIL. */
  exception?: boolean;
  /** The moment of the page: after T1's deadline for a late submission. */
  now?: string;
  /**
   * F4-PRE-R01: the assignment's late rule and this student's late-submission exceptions. Left out, both reads
   * answer 503, so the timing stays as the deadline alone says and the server's 409 decides (the fallback).
   */
  late?: { allowed: boolean; exceptionsUntil: readonly string[] };
};

/** The "puno" student on T1, with a confirmed declaration and the text above. */
async function student(page: Page, answers: Answers = {}) {
  const server = generatedServer("puno");
  const reads = { state: 0 };
  await page.clock.setFixedTime(new Date(answers.now ?? FIKSNI_DATUM));
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "GET" && path.endsWith("/declaration-v2")) return route.fulfill({ json: CONFIRMED });
    if (req.method() === "POST" && path === "/api/v1/evidence/open") return route.fulfill({ json: OPENED });
    // WEB-V17-FORMAT-CHECK: invented format rules for the form check of step 3.
    if (req.method() === "GET" && path.endsWith("/format-rules")) return route.fulfill({ json: { wordMin: 100, wordMax: null, minSources: 0, requiredSections: [], citationStyle: "fpzg", font: null, size: null, spacing: null } });
    if (req.method() === "GET" && path.endsWith("/late-submission")) {
      return answers.late === undefined ? route.fulfill({ status: 503, json: { status: "unavailable" } }) : route.fulfill({ json: { lateSubmissionAllowed: answers.late.allowed } });
    }
    if (req.method() === "GET" && path.endsWith("/late-submission-exceptions")) {
      return answers.late === undefined ? route.fulfill({ status: 503, json: { status: "unavailable" } }) : route.fulfill({ json: { exceptions: answers.late.exceptionsUntil.map((untilAt, i) => (
        { id: `00000000-0000-4000-8000-0000000000a${i}`, kind: "exception", untilAt, reasonId: "justified", createdAt: "2026-11-09T09:00:00.000Z" })) } });
    }
    if (req.method() === "POST" && path === "/api/v1/submission/v2" && answers.submit !== undefined) {
      return route.fulfill({ status: answers.submit.status, json: answers.submit.body });
    }
    if (req.method() === "GET" && path.endsWith("/submission") && answers.state !== undefined) {
      reads.state += 1;
      return route.fulfill({ status: answers.state, json: { status: "unavailable" } });
    }
    if (req.method() === "GET" && path.endsWith("/deadline-extensions") && answers.exception) {
      return route.fulfill({ json: { extensions: [{ id: "00000000-0000-4000-8000-0000000000f1", scope: "one", previousDueAt: "2026-11-08T22:59:00.000Z", dueAt: EXCEPTION_UNTIL, reasonId: "justified", createdAt: "2026-11-09T09:00:00.000Z" }] } });
    }
    const result = server.answer("student", req.method(), path);
    if (result === "hang") return undefined;
    if (answers.exception && req.method() === "GET" && path === "/api/v1/student/assignments" && "body" in result && typeof result.body === "string") {
      const body = JSON.parse(result.body) as { courses: { assignments: { id: string; extendedDueAt?: string }[] }[] };
      for (const course of body.courses) for (const a of course.assignments) if (a.id === T1) a.extendedDueAt = EXCEPTION_UNTIL;
      return route.fulfill({ ...result, body: JSON.stringify(body) });
    }
    return route.fulfill(result);
  });
  return reads;
}

const submitButton = (page: Page) => page.locator("main").getByRole("button", { name: "Predaj rad", exact: true });

for (const width of [390, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`PR-3: step 3 lists the places and the pastes, says the form check honestly, and "Dalje" leads on (${width} px, ${theme})`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await student(page);
      await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
      await setTheme(page, theme);
      await expect(page.getByRole("link", { name: "Odlomak 1 ([izvor])" })).toBeVisible();
      await expect(page.getByRole("link", { name: "2. Izmišljena analiza, odlomak 1 ([?])" })).toBeVisible();
      // WEB-V17-FORMAT-CHECK: the form check is real now; the invented text is below the invented 100-word minimum.
      await expect(page.getByText(/Broj riječi: odstupa\. \d+ riječi, najmanje 100\./)).toBeVisible();
      await expect(page.getByText("Savjetodavno: provjera oblika ne zaustavlja predaju.")).toBeVisible();
      await expect(page.getByText(/Možete dodati oznaku podrijetla\. Nije obavezno\./)).toBeVisible();
      await axe(page, info, `pregled-popisi-${width}-${theme}`);
      const next = page.getByRole("button", { name: "Dalje", exact: true });
      await expect(next).not.toHaveAttribute("aria-disabled", "true");
      await next.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/rad/${T1}/predaja/slanje$`));
    });
  }
}

for (const width of [390, 1280]) {
  test(`PR-7: the dialog says the declaration and the words, and a late submission is confirmed twice, by keyboard (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { now: "2026-11-10T12:00:00+01:00", submit: { status: 409, body: { status: "not_open" } } });
    await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
    await expect(page.getByText(/^Rok je prošao 8\. 11\. 2026\. u 23:59\./)).toBeVisible();
    await submitButton(page).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Predati rad?" });
    await expect(dialog.getByText(/spremljen na poslužitelju, s izjavom\. Riječi: \d+\./)).toBeVisible();
    await expect(dialog.getByText("Rok je prošao, pa će potvrda navesti da je rad predan nakon roka.")).toBeVisible();
    const box = dialog.getByRole("checkbox", { name: "Razumijem da će predaja biti označena kao predaja nakon roka." });
    await expect(box).toBeFocused();
    const send = dialog.getByRole("button", { name: "Predaj rad" });
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await axe(page, info, `predati-rad-kasno-${width}`);
    await page.keyboard.press("Space");
    await expect(send).not.toHaveAttribute("aria-disabled", "true");
    await send.click();
    // Daniel's answer 3: the assignment does not take a late submission (409 not_open): a panel of its own.
    await expect(page.getByRole("heading", { name: "Predaja nije otvorena" })).toBeVisible();
    await expect(page.getByText(/Rok je bio 8\. 11\. 2026\. u 23:59\. Obratite se nastavniku kolegija\./)).toBeVisible();
    await expect(submitButton(page)).toHaveCount(0);
    await axe(page, info, `predaja-nije-otvorena-${width}`);
  });
}

for (const width of [390, 1280]) {
  test(`F4-PRE-R01: an assignment without late submission says so on steps 3 and 4 before the click (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    let posts = 0;
    page.on("request", (req) => { if (req.method() === "POST" && req.url().endsWith("/api/v1/submission/v2")) posts += 1; });
    await student(page, { now: "2026-11-10T12:00:00+01:00", late: { allowed: false, exceptionsUntil: [] } });
    await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
    await expect(page.getByText(/^Predaja za ovaj zadatak više nije otvorena\. Rok je bio 8\. 11\. 2026\. u 23:59\./)).toBeVisible();
    await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
    await expect(page.getByText(/^Predaja za ovaj zadatak više nije otvorena\./)).toBeVisible();
    await expect(page.getByText("Zadatak ne dopušta predaju nakon roka.", { exact: false })).toBeVisible();
    await expect(submitButton(page)).toHaveAttribute("aria-disabled", "true");
    await axe(page, info, `predaja-zatvorena-${width}`);
    await submitButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Predati rad?" })).toHaveCount(0);
    expect(posts).toBe(0);
  });
}

test("F4-PRE-R01: an open late-submission exception is the deadline that counts, and a permitted late one is said", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { now: "2026-11-10T12:00:00+01:00", late: { allowed: false, exceptionsUntil: [EXCEPTION_UNTIL] } });
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(page.getByText("Rok iznimke")).toBeVisible();
  await expect(submitButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await student(page, { now: "2026-11-10T12:00:00+01:00", late: { allowed: true, exceptionsUntil: [] } });
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(page.getByText(/Zadatak dopušta predaju nakon roka; predaja će biti označena kao predaja nakon roka\./)).toBeVisible();
});

test("Daniel's answer 3: the teacher's exception is named on steps 3 and 4 with its deadline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await student(page, { now: "2026-11-10T12:00:00+01:00", exception: true });
  await page.goto(`/aplikacija/rad/${T1}/predaja/pregled`);
  await expect(page.getByText(/nastavnik je za Vas iznimno odobrio kasnu predaju do 12\. 11\. 2026\. u 23:59/i)).toBeVisible();
  await expect(page.getByText("Iznimka do 12. 11. 2026.")).toBeVisible();
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await expect(page.getByText("Rok iznimke")).toBeVisible();
  await submitButton(page).click();
  await expect(page.getByRole("dialog", { name: "Predati rad?" }).getByRole("checkbox")).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`PR-8: a refused submission is its own panel without "Predaj rad" (${width} px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await student(page, { submit: { status: 409, body: { status: "blocked", reason: "no_evidence" } } });
    await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
    await submitButton(page).click();
    await page.getByRole("dialog", { name: "Predati rad?" }).getByRole("button", { name: "Predaj rad" }).click();
    await expect(page.getByRole("heading", { name: "Predaja nije prihvaćena" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "na poslužitelju nema zapisa ovog rada" })).toBeVisible();
    await expect(page.getByText("Rad nije predan. Tekst je spremljen na uređaju.")).toBeVisible();
    await expect(submitButton(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Otvori radni prostor" })).toBeVisible();
    // Nothing unconfirmed on this device: the workspace would say "Spremljeno na poslužitelju".
    const retry = page.getByRole("button", { name: "Pokušaj ponovno" });
    await expect(retry).not.toHaveAttribute("aria-disabled", "true");
    await axe(page, info, `predaja-odbijena-${width}`);
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(submitButton(page)).toBeVisible();
  });
}

test("PR-9: an unknown outcome is one message, read again when the connection returns, never offering 'Predaj rad'", async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const reads = await student(page, { submit: { status: 503, body: { status: "unavailable", stage: "signing" } }, state: 503 });
  await page.goto(`/aplikacija/rad/${T1}/predaja/slanje`);
  await submitButton(page).click();
  await page.getByRole("dialog", { name: "Predati rad?" }).getByRole("button", { name: "Predaj rad" }).click();
  await expect(page.getByText("Odgovor poslužitelja nije stigao, pa ishod predaje nije poznat. Rad je možda predan.")).toBeVisible();
  await expect(page.getByText(/Pokušaj 1 od 3\./)).toBeVisible();
  await expect(submitButton(page)).toHaveCount(0);
  await axe(page, info, "predaja-nepoznato");
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.getByText(/Pokušaj 2 od 3\./)).toBeVisible();
  expect(reads.state).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Provjeri stanje predaje" }).click();
  await expect(page.getByText(/Pokušaj 3 od 3\./)).toBeVisible();
  await page.getByRole("button", { name: "Provjeri stanje predaje" }).click();
  await expect(page.getByText("Stanje predaje nije moguće pročitati ni nakon trećeg pokušaja. Rad je možda predan; tekst rada nije zahvaćen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prijavi problem" })).toBeVisible();
  await expect(submitButton(page)).toHaveCount(0);
  await axe(page, info, "predaja-nepoznato-treci");
});
