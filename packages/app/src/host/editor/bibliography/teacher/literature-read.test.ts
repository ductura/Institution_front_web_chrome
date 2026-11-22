import { describe, expect, it } from "vitest";

import { readWorkLiterature } from "./literature-read";
import { DOC } from "./literature-fixture";

type Answer = { ok: boolean; status: number; body?: unknown };
function fake(answers: Record<string, Answer>, seen: unknown[] = []) {
  return (async (id: string, input: unknown) => {
    seen.push([id, input]);
    const answer = answers[id];
    if (!answer) throw new Error(`unexpected ${id}`);
    return answer;
  }) as unknown as Parameters<typeof readWorkLiterature>[1];
}

const VERSIONS = { ok: true, status: 200, body: { versions: [
  { kind: "checkpoint", revision: 7, savedMinute: "2026-11-21T10:00:00.000Z" },
  { kind: "submission", revision: 9, savedMinute: "2026-11-22T10:00:00.000Z", afterDeadline: false },
], nextBeforeRevision: null } };

describe("readWorkLiterature", () => {
  it("reads the newest saved version and its literature", async () => {
    const seen: unknown[] = [];
    const read = await readWorkLiterature("w1", fake({
      "work.versions.get": VERSIONS,
      "work.version.get": { ok: true, status: 200, body: { revision: 9, document: JSON.stringify(DOC) } },
    }, seen));
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect([read.revision, read.savedMinute, read.literature.sources.length]).toEqual([9, "2026-11-22T10:00:00.000Z", 3]);
    expect(seen[1]).toEqual(["work.version.get", { params: { documentId: "w1", revision: "9" }, query: {}, body: undefined }]);
  });
  it("says when there is no saved version yet", async () => {
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": { ok: true, status: 200, body: { versions: [], nextBeforeRevision: null } } })))
      .toEqual({ kind: "noVersion" });
  });
  it("maps 401 to signedOut and other failures to unavailable", async () => {
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": { ok: false, status: 401 } }))).toEqual({ kind: "signedOut" });
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": { ok: false, status: 503 } }))).toEqual({ kind: "unavailable" });
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": VERSIONS, "work.version.get": { ok: false, status: 401 } })))
      .toEqual({ kind: "signedOut" });
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": VERSIONS, "work.version.get": { ok: true, status: 200, body: { from: 1, to: 2, blocks: [] } } })))
      .toEqual({ kind: "unavailable" });
    expect(await readWorkLiterature("w1", fake({ "work.versions.get": VERSIONS, "work.version.get": { ok: true, status: 200, body: { revision: 9, document: "{" } } })))
      .toEqual({ kind: "unavailable" });
    expect(await readWorkLiterature("w1", fake({}))).toEqual({ kind: "unavailable" });
  });
});
