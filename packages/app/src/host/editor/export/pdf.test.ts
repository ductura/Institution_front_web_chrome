import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPdf, type PdfCall, type PdfInput } from "./pdf";
import type { Raw } from "./preparation";

// The contract's own vectors for work.export-pdf.get (invented data), so the screen reads what the server gives.
type Vector = { route: string; name: string; response: { status: number; body: Record<string, unknown> } };
const vectors = (JSON.parse(
  readFileSync(new URL("../../../../../../src/client/migration-contract-vectors.generated.json", import.meta.url), "utf8"),
) as Vector[]).filter((v) => v.route === "work.export-pdf.get");
const vector = (name: string) => {
  const found = vectors.find((v) => v.name === name);
  if (!found) throw new Error(`no vector ${name}`);
  return found.response;
};

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const answering = (raw: Raw) => {
  const seen: [string, PdfInput][] = [];
  const call: PdfCall = async (id, input) => { seen.push([id, input]); return raw; };
  return { call, seen };
};
const success = (body: unknown): Raw => ({ ok: true, status: 200, body });

describe("readPdf (WEB-2005)", () => {
  it("asks one GET for the work under its assignment", async () => {
    const { call, seen } = answering(success(vector("ordinary").body));
    await readPdf(call, ASSIGNMENT, "doc-1");
    expect(seen).toEqual([["work.export-pdf.get", { params: { assignmentId: ASSIGNMENT, documentId: "doc-1" }, query: undefined, body: undefined }]]);
  });

  it("gives the bytes of a plain PDF, and does not call it PDF/A", async () => {
    const body = vector("ordinary").body;
    const result = await readPdf(answering(success(body)).call, ASSIGNMENT, "doc-1");
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.pdfA).toBe(false);
    expect(result.sha256).toBe(body.outputSha256);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("marks PDF/A only when the server says pdfa-2u with a report hash", async () => {
    // The contract's vectors have no certified PDF/A answer; the same invented bytes under the server's PDF/A words.
    const certified = { ...vector("ordinary").body, format: "pdfa-2u", reportHash: "a".repeat(64) };
    const yes = await readPdf(answering(success(certified)).call, ASSIGNMENT, "doc-1");
    expect(yes.kind === "ready" && yes.pdfA).toBe(true);
    const noHash = await readPdf(answering(success({ ...certified, reportHash: null })).call, ASSIGNMENT, "doc-1");
    expect(noHash.kind === "ready" && noHash.pdfA).toBe(false);
  });

  it("refuses bytes whose SHA-256 is not the one the server named", async () => {
    const body = { ...vector("ordinary").body, outputSha256: "0".repeat(64) };
    expect(await readPdf(answering(success(body)).call, ASSIGNMENT, "doc-1")).toEqual({ kind: "mismatch" });
  });

  it("reads a shape the contract does not give as unavailable, never as a file", async () => {
    const body = vector("ordinary").body;
    for (const odd of [null, [], { ...body, format: "docx" }, { ...body, pdfBase64: "aGVsbG8=" }, { ...body, outputSha256: "ABC" }]) {
      expect(await readPdf(answering(success(odd)).call, ASSIGNMENT, "doc-1")).toEqual({ kind: "unavailable" });
    }
    const thrown: PdfCall = async () => { throw new Error("network"); };
    expect(await readPdf(thrown, ASSIGNMENT, "doc-1")).toEqual({ kind: "unavailable" });
  });

  it("maps the contract's errors", async () => {
    const cases: [string, string][] = [["unauthorized", "signed-out"], ["forbidden", "forbidden"], ["not-found", "not-found"], ["unavailable", "unavailable"]];
    for (const [name, kind] of cases) {
      const { status } = vector(name);
      expect(await readPdf(answering({ ok: false, status }).call, ASSIGNMENT, "doc-1")).toEqual({ kind });
    }
  });
});
