// @vitest-environment jsdom
// F4-PM1-R05: the mandatory literature in the bibliography host comes from student.course-literature.get
// (through RequiredLiterature); without a course it says so honestly instead of showing a made-up list.
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("../../../../../../../src/client/api.ts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createApi: () => async (op: string, input: { params: { courseId?: string; assignmentId?: string } }) => {
    calls.push(`${op}:${input.params.courseId ?? input.params.assignmentId}`);
    if (op === "student.course-literature.get") {
      return input.params.courseId === "c-1"
        ? { ok: true, status: 200, body: { sources: [{ id: "s1", record: { title: "Izmišljena knjiga", year: 2020, authors: [{ kind: "person", family: "Izmišljenić", given: "Ivo" }] } }] } }
        : { ok: false, status: 404 };
    }
    return { ok: true, status: 200, body: { sources: [] } };
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = host = null; calls.length = 0; });

async function show(courseId: string | null | undefined) {
  const { Unavailable } = await import("./StudentBibliographyHost");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(Unavailable, { assignmentId: "a-1", courseId })));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  return host.textContent ?? "";
}

it("lists the required literature of the course", async () => {
  const text = await show("c-1");
  expect(text).toContain("Izmišljenić, Ivo (2020). Izmišljena knjiga");
  expect(calls).toContain("student.course-literature.get:c-1");
});
it("says so, and asks nothing, when the course is unknown", async () => {
  const text = await show(null);
  expect(text).toContain("Obvezna literatura zasad nije dostupna.");
  expect(calls.some((c) => c.startsWith("student.course-literature"))).toBe(false);
});
it("does not show another course's literature as ready when the server answers 404", async () => {
  const text = await show("c-other");
  expect(text).not.toContain("Izmišljena knjiga");
});
