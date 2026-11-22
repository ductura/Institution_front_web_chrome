import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api.ts";
import { fakeChangesPort, FAKE_BLOCKS } from "./fake-port";
import { changeItems, markWorkReviewed, type ChangeBlock, type ChangesPort } from "./model";
import { changesPortFor, markChangesReviewed, readChanges } from "./port";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const BASE = "https://ductura.invalid";

function serverCall(status: number, body: unknown, seen: string[] = []) {
  return createApi({
    baseUrl: BASE,
    fetchImpl: async (input, init) => {
      seen.push(`${init?.method ?? "GET"} ${String(input)}`);
      return Response.json(body, { status });
    },
  });
}

// Deliberately not in document order, with repeated text: the list must keep the server's order and every block.
const SERVER_BLOCKS: readonly ChangeBlock[] = [
  { kind: "paragraph", text: "Izmišljeni odlomak B.", change: "added" },
  { kind: "heading", level: 2, text: "Izmišljeni podnaslov", change: "unchanged" },
  { kind: "paragraph", text: "Izmišljeni odlomak B.", change: "removed" },
  { kind: "quote", text: "Izmišljeni navod.", change: "unchanged" },
  { kind: "paragraph", text: "Izmišljeni odlomak A.", change: "added" },
];

describe("changes since the last review (WEB-1704)", () => {
  it("shows the blocks in the server's order, inventing and dropping none", async () => {
    const seen: string[] = [];
    const read = await readChanges(ID, serverCall(200, { reviewedRevision: 3, currentRevision: 6, changed: true, blocks: SERVER_BLOCKS }, seen));
    expect(seen).toEqual([`GET ${BASE}/api/v1/works/${ID}/changes-since-review`]);
    if (read.kind !== "ready") throw new Error("expected ready");
    const items = changeItems(read.snapshot);
    expect(items.map((i) => [i.change, i.text])).toEqual(SERVER_BLOCKS.map((b) => [b.change, b.text]));
    expect(items.map((i) => i.label)).toEqual(["Dodano", "Bez promjene", "Uklonjeno", "Bez promjene", "Dodano"]);
    expect(new Set(items.map((i) => i.key)).size).toBe(SERVER_BLOCKS.length);
  });

  it("maps a refused or broken read without making changes up", async () => {
    expect(await readChanges(ID, serverCall(401, { error: "unauthorized" }))).toEqual({ kind: "signedOut" });
    expect(await readChanges(ID, serverCall(404, { error: "not_found" }))).toEqual({ kind: "unavailable" });
    expect(await readChanges(ID, serverCall(503, { error: "unavailable" }))).toEqual({ kind: "unavailable" });
    // A body outside the contract is not shown.
    expect(await readChanges(ID, serverCall(200, { reviewedRevision: 1, currentRevision: 2, changed: true, blocks: [{ kind: "x", text: "y", change: "added" }] })))
      .toEqual({ kind: "unavailable" });
  });

  it("counts a work as reviewed only when the server confirmed it", async () => {
    const seen: string[] = [];
    expect(await markChangesReviewed(ID, serverCall(200, { reviewedRevision: 6, reviewedAt: "2026-11-21T10:00:00.000Z" }, seen)))
      .toEqual({ kind: "marked", reviewedRevision: 6, reviewedAt: "2026-11-21T10:00:00.000Z" });
    expect(seen).toEqual([`POST ${BASE}/api/v1/works/${ID}/review`]);
    expect(await markChangesReviewed(ID, serverCall(409, { error: "conflict" }))).toEqual({ kind: "rejected" });
    expect(await markChangesReviewed(ID, serverCall(401, { error: "unauthorized" }))).toEqual({ kind: "signedOut" });
    expect(await markChangesReviewed(ID, serverCall(503, { error: "unavailable" }))).toEqual({ kind: "unknown" });
    expect(await markChangesReviewed(ID, serverCall(200, { reviewedRevision: 6 }))).toEqual({ kind: "unknown" });

    const throwing: ChangesPort = { read: async () => ({ kind: "unavailable" }), markReviewed: async () => { throw new Error("x"); } };
    expect(await markWorkReviewed(throwing, ID)).toEqual({ kind: "unknown" });
    const bad: ChangesPort = { ...throwing, markReviewed: async () => ({ kind: "marked", reviewedRevision: 2, reviewedAt: "nije vrijeme" }) };
    expect(await markWorkReviewed(bad, ID)).toEqual({ kind: "unknown" });
  });

  it("offers marking only when the contract has the review route", () => {
    expect(changesPortFor(() => serverCall(200, {}), () => true).markReviewed).toBeTypeOf("function");
    expect(changesPortFor(() => serverCall(200, {}), () => false).markReviewed).toBeUndefined();
    expect(changesPortFor().markReviewed).toBeTypeOf("function");
  });

  it("the fake port answers in the same shapes (tests only)", async () => {
    const port = fakeChangesPort();
    const first = await port.read(ID);
    if (first.kind !== "ready") throw new Error("expected ready");
    expect(first.snapshot.blocks).toEqual(FAKE_BLOCKS);
    expect((await markWorkReviewed(port, ID)).kind).toBe("marked");
    const after = await port.read(ID);
    expect(after.kind === "ready" && after.snapshot.changed).toBe(false);
  });
});
