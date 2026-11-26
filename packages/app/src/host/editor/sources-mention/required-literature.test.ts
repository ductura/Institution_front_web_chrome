import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { sourcesMentionHr as t } from "./messages.hr";
import { RequiredLiteratureView } from "./RequiredLiterature";
import { courseIdOf, labelOf, readRequiredLiterature } from "./required-literature";

const C = "0f0e0d0c-0b0a-4908-8706-050403020115";
const A = "11111111-2222-4333-8444-555566667777";
const record = { id: "a", type: "book", year: 2019, title: "Izmišljena knjiga", place: "Zagreb", publisher: "Izmišljeni nakladnik",
  authors: [{ kind: "person", family: "Primjer", given: "Ana" }, { kind: "organization", name: "Izmišljena ustanova" }] };
const ok = (sources: unknown[]) => (async () => ({ ok: true, status: 200, body: { sources } })) as never;

describe("EDI-R11 obvezna literatura: reading", () => {
  it("reads student.course-literature.get for the course and labels each source", async () => {
    const calls: unknown[] = [];
    const call = (async (id: string, input: unknown) => { calls.push([id, input]); return { ok: true, status: 200, body: { sources: [{ id: "s1", record, doi: null }] } }; }) as never;
    expect(await readRequiredLiterature(call, C)).toEqual({ kind: "ready", sources: [{ id: "s1", label: "Primjer, Ana; Izmišljena ustanova (2019). Izmišljena knjiga" }] });
    expect(calls).toEqual([["student.course-literature.get", { params: { courseId: C }, query: undefined, body: undefined }]]);
  });

  it("an empty list is ready and empty, never an error", async () => {
    expect(await readRequiredLiterature(ok([]), C)).toEqual({ kind: "ready", sources: [] });
  });

  it("401, 404 (another course), 503, a thrown call or a body off the contract is unavailable, not an empty list", async () => {
    for (const status of [401, 404, 503]) expect(await readRequiredLiterature((async () => ({ ok: false, status })) as never, C)).toEqual({ kind: "unavailable" });
    expect(await readRequiredLiterature((async () => { throw new Error("mreža"); }) as never, C)).toEqual({ kind: "unavailable" });
    expect(await readRequiredLiterature(ok([{ id: "s1", record: { title: "x" } }]), C)).toEqual({ kind: "unavailable" });
    expect(await readRequiredLiterature((async () => ({ ok: true, status: 200, body: {} })) as never, C)).toEqual({ kind: "unavailable" });
  });

  it("labelOf refuses a record without title or authors", () => {
    expect(labelOf({ ...record, title: " " })).toBeNull();
    expect(labelOf({ ...record, authors: [] })).toBeNull();
    expect(labelOf(null)).toBeNull();
  });
});

describe("EDI-R11 course of the assignment", () => {
  const assignments = { courses: [{ id: "c-other", name: "x", assignments: [{ id: "zzz" }] }, { id: C, name: "y", assignments: [{ id: A.toUpperCase() }] }] };
  it("finds the course holding the assignment, case-insensitively, otherwise null", () => {
    expect(courseIdOf(assignments, A)).toBe(C);
    expect(courseIdOf(assignments, "nema")).toBeNull();
    expect(courseIdOf({ ok: false }, A)).toBeNull();
    expect(courseIdOf(undefined, A)).toBeNull();
  });
});

describe("EDI-R11 obvezna literatura: view", () => {
  const html = (read: Parameters<typeof RequiredLiteratureView>[0]["read"]) => renderToStaticMarkup(createElement(RequiredLiteratureView, { read, onRetry: () => {} }));
  it("shows loading, error, empty and the list as different states", () => {
    expect(html({ kind: "loading" })).toContain(t.requiredLoading);
    const bad = html({ kind: "unavailable" });
    expect(bad).toContain(t.requiredUnavailable);
    expect(bad).not.toContain(t.requiredNone);
    expect(html({ kind: "ready", sources: [] })).toContain(t.requiredNone);
    const list = html({ kind: "ready", sources: [{ id: "s1", label: "Izmišljena knjiga" }] });
    expect(list).toContain("<li>Izmišljena knjiga</li>");
    expect(list).toContain(t.requiredHeading);
  });
});
