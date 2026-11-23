import { describe, expect, it } from "vitest";

import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { createApi } from "../../../../../../../src/client/api.ts";
import { bulkFilePath, isBulkHref, type BulkCall } from "./contract";
import { bulkText } from "./messages.hr";
import { requestFailure } from "./model";
import { bulkPort } from "./port";

// PIL-D2-ZIP: the real port over createApi, answered by the contract's own vectors
// (migration-contract-vectors.generated.json), so the shapes are the server's, not local copies.
type Vector = {
  route: string; name: string;
  request: { params: Record<string, string>; query?: Record<string, string>; body?: unknown };
  response: { status: number; contentType?: string; body?: unknown };
};
const all = vectors as unknown as Vector[];
const vector = (route: string, name: string): Vector => {
  const found = all.find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`vector missing: ${route} ${name}`);
  return found;
};
const LINK = "teacher.submissions-bulk-link.post";
const FILE = "teacher.submissions-bulk.get";

function portAnswering(v: Vector) {
  const asked: { method: string; path: string; body: string | null; contentType: string | null }[] = [];
  let expired = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    asked.push({ method: init?.method ?? "GET", path: new URL(String(url)).pathname, body: (init?.body as string | undefined) ?? null, contentType: headers.get("content-type") });
    return new Response(v.response.body === undefined ? null : JSON.stringify(v.response.body), {
      status: v.response.status, headers: { "content-type": v.response.contentType ?? "application/json" },
    });
  };
  const call = createApi({ baseUrl: "http://ductura.test", fetchImpl }) as unknown as BulkCall;
  return { port: bulkPort(call, () => { expired += 1; }), asked, expired: () => expired };
}

describe("bulk download port over the contract (PIL-D2-ZIP)", () => {
  it("asks teacher.submissions-bulk-link.post once and gets a link to teacher.submissions-bulk.get, never the file", async () => {
    for (const name of ["pdf-link", "docx-link"]) {
      const v = vector(LINK, name);
      const assignmentId = v.request.params.assignmentId ?? "";
      const format = (v.request.body as { format: "pdf" | "docx" }).format;
      const { port, asked } = portAnswering(v);
      const outcome = await port.requestLink(assignmentId, format);
      expect(asked).toEqual([{
        method: "POST", path: `/api/v1/teacher/assignments/${assignmentId}/submissions-bulk-link`,
        body: JSON.stringify({ format }), contentType: "application/json",
      }]);
      if (outcome.kind !== "poveznica") throw new Error(outcome.kind);
      // The link is exactly the file route of the contract with the token its vector reads.
      const file = vector(FILE, `zip-${format}`);
      expect(file.request.params).toEqual({ assignmentId, format });
      expect(outcome.link.href).toBe(`${bulkFilePath(assignmentId, format)}?token=${file.request.query?.token}`);
      expect(isBulkHref(outcome.link.href, assignmentId, format)).toBe(true);
      expect(outcome.link.expiresAt).toBe((v.response.body as { expiresAt: string }).expiresAt);
    }
  });

  it("an ended session signs in again, once", async () => {
    const v = vector(LINK, "unauthorized");
    const { port, expired } = portAnswering(v);
    expect(await port.requestLink(v.request.params.assignmentId ?? "", "pdf")).toEqual({ kind: "session-expired" });
    expect(expired()).toBe(1);
  });

  it("a refusal, a missing assignment and an unavailable server give a calm note, never a link", async () => {
    const cases: [string, string][] = [
      ["origin-missing", bulkText.forbidden], ["cross-site", bulkText.forbidden],
      ["not-found", bulkText.notFound], ["unavailable", bulkText.requestUnknown],
    ];
    for (const [name, note] of cases) {
      const v = vector(LINK, name);
      const { port, expired } = portAnswering(v);
      const outcome = await port.requestLink(v.request.params.assignmentId ?? "", "pdf");
      expect({ name, link: outcome.kind === "poveznica", note: requestFailure(outcome) }).toEqual({ name, link: false, note });
      expect(expired()).toBe(0);
    }
  });

  it("the file route answers expiry with 410 and a refusal with 403, which the screen never shows as a link", () => {
    expect(vector(FILE, "expired-link").response.status).toBe(410);
    expect(vector(FILE, "cross-site").response.status).toBe(403);
    expect(bulkText.expired).toContain("istekla");
  });
});
