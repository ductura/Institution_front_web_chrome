import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { BYTES, FILE_ID, PREFIX, fakePreparation } from "./fake-port";
import { pdfExportText } from "./messages.hr";
import { fetchPrepared, newRequestKey, parseAnswer, runPreparation, showsPdfA, type Phase, type PrepareCalls } from "./preparation";
import { pdfFileName } from "./contract";
import { packageCalls, packageDownloadPrefix } from "../../student/submission-package/contract";
import { submissionPackageText } from "../../student/submission-package/messages.hr";

const sha = createHash("sha256").update(BYTES).digest("hex");
const now = () => new AbortController().signal;
const instant = async () => undefined;
const run = (calls: PrepareCalls, signal = now(), extra = {}) =>
  runPreparation(calls, { signal, downloadPrefix: PREFIX, wait: instant, ...extra });

describe("preparation (WEB-1803)", () => {
  it("polls until the server says ready, and the PDF/A mark is the server's word", async () => {
    const server = fakePreparation([{ state: "queued" }, { state: "queued" }, { state: "ready", pdfA: true }], sha);
    const phase = await run(server.calls());
    expect(phase).toMatchObject({ kind: "ready", file: { pdfA: true, sha256: sha } });
    expect(showsPdfA(phase)).toBe(true);
    expect(server.seen.reads).toBe(2);
  });

  it("draws no PDF/A mark when the answer does not say true", async () => {
    for (const pdfA of [undefined, false, "true", 1, null]) {
      const server = fakePreparation([{ state: "ready", pdfA }], sha);
      const phase = await run(server.calls());
      // A non-boolean is not an answer at all; a missing or false one is a PDF without the mark.
      expect(showsPdfA(phase)).toBe(false);
      expect(phase.kind).toBe(pdfA === undefined || pdfA === false ? "ready" : "unknown");
    }
  });

  it("stops on 'Odustani': the reads end and the server is told once", async () => {
    const controller = new AbortController();
    const server = fakePreparation([{ state: "queued" }]);
    const phase = await run(server.calls(), controller.signal, { wait: async () => controller.abort() });
    expect(phase).toEqual({ kind: "cancelled" });
    expect(server.seen.cancels).toEqual([FILE_ID]);
    expect(server.seen.reads).toBe(0);
  });

  it("maps failed, expired, sign-out and broken answers", async () => {
    expect((await run(fakePreparation([{ state: "failed" }]).calls())).kind).toBe("failed");
    expect((await run(fakePreparation([{ state: "expired" }]).calls())).kind).toBe("expired");
    const gone = { start: async () => ({ ok: false as const, status: 401 }), read: async () => ({ ok: false as const, status: 401 }), cancel: async () => null };
    expect((await run(gone)).kind).toBe("session-expired");
    const rejected = { ...gone, start: async () => ({ ok: false as const, status: 0, code: "client_rejected" }) };
    expect((await run(rejected)).kind).toBe("unknown");
    const broken = { ...gone, start: async () => ({ ok: true as const, status: 202, body: { id: "x" } }) };
    expect((await run(broken)).kind).toBe("unknown");
    const throws = { ...gone, start: async () => { throw new Error("offline"); } };
    expect((await run(throws)).kind).toBe("unknown");
  });

  it("gives up after the reads it allows, as unknown", async () => {
    const server = fakePreparation([{ state: "queued" }]);
    expect((await run(server.calls(), now(), { maxReads: 3 })).kind).toBe("unknown");
    expect(server.seen.reads).toBe(3);
  });

  it("trusts only a download path of its own prefix and a closed shape", () => {
    const base = { id: FILE_ID, state: "ready", sha256: sha };
    expect(parseAnswer({ ...base, downloadPath: `${PREFIX}${FILE_ID}` }, PREFIX)).not.toBeNull();
    for (const downloadPath of ["/api/v1/works/other/exports/x", `${PREFIX}../x`, `${PREFIX}x?a=1`, "https://evil.example/x"]) {
      expect(parseAnswer({ ...base, downloadPath }, PREFIX)).toBeNull();
    }
    expect(parseAnswer({ ...base }, PREFIX)).toBeNull();
    expect(parseAnswer({ id: FILE_ID, state: "queued", surprise: 1 }, PREFIX)).toBeNull();
    expect(parseAnswer({ id: FILE_ID, state: "queued", pdfA: true }, PREFIX)?.pdfA).toBe(false);
  });

  it("saves a file only when its SHA-256 is the server's", async () => {
    const file = { id: FILE_ID, pdfA: false, downloadPath: `${PREFIX}${FILE_ID}`, sha256: sha };
    const good = await fetchPrepared(async () => ({ ok: true, blob: new Blob([BYTES]) }), file, now());
    expect(good.kind).toBe("downloaded");
    expect((await fetchPrepared(async () => ({ ok: true, blob: new Blob(["tampered"]) }), file, now())).kind).toBe("mismatch");
    expect((await fetchPrepared(async () => ({ ok: false, status: 500 }), file, now())).kind).toBe("failed");
    expect((await fetchPrepared(async () => ({ ok: false, status: 401 }), file, now())).kind).toBe("session-expired");
    expect((await fetchPrepared(async () => { throw new Error("x"); }, file, now())).kind).toBe("failed");
  });

  it("keeps the request key in the contract's shape", () => {
    expect(newRequestKey()).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(() => newRequestKey(() => "short")).toThrow();
  });
});

describe("the two routes' wiring", () => {
  it("names the PDF after the work's title, safely", () => {
    expect(pdfFileName(" Moj/rad: 1. ")).toBe("Moj_rad_ 1.pdf");
    expect(pdfFileName("")).toBe("rad.pdf");
  });

  it("asks for the registrar's package of an assignment", async () => {
    const seen: unknown[] = [];
    const call = async (id: string, input: unknown) => { seen.push([id, input]); return { ok: false as const, status: 0 }; };
    await packageCalls(call as never, "a-1", "key-12345678").start(now());
    expect(seen).toEqual([["student.submission-package.post", { body: { assignmentId: "a-1", requestKey: "key-12345678" } }]]);
    expect(packageDownloadPrefix("a-1")).toBe("/api/v1/student/assignments/a-1/package/");
  });

  it("the screens' texts hold no forbidden term", () => {
    const texts = [...Object.values(pdfExportText), ...Object.values(submissionPackageText)];
    for (const text of texts) expect(findForbiddenTerms(typeof text === "string" ? text : text("abc"))).toEqual([]);
  });

  it("a Phase is one of the known kinds", () => {
    const kinds: Phase["kind"][] = ["idle", "preparing", "ready", "failed", "expired", "cancelled", "session-expired", "unknown"];
    expect(new Set(kinds).size).toBe(8);
  });
});
