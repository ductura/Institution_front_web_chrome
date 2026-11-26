// @vitest-environment jsdom
// F4-STU-R10: the footer of a submitted work says "Predano {moment}" (from the signed receipt), not a bare "read only".
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const answer: { receipt: unknown } = { receipt: { kind: "potvrdeno", receipt: { payload: { requestedAt: "2026-11-08T21:30:00.000Z", documentId: "doc-1" } } } };

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: () => {},
  createApi: () => async (op: string) => {
    if (op === "student.assignments.get") {
      return { ok: true, status: 200, body: { courses: [{ name: "Kolegij A", assignments: [{ id: ID, title: "Esej", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "submitted" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
vi.mock("../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts", () => ({ readSubmittedWork: async () => answer.receipt }));
vi.mock("../../../../../src/components/editor/mentor/work-state/ReadOnlyMentor.tsx", () => ({ ReadOnlyMentor: () => null }));
vi.mock("./direct-edit-setting/DirectEditSetting", () => ({ DirectEditSettingHost: () => null }));
vi.mock("../editor/comments/CommentsHost", () => ({ CommentsHost: () => null }));
vi.mock("./work/requirements", () => ({ readWordRange: async () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = host = null; });

async function open() {
  const { WorkPage } = await import("./work.tsx");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(WorkPage, { assignmentId: ID })));
  for (let n = 0; n < 100 && !host.querySelector("footer"); n += 1) await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  return host;
}

describe("WorkPage, a submitted work", { timeout: 30000 }, () => {
  it("the footer says when it was submitted", async () => {
    const el = await open();
    expect(el.querySelector("footer")?.textContent).toContain("Predano 8. 11. 2026., 22:30");
    expect(el.querySelector("footer")?.textContent).toContain("Samo za čitanje");
    expect(el.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"]').length).toBe(0);
  });
  it("without a readable receipt the footer keeps the plain read-only chip", async () => {
    answer.receipt = { kind: "nepoznato" };
    const el = await open();
    expect(el.querySelector("footer")?.textContent).not.toContain("Predano");
  });
});
