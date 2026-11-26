import { describe, expect, it, vi } from "vitest";

import { canonicalSheetDocument, createSheetDocument } from "../../../../../../editor-core/src/sheet/index.ts";
import { readSheetWork } from "./read.ts";

const text = canonicalSheetDocument(createSheetDocument({ id: "s1", name: "List1" }));
const document = btoa(text);
const ok = (body: object) => ({ ok: true, status: 200, body });
const callOf = (answer: unknown) => vi.fn(async () => answer) as never;

describe("readSheetWork", () => {
  it("is a sheet only for workKind spreadsheet and a valid document", async () => {
    expect(await readSheetWork("a", callOf(ok({ workKind: "spreadsheet", currentRevision: 2, document })))).toMatchObject({ kind: "sheet", revision: 2 });
    expect(await readSheetWork("a", callOf(ok({ workKind: "text", currentRevision: 2, document })))).toEqual({ kind: "other" });
    expect(await readSheetWork("a", callOf(ok({ currentRevision: 2, document })))).toEqual({ kind: "other" });
    expect(await readSheetWork("a", callOf(ok({ workKind: "spreadsheet", currentRevision: 0, document })))).toEqual({ kind: "empty" });
  });
  it("a broken document or a failed read is unavailable, never other or empty; 401 is signIn", async () => {
    expect(await readSheetWork("a", callOf(ok({ workKind: "spreadsheet", currentRevision: 1, document: btoa("{}") })))).toEqual({ kind: "unavailable" });
    expect(await readSheetWork("a", callOf({ ok: false, status: 503 }))).toEqual({ kind: "unavailable" });
    expect(await readSheetWork("a", callOf({ ok: false, status: 404 }))).toEqual({ kind: "unavailable" });
    expect(await readSheetWork("a", callOf({ ok: false, status: 401 }))).toEqual({ kind: "signIn" });
    expect(await readSheetWork("a", (async () => { throw new Error("x"); }) as never)).toEqual({ kind: "unavailable" });
  });
});
