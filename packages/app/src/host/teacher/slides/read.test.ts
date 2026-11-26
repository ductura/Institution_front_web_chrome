// WEB-V13-NASTAVNIK-PREGLED: the reads. They go only through the client's operations, and somebody else's work
// (404) is "notFound", never an empty list or a text work.
import { describe, expect, it, vi } from "vitest";

import { slidesRevisionZeroDocument, slidesSnapshotText } from "../../../../../editor-core/src/slides/index.ts";
import { readSlidesRevision, readSlidesRevisions } from "./read.ts";

const text = slidesSnapshotText(slidesRevisionZeroDocument());
const ok = (body: unknown) => ({ ok: true, status: 200, body });
const no = (status: number) => ({ ok: false, status });
const callOf = (answers: Record<string, unknown>) => vi.fn(async (op: string) => answers[op]) as never;
const versions = ok({ versions: [{ kind: "checkpoint", revision: 2, savedMinute: "2026-11-20T10:00:00.000Z" }, { kind: "submission", revision: 3, savedMinute: "2026-11-20T11:00:00.000Z", afterDeadline: false }], nextBeforeRevision: null });

describe("readSlidesRevisions", () => {
  it("is slides when the newest revision says so, newest first", async () => {
    const r = await readSlidesRevisions("d", callOf({ "work.versions.get": versions, "work.version.get": ok({ revision: 3, document: text, documentKind: "slides" }) }));
    expect(r).toMatchObject({ kind: "slides", more: false });
    expect(r.kind === "slides" && r.revisions.map((x) => x.revision)).toEqual([3, 2]);
  });
  it("is text without the field (a text work) and for a work without a saved revision", async () => {
    expect(await readSlidesRevisions("d", callOf({ "work.versions.get": versions, "work.version.get": ok({ revision: 3, document: "{}" }) }))).toEqual({ kind: "text" });
    expect(await readSlidesRevisions("d", callOf({ "work.versions.get": ok({ versions: [], nextBeforeRevision: null }) }))).toEqual({ kind: "text" });
  });
  it("keeps 401, 404 and a failure apart", async () => {
    expect(await readSlidesRevisions("d", callOf({ "work.versions.get": no(404) }))).toEqual({ kind: "notFound" });
    expect(await readSlidesRevisions("d", callOf({ "work.versions.get": no(401) }))).toEqual({ kind: "signedOut" });
    expect(await readSlidesRevisions("d", callOf({ "work.versions.get": no(503) }))).toEqual({ kind: "unavailable" });
  });
});

describe("readSlidesRevision", () => {
  it("reads a verified revision", async () => {
    const r = await readSlidesRevision("d", 3, callOf({ "work.version.get": ok({ revision: 3, document: text, documentKind: "slides" }) }));
    expect(r).toMatchObject({ kind: "ready", revision: 3 });
  });
  it("refuses another revision than asked, a text document and a broken one", async () => {
    expect(await readSlidesRevision("d", 3, callOf({ "work.version.get": ok({ revision: 2, document: text, documentKind: "slides" }) }))).toEqual({ kind: "unavailable" });
    expect(await readSlidesRevision("d", 3, callOf({ "work.version.get": ok({ revision: 3, document: "{}" }) }))).toEqual({ kind: "invalid" });
    expect(await readSlidesRevision("d", 3, callOf({ "work.version.get": ok({ revision: 3, document: "x", documentKind: "slides" }) }))).toEqual({ kind: "invalid" });
    expect(await readSlidesRevision("d", 0, callOf({}))).toEqual({ kind: "unavailable" });
  });
  it("calls somebody else's work not found", async () => {
    expect(await readSlidesRevision("d", 3, callOf({ "work.version.get": no(404) }))).toEqual({ kind: "notFound" });
  });
});
