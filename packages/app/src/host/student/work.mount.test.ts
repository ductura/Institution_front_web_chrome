// @vitest-environment jsdom
// WEB-V13-UREDNIK: the branch of WorkPage by kind of work is really mounted: a slides work in
// progress shows the slides editor, an unreadable kind its error with a retry, a text work the
// text editor as before.
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const kinds: { documentKind?: unknown } = {};
const calls: string[] = [];

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: () => {},
  createApi: () => async (op: string) => {
    calls.push(op);
    if (op === "student.assignments.get") {
      return { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Prezentacija", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false, ...kinds }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
vi.mock("../../../../../src/components/editor/EditorPageWork.tsx", () => ({ default: () => createElement("p", null, "TEKSTNI-UREDNIK") }));
vi.mock("./work/requirements", () => ({ readWordRange: async () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = host = null;
  for (const key of Object.keys(kinds)) delete (kinds as Record<string, unknown>)[key];
});

async function open() {
  const { WorkPage } = await import("./work.tsx");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(WorkPage, { assignmentId: ID })));
  // The page reads asynchronously: wait until it shows an editor, an error or the text editor.
  for (let n = 0; n < 100 && !/Uređivač slajdova|ne mogu otvoriti|TEKSTNI-UREDNIK/.test(host.innerHTML); n += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
  }
  return host;
}

describe("WorkPage by kind of work", { timeout: 30000 }, () => {
  it("documentKind slides mounts the slides editor", async () => {
    kinds.documentKind = "slides";
    const el = await open();
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).not.toBeNull();
    expect(el.textContent).not.toContain("TEKSTNI-UREDNIK");
  });
  it("a kind the client does not know shows the error with a retry, never an editor", async () => {
    kinds.documentKind = "video";
    const el = await open();
    expect(el.textContent).toContain("Slajdovi se ne mogu otvoriti");
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
    expect([...el.querySelectorAll("button")].some((b) => b.textContent === "Pokušaj ponovno")).toBe(true);
  });
  it("text, and an answer without the field, keep the text editor", async () => {
    kinds.documentKind = "text";
    expect((await open()).textContent).toContain("TEKSTNI-UREDNIK");
    act(() => root?.unmount());
    host?.remove();
    delete kinds.documentKind;
    const el = await open();
    expect(el.textContent).toContain("TEKSTNI-UREDNIK");
    expect(el.querySelector("[aria-label='Uređivač slajdova']")).toBeNull();
  });
  it("the slides page has the plain top bar: no text-editor shell switches", async () => {
    kinds.documentKind = "slides";
    const el = await open();
    expect(el.textContent).not.toContain("Samo naslovi");
  });
});
