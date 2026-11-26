import { describe, expect, it, vi } from "vitest";

import { canonicalSheetDocument, createSheetDocument } from "../../../../../../editor-core/src/sheet/index.ts";
import { readSheetReview } from "./read.ts";

const text = canonicalSheetDocument(createSheetDocument({ id: "s1", name: "List1" }));
const ok = (body: unknown) => ({ ok: true, status: 200, body });
const no = (status: number) => ({ ok: false, status });
const callOf = (answers: Record<string, unknown>) => vi.fn(async (op: string) => answers[op]) as never;
const versions = ok({ versions: [{ kind: "checkpoint", revision: 2, savedMinute: "x" }, { kind: "submission", revision: 3, savedMinute: "y" }], nextBeforeRevision: null });

describe("readSheetReview", () => {
  it("reads the newest revision of a spreadsheet work", async () => {
    const r = await readSheetReview("d", callOf({ "work.versions.get": versions, "work.version.get": ok({ revision: 3, document: text, workKind: "spreadsheet" }) }));
    expect(r).toMatchObject({ kind: "sheet", revision: 3 });
  });
  it("is text for another kind and for a work without a revision", async () => {
    expect(await readSheetReview("d", callOf({ "work.versions.get": versions, "work.version.get": ok({ revision: 3, document: "{}", workKind: "slides" }) }))).toEqual({ kind: "text" });
    expect(await readSheetReview("d", callOf({ "work.versions.get": ok({ versions: [], nextBeforeRevision: null }) }))).toEqual({ kind: "text" });
  });
  it("somebody else's work is notFound, and 401 and a failure stay apart", async () => {
    expect(await readSheetReview("d", callOf({ "work.versions.get": no(404) }))).toEqual({ kind: "notFound" });
    expect(await readSheetReview("d", callOf({ "work.versions.get": versions, "work.version.get": no(404) }))).toEqual({ kind: "notFound" });
    expect(await readSheetReview("d", callOf({ "work.versions.get": no(401) }))).toEqual({ kind: "signedOut" });
    expect(await readSheetReview("d", callOf({ "work.versions.get": no(500) }))).toEqual({ kind: "unavailable" });
  });
  it("a document that is not the canonical bytes of a valid sheet is invalid", async () => {
    const bad = (document: string) => callOf({ "work.versions.get": versions, "work.version.get": ok({ revision: 3, document, workKind: "spreadsheet" }) });
    expect(await readSheetReview("d", bad("{}"))).toEqual({ kind: "invalid" });
    expect(await readSheetReview("d", bad("not json"))).toEqual({ kind: "unavailable" });
    expect(await readSheetReview("d", bad(JSON.stringify(JSON.parse(text), null, 2)))).toEqual({ kind: "invalid" });
  });
});
