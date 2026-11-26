import { describe, expect, it } from "vitest";

import { exportFileName, exportPath, MIME, requestSlidesExport, type Transport } from "./export-model.ts";

const SHA = "ab".repeat(32);
const DOC = "00000000-0000-4000-8000-0000000000d1";

type Seen = { url: string; init: RequestInit | undefined };
function answering(make: () => Response) {
  const seen: Seen[] = [];
  const request: Transport = async (url, init) => { seen.push({ url: String(url), init }); return make(); };
  return { request, seen };
}
const file = (format: "pptx" | "pdf", headers: Record<string, string> = {}, body: BlobPart = "invented bytes") =>
  new Response(body, { status: 200, headers: { "content-type": MIME[format], "x-export-snapshot-sha256": SHA, ...headers } });

describe("requestSlidesExport (WEB-V13-IZVOZ)", () => {
  it("asks one GET with the format and the version, and keeps the digest of the snapshot", async () => {
    const { request, seen } = answering(() => file("pptx"));
    const result = await requestSlidesExport(DOC, "pptx", "7", { request });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(`/api/v1/works/${DOC}/export-slides?format=pptx&versionId=7`);
    expect(seen[0]!.init).toMatchObject({ method: "GET", credentials: "same-origin", redirect: "error" });
    expect(result).toMatchObject({ kind: "ready", format: "pptx", snapshotSha256: SHA });
  });

  it("leaves versionId out when the server's last revision is wanted", () => {
    expect(exportPath(DOC, "pdf", null)).toBe(`/api/v1/works/${DOC}/export-slides?format=pdf`);
  });

  it.each([[401, "signed-out"], [404, "not-found"], [422, "invalid"], [503, "failed"], [500, "failed"]] as const)(
    "status %i is %s, never a file", async (status, kind) => {
      const { request } = answering(() => new Response("{}", { status }));
      expect((await requestSlidesExport(DOC, "pdf", null, { request })).kind).toBe(kind);
    });

  it("refuses a 200 with a wrong type, no digest, a malformed digest or no bytes", async () => {
    for (const make of [
      () => file("pdf", { "content-type": "text/html" }),
      () => file("pdf", { "x-export-snapshot-sha256": "" }),
      () => file("pdf", { "x-export-snapshot-sha256": "xyz" }),
      () => file("pdf", {}, ""),
      () => file("pptx"), // a .pptx where a PDF was asked for
    ]) {
      const { request } = answering(make);
      expect((await requestSlidesExport(DOC, "pdf", null, { request })).kind).toBe("mismatch");
    }
  });

  it("rejects a bad id or version without any request", async () => {
    const { request, seen } = answering(() => file("pdf"));
    expect((await requestSlidesExport("", "pdf", null, { request })).kind).toBe("invalid");
    expect((await requestSlidesExport(DOC, "pdf", "0", { request })).kind).toBe("invalid");
    expect((await requestSlidesExport(DOC, "pdf", "1; drop", { request })).kind).toBe("invalid");
    expect(seen).toHaveLength(0);
  });

  it("an answer that never comes is expired; the caller's own abort is not", async () => {
    const hang: Transport = (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))));
    expect((await requestSlidesExport(DOC, "pdf", null, { request: hang, timeoutMs: 5 })).kind).toBe("expired");
    const own = new AbortController();
    const pending = requestSlidesExport(DOC, "pdf", null, { request: hang, signal: own.signal, timeoutMs: 60_000 });
    own.abort();
    expect((await pending).kind).toBe("failed");
  });

  it("a dropped connection is a failure", async () => {
    const request: Transport = async () => { throw new TypeError("network"); };
    expect((await requestSlidesExport(DOC, "pdf", null, { request })).kind).toBe("failed");
  });
});

describe("exportFileName", () => {
  it("takes the title, keeps the format as extension and strips what a file system refuses", () => {
    expect(exportFileName("Sustav: ocjene/2026 ", "pptx")).toBe("Sustav_ ocjene_2026.pptx");
    expect(exportFileName("  ", "pdf")).toBe("slajdovi.pdf");
    expect(exportFileName(null, "pdf")).toBe("slajdovi.pdf");
  });
});
