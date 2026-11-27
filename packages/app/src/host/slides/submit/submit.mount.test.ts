// @vitest-environment jsdom
// WEB-V13-PREDAJA: step 4 of the submission is really mounted by kind: a slides work gets the slides
// step, a text work (and an answer without the kind) the text step as before.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "00000000-0000-4000-8000-0000000000a1";
const kinds: { documentKind?: unknown } = {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "" }) }));
vi.mock("../../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: () => {},
  createApi: () => async (op: string) => {
    if (op === "student.assignments.get") {
      return { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Prezentacija", dueAt: "2999-12-01T10:00:00Z", noticeFirst: false, ...kinds }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
vi.mock("../../student/submission/submit/SubmitStep", () => ({ default: () => createElement("p", null, "TEKSTNA-PREDAJA") }));
vi.mock("./SlidesSubmit", () => ({ default: (p: { assignmentId: string }) => createElement("p", null, `SLAJD-PREDAJA ${p.assignmentId}`) }));
vi.mock("../../student/submission/submit/exception", async (importOriginal) => ({ ...(await importOriginal<object>()), readException: async () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; delete kinds.documentKind; });

async function page() {
  const { SubmitStepPage } = await import("../../student/submission/index");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(createElement(SubmitStepPage, { assignmentId: ID })); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}

describe("SubmitStepPage by kind", () => {
  it("a slides work is submitted by the slides step", async () => {
    kinds.documentKind = "slides";
    const text = (await page()).textContent;
    expect(text).toContain(`SLAJD-PREDAJA ${ID}`);
    expect(text).not.toContain("TEKSTNA-PREDAJA");
  });
  it("a text work and an answer without the kind keep the text step", async () => {
    expect((await page()).textContent).toContain("TEKSTNA-PREDAJA");
    act(() => root?.unmount()); root = null; document.body.innerHTML = "";
    kinds.documentKind = "text";
    const text = (await page()).textContent;
    expect(text).toContain("TEKSTNA-PREDAJA");
    expect(text).not.toContain("SLAJD-PREDAJA");
  });
});
