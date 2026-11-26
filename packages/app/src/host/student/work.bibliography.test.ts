// @vitest-environment jsdom
// V18-22-R02 (V20-11, V20-14): WorkPage really mounts StudentBibliographyHost in the sources card ("Literatura"),
// with the live editor and the assignment, and mounts nothing while there is no editor.
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const editorState: { editor: object | null } = { editor: { fake: true } };
const seen: { props?: Record<string, unknown> } = {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }), notFound: () => { throw new Error("notFound"); } }));
vi.mock("../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserTransport: async () => new Response("{}"),
  goToSignIn: () => {},
  createApi: () => async (op: string) => {
    if (op === "student.assignments.get") {
      return { ok: true, status: 200, body: { courses: [{ id: "course-1", name: "Kolegij A", assignments: [{ id: ID, title: "Rad", dueAt: "2026-12-01T10:00:00Z", noticeFirst: false }] }] } };
    }
    if (op === "student.assignment-work.get") return { ok: true, status: 200, body: { assignments: [{ assignmentId: ID, workState: "in_progress" }] } };
    return { ok: false, status: 404, code: "not_found" };
  },
}));
vi.mock("../../../../../src/components/editor/EditorPageWork.tsx", () => ({
  default: (props: { literature: (w: { documentId: string }) => unknown }) => {
    seen.props = props;
    return createElement("div", { "data-testid": "sources" }, props.literature({ documentId: "doc-1" }) as never);
  },
}));
vi.mock("../../../../../src/components/editor/LocalDocument.tsx", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useLocalEditor: () => editorState.editor,
}));
vi.mock("../editor/sources-mention/LiteratureList", () => ({ LiteratureList: () => null }));
vi.mock("../editor/bibliography/student/StudentBibliographyHost", () => ({
  StudentBibliographyHost: (p: { documentId: string; assignmentId?: string; courseId?: string | null; editor: object }) =>
    createElement("p", null, `POPIS ${p.documentId} ${p.assignmentId} ${p.courseId} ${p.editor === editorState.editor}`),
}));
vi.mock("./work/requirements", () => ({ readWordRange: async () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = host = null; editorState.editor = { fake: true }; });

async function open() {
  const { WorkPage } = await import("./work.tsx");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(WorkPage, { assignmentId: ID })));
  for (let n = 0; n < 100 && !seen.props; n += 1) await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  return host;
}

describe("WorkPage mounts the bibliography host", { timeout: 30000 }, () => {
  it("passes the document, the assignment, its course and the live editor", async () => {
    expect((await open()).textContent).toBe(`POPIS doc-1 ${ID} course-1 true`);
  });
  it("mounts nothing while the editor is not there", async () => {
    editorState.editor = null;
    seen.props = undefined;
    expect((await open()).textContent).toBe("");
  });
});
