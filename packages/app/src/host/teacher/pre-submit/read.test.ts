import { describe, expect, it, vi } from "vitest";

import { canonicalizeJcs } from "../../../../../editor-core/src/document/forensics/jcs";
import { readSubmittedVersion } from "./read";
import { openPlaces } from "./model";

// Invented v3 document: one heading and one open place (unknown source).
const SRC = { id: "11111111-1111-4111-8111-111111111111", type: "book", authors: [{ kind: "person", family: "Autor A", given: "Ana" }], year: 2019, title: "Izmišljena knjiga", place: "Grad", publisher: "Nakladnik" };
const DOC = {
  schemaVersion: 3, sources: [SRC], nodes: [
    { type: "heading", level: 1, id: "44444444-4444-4444-8444-444444444441", children: [{ type: "text", text: "Uvod", marks: [] }] },
    { type: "paragraph", id: "22222222-2222-4222-8222-222222222221", children: [{ type: "citation", sourceId: "33333333-3333-4333-8333-333333333333" }] },
  ],
};
const CANON = canonicalizeJcs(DOC);

const callOf = (answer: unknown) => vi.fn(async () => answer) as never;
const ok = (revision: number, document: string) => ({ ok: true, status: 200, body: { revision, document } });

describe("teacher read of the submitted revision (NAS-R20-RUTA)", () => {
  it("asks the teacher route for the given revision, not the owner route, and reads the document", async () => {
    const call = callOf(ok(1, CANON));
    const read = await readSubmittedVersion("izmisljeni-rad-0001", 1, call);
    expect((call as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      "teacher.work.submitted-version.get", { params: { documentId: "izmisljeni-rad-0001", revision: "1" }, query: undefined, body: undefined },
    ]);
    expect(read.kind).toBe("document");
    if (read.kind === "document") expect(openPlaces(read.document)).toEqual(["1. Uvod, odlomak 1"]);
  });
  it("404 is notFound (someone else's work, another revision, not submitted), 401 signedOut, other errors unavailable", async () => {
    expect(await readSubmittedVersion("x", 1, callOf({ ok: false, status: 404, code: "not_found" }))).toEqual({ kind: "notFound" });
    expect(await readSubmittedVersion("x", 1, callOf({ ok: false, status: 401, code: "unauthorized" }))).toEqual({ kind: "signedOut" });
    expect(await readSubmittedVersion("x", 1, callOf({ ok: false, status: 503, code: "unavailable" }))).toEqual({ kind: "unavailable" });
    expect(await readSubmittedVersion("x", 1, vi.fn(async () => { throw new Error("net"); }) as never)).toEqual({ kind: "unavailable" });
  });
  it("a bad revision never reaches the server; a wrong revision, non-canonical or invalid document is unavailable", async () => {
    const call = callOf(ok(1, CANON));
    for (const bad of [0, -1, 1.5, Number.NaN]) expect(await readSubmittedVersion("x", bad, call)).toEqual({ kind: "unavailable" });
    expect((call as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect(await readSubmittedVersion("x", 2, callOf(ok(1, CANON)))).toEqual({ kind: "unavailable" });
    expect(await readSubmittedVersion("x", 1, callOf(ok(1, JSON.stringify(DOC, null, 2))))).toEqual({ kind: "unavailable" });
    expect(await readSubmittedVersion("x", 1, callOf(ok(1, "{}")))).toEqual({ kind: "unavailable" });
  });
});
