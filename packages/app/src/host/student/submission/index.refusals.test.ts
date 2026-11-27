// @vitest-environment jsdom
// S-08 X1, X2 and I6/R8/D3 (Ductus#2059): on every route of the submission a 401 goes to sign-in, a 403 says
// "Nemate pristup ovom prikazu" with the way back, a 404 is "Stranica ne postoji", and only any other failure is
// the read error, as a role=alert frame (with "Pokušaj ponovno" as a link on the declaration). Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { stepsText } from "./steps/messages.hr";

const ID = "00000000-0000-4000-8000-0000000000a1";
const answer: { assignments: { ok: boolean; status: number } } = { assignments: { ok: true, status: 200 } };
const signIn = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => router, notFound: () => { throw new Error("notFound"); },
}));
const router = { replace: () => {}, push: () => {} };
const hostContext = { base: "" };
vi.mock("../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: (...a: unknown[]) => signIn(...a),
  createApi: () => async (op: string) => {
    if (op === "student.assignments.get") {
      if (!answer.assignments.ok) return answer.assignments;
      return { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Esej", dueAt: "2999-12-01T10:00:00Z", noticeFirst: false }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
// The steps themselves are not under test here; only what the page decides before it shows one.
vi.mock("./declaration/DeclarationStep", () => ({ default: () => createElement("p", null, "KORAK-IZJAVA") }));
vi.mock("./summary/BeforeSubmitStep", () => ({ default: () => createElement("p", null, "KORAK-PREGLED") }));
vi.mock("./submit/SubmitStep", () => ({ default: () => createElement("p", null, "KORAK-SLANJE") }));
vi.mock("./submit/exception", async (importOriginal) => ({ ...(await importOriginal<object>()), readException: async () => null, withLateReads: async (t: unknown) => t }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
beforeEach(() => { answer.assignments = { ok: true, status: 200 }; signIn.mockReset(); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

type Pages = typeof import("./index");
async function show(name: "DeclarationStepPage" | "BeforeSubmitStepPage" | "SubmitStepPage") {
  const pages: Pages = await import("./index");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const Page = pages[name] as (p: { assignmentId: string }) => ReturnType<typeof createElement>;
  const errors: unknown[] = [];
  // A 404 ends in notFound(), which throws in the test; a boundary turns that into text.
  class Boundary extends (await import("react")).Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(e: unknown) { errors.push(e); }
    render() { return this.state.failed ? createElement("p", null, "NOT-FOUND-RAISED") : this.props.children; }
  }
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await act(async () => { root?.render(createElement(Boundary, null, createElement(Page, { assignmentId: ID }))); });
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  spy.mockRestore();
  return host;
}

describe.each(["DeclarationStepPage", "BeforeSubmitStepPage", "SubmitStepPage"] as const)("%s refusals", (name) => {
  it("a 403 says it has no access and leads back to the student's own space, not a read error", async () => {
    answer.assignments = { ok: false, status: 403 };
    const host = await show(name);
    expect(host.textContent).toContain(messagesHr.access.deniedTitle);
    const back = [...host.querySelectorAll("a")].find((a) => a.textContent === messagesHr.access.backToOwn);
    expect(back?.getAttribute("href")).toBe("/zadaci");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).not.toContain(stepsText.workError);
  });

  it("a 404 is the page that does not exist, not a read error", async () => {
    answer.assignments = { ok: false, status: 404 };
    const host = await show(name);
    expect(host.textContent).toContain("NOT-FOUND-RAISED");
    expect(host.textContent).not.toContain(stepsText.workError);
  });

  it("a 401 goes to sign-in and shows no error", async () => {
    answer.assignments = { ok: false, status: 401 };
    const host = await show(name);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("any other failure is the read error, as a frame", () => {
  it("on the declaration (I6): a role=alert frame with 'Pokušaj ponovno' as a link under it, and it reads again", async () => {
    answer.assignments = { ok: false, status: 500 };
    const host = await show("DeclarationStepPage");
    const frame = host.querySelector('[role="alert"]');
    expect(frame?.tagName).toBe("DIV");
    expect(frame?.textContent).toBe(stepsText.workError);
    const retry = [...host.querySelectorAll("button, a")].find((e) => e.textContent === stepsText.retry) as HTMLElement;
    expect(retry.className).not.toMatch(/btn|secondary/);
    answer.assignments = { ok: true, status: 200 };
    await act(async () => { retry.click(); });
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(host.textContent).toContain("KORAK-IZJAVA");
  });

  it("on the other steps the button stays under the frame (no second way on)", async () => {
    answer.assignments = { ok: false, status: 500 };
    const host = await show("BeforeSubmitStepPage");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(stepsText.workError);
    expect([...host.querySelectorAll("button")].filter((b) => b.textContent === stepsText.retry)).toHaveLength(1);
  });
});
