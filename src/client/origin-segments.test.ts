import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { createOriginSegmentsPort, isValidSegment, type OriginSegment } from "./origin-segments";

// Invented ids only (no real work or person).
const BASE_URL = "https://ductura.test";
const DOCUMENT = "demo-rad-podrijetlo";
const BLOCK = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";

function serving(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { port: createOriginSegmentsPort(createApi({ baseUrl: BASE_URL, fetchImpl })), fetchImpl };
}

const typed: OriginSegment = { blockId: BLOCK, start: 0, end: 12, kind: "typed" };
const pasted: OriginSegment = { blockId: BLOCK, start: 12, end: 30, kind: "pasted_unknown" };

describe("work.origin-segments.post (PM1-R01)", () => {
  it("posts the revision and its ranges to the work's route and reads the count the server recorded", async () => {
    const { port, fetchImpl } = serving(201, { revision: 7, recorded: 2 });
    await expect(port.record(DOCUMENT, 7, [typed, pasted])).resolves.toEqual({ kind: "recorded", revision: 7, recorded: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/works/${DOCUMENT}/origin-segments`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ revision: 7, segments: [typed, pasted] });
  });

  it("never carries text: only the block id, two offsets and the kind leave the browser", async () => {
    const { port, fetchImpl } = serving(201, { revision: 1, recorded: 1 });
    const withText = { ...typed, text: "Izmišljena rečenica." } as unknown as OriginSegment;
    await port.record(DOCUMENT, 1, [withText]);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)) as { segments: object[] };
    expect(Object.keys(sent.segments[0]!).sort()).toEqual(["blockId", "end", "kind", "start"]);
  });

  it("sends nothing without a valid range (minItems 1), and leaves out ranges the contract refuses", async () => {
    const { port, fetchImpl } = serving(201, { revision: 3, recorded: 1 });
    await expect(port.record(DOCUMENT, 3, [])).resolves.toEqual({ kind: "empty" });
    await expect(port.record(DOCUMENT, 3, [{ ...typed, blockId: "nije-uuid" }, { ...typed, start: 5, end: 5 }])).resolves.toEqual({ kind: "empty" });
    await expect(port.record(DOCUMENT, -1, [typed])).resolves.toEqual({ kind: "empty" });
    expect(fetchImpl).not.toHaveBeenCalled();
    await port.record(DOCUMENT, 3, [{ ...typed, kind: "guessed" as never }, pasted]);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))).toEqual({ revision: 3, segments: [pasted] });
  });

  it.each([
    [409, { code: "conflict" }, "already"],
    [404, { code: "not_found" }, "notFound"],
    [422, { code: "invalid_input" }, "rejected"],
    [401, { code: "unauthorized" }, "signedOut"],
    [503, { code: "unavailable" }, "unavailable"],
  ])("a %i is %s, never recorded", async (status, body, kind) => {
    const { port } = serving(status, body);
    await expect(port.record(DOCUMENT, 2, [typed])).resolves.toEqual({ kind });
  });

  it("an answer outside the contract or no network is unavailable, never a throw", async () => {
    await expect(serving(201, { revision: 2 }).port.record(DOCUMENT, 2, [typed])).resolves.toEqual({ kind: "unavailable" });
    const offline = createOriginSegmentsPort(createApi({ baseUrl: BASE_URL, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) }));
    await expect(offline.record(DOCUMENT, 2, [typed])).resolves.toEqual({ kind: "unavailable" });
  });

  it("makes no client and reads no location until it is called", () => {
    expect(() => createOriginSegmentsPort()).not.toThrow();
  });
});

describe("work.origin-segments.get for the seed", () => {
  it("reads the latest revision and its ranges without the segment refs", async () => {
    const { port, fetchImpl } = serving(200, { revision: 4, segments: [{ ...typed, segmentRef: null }] });
    await expect(port.stored(DOCUMENT)).resolves.toEqual({ kind: "ready", revision: 4, segments: [typed] });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE_URL}/api/v1/works/${DOCUMENT}/origin-segments`);
  });

  it("someone else's work (404) or a failure is unavailable", async () => {
    await expect(serving(404, { code: "not_found" }).port.stored(DOCUMENT)).resolves.toEqual({ kind: "unavailable" });
    await expect(serving(503, { code: "unavailable" }).port.stored(DOCUMENT)).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("isValidSegment", () => {
  it("takes the contract's bounds and nothing past them", () => {
    expect(isValidSegment(typed)).toBe(true);
    expect(isValidSegment({ ...typed, end: 10_000_001 })).toBe(false);
    expect(isValidSegment({ ...typed, start: 1.5 })).toBe(false);
    expect(isValidSegment({ ...typed, blockId: BLOCK.toUpperCase() })).toBe(false);
  });
});
