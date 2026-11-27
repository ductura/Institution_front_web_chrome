// @vitest-environment jsdom
// NAS-51 (C-4): the teacher reads the student's notes at the submission in the N-10 summary. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_NOTES, FAKE_SUMMARY, fakeN10Port } from "./fake-port";
import { n10Messages as text } from "./messages.hr";
import { loadSummary } from "./model";
import { readSubmissionNotes } from "./port";
import SummaryPage from "./SummaryPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://ductura.example.invalid";
const A = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const WORK = { documentId: "d1", studentId: S, studentName: "Student A", assignmentId: A, state: "predano", prevDocumentId: null, nextDocumentId: null };

function reader(handler: (url: string) => Response, current = true) {
  const transport = vi.fn<typeof fetch>(async (input) => handler(String(input instanceof Request ? input.url : input)));
  return { transport, read: () => readSubmissionNotes("d1", () => current, { baseUrl: ORIGIN, fetchImpl: transport }) };
}

let root: Root | null = null;
async function show(notes: Parameters<typeof fakeN10Port>[4]) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(h(SummaryPage, { port: fakeN10Port(FAKE_SUMMARY, undefined, undefined, undefined, notes), documentId: "d1", workHref: "/w", signInHref: "/x", map: h("div") }));
  });
  return [...host.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent === text.notesTitle)!;
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

describe("N-10 student notes: port", () => {
  it("reads the work, then the notes of that student and assignment", async () => {
    const { transport, read } = reader((url) => url.includes("submission-notes") ? json({ notes: FAKE_NOTES }) : json(WORK));
    expect(await read()).toEqual({ kind: "ok", notes: FAKE_NOTES });
    const urls = transport.mock.calls.map(([i]) => String(i instanceof Request ? i.url : i));
    expect(urls.some((u) => u.includes(`/teacher/assignments/${A}/students/${S}/submission-notes`))).toBe(true);
  });
  it("someone else's work or student is notFound, not an empty list", async () => {
    expect((await reader(() => json({ error: "not_found" }, 404)).read()).kind).toBe("notFound");
    expect((await reader((u) => u.includes("submission-notes") ? json({ error: "not_found" }, 404) : json(WORK)).read()).kind).toBe("notFound");
  });
  it("401 is signedOut, 503 and a broken answer are unavailable, an ended session sends nothing", async () => {
    expect((await reader(() => json({}, 401)).read()).kind).toBe("signedOut");
    expect((await reader(() => json({}, 503)).read()).kind).toBe("unavailable");
    expect((await reader((u) => u.includes("submission-notes") ? json({ notes: [{ id: "x", text: "", createdAt: "?" }] }) : json(WORK)).read()).kind).toBe("unavailable");
    const ended = reader(() => json(WORK), false);
    expect((await ended.read()).kind).toBe("signedOut");
    expect(ended.transport).not.toHaveBeenCalled();
  });
});

describe("N-10 student notes: screen", () => {
  it("lists the notes with their time as plain text", async () => {
    const section = await show({ kind: "ok", notes: [{ ...FAKE_NOTES[0]!, text: "<b>x</b> napomena" }] });
    expect(section.textContent).toContain("5. 11. 2026. u 21:10");
    expect(section.textContent).toContain("<b>x</b> napomena");
    expect(section.querySelector("b")).toBeNull();
  });
  it("says there are no notes only when the server returned none", async () => {
    expect((await show({ kind: "ok", notes: [] })).textContent).toContain(text.notesEmpty);
  });
  it("says not available (never 'no notes') when the read failed", async () => {
    const section = await show({ kind: "unavailable" });
    expect(section.textContent).toContain(text.unavailable);
    expect(section.textContent).not.toContain(text.notesEmpty);
  });
  it("loadSummary keeps notes out of the read when the port has none", async () => {
    const { notes: _n, ...port } = fakeN10Port();
    const read = await loadSummary(port, "d1");
    expect(read.kind === "ready" && read.notes === undefined).toBe(true);
  });
});
