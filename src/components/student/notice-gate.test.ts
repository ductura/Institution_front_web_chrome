import { fc, test } from "@fast-check/vitest";
import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";

import { NOTICE_TEMPLATE_VERSION, noticeFingerprint } from "./obavijest/notice-fingerprint";

import { acknowledgeNotice, initialNotice, mayRecord, noticeStep, type ShownNotice } from "./notice-gate";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AT = "2026-11-02T09:14:00.000Z";

// Invented notice; only its fields matter.
const NOTICE: ShownNotice = {
  assignmentId: ID,
  versionNo: 3,
  title: "Izmišljeni zadatak",
  instructions: "Upute za izmišljeni zadatak.",
  workType: "essay",
  opensAt: "2026-11-02T08:00:00.000Z",
  dueAt: "2026-11-30T22:59:00.000Z",
  aiPolicy: "partially_allowed",
  aiPurposes: ["translation", "proofreading"],
  evidenceProfile: "basic",
  wordMin: 2000,
  wordMax: 2500,
};

const expected = (notice: ShownNotice) => noticeFingerprint({ ...notice, templateVersion: NOTICE_TEMPLATE_VERSION });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** createApi over a recording transport, as the browser would call it from web.test. */
function wire(reply: () => Response | Promise<Response>) {
  const send = vi.fn(async (_url: URL | string, _init?: RequestInit) => reply());
  return { send, api: createApi({ baseUrl: "http://web.test", fetchImpl: send as unknown as typeof fetch }) };
}

function sentBody(send: ReturnType<typeof wire>["send"], call = 0): unknown {
  return JSON.parse(send.mock.calls[call]![1]!.body as string);
}

describe("F-7 notice gate", () => {
  it("sends nothing before the box is ticked and confirmed", () => {
    const start = initialNotice(null);
    expect(noticeStep(start, { type: "confirm" })).toEqual({ state: start, send: false });
    const ticked = noticeStep(start, { type: "toggle" });
    expect(ticked.send).toBe(false);
    expect(noticeStep(ticked.state, { type: "confirm" })).toEqual({ state: { phase: "sending" }, send: true });
    expect(mayRecord(start)).toBe(false);
    expect(mayRecord(ticked.state)).toBe(false);
  });

  it("records only after the server time, and keeps the box ticked after a failure", () => {
    const sending = { phase: "sending" } as const;
    expect(mayRecord(sending)).toBe(false);
    const done = noticeStep(sending, { type: "settled", result: { kind: "acknowledged", at: AT } }).state;
    expect(done).toEqual({ phase: "acknowledged", at: AT });
    expect(mayRecord(done)).toBe(true);
    expect(noticeStep(sending, { type: "settled", result: { kind: "stale" } }).state)
      .toEqual({ phase: "reading", checked: true, error: "stale" });
  });

  it("starts acknowledged when the server already holds this version's acknowledgment", () => {
    expect(initialNotice(AT)).toEqual({ phase: "acknowledged", at: AT });
  });
});

describe("WEB-12 acknowledgment over institution.acknowledgment.post", () => {
  it("posts the version and the fingerprint of the shown notice to the contract route", async () => {
    const { send, api } = wire(() => json({ acknowledgedAt: AT }));
    expect(await acknowledgeNotice(NOTICE, api)).toEqual({ kind: "acknowledged", at: AT });
    const [url, options] = send.mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe(`/api/v1/institution/assignments/${ID}/acknowledgment`);
    expect(options).toMatchObject({ method: "POST" });
    expect(sentBody(send)).toEqual({ versionNo: 3, fingerprint: await expected(NOTICE) });
  });

  it("sends a different fingerprint for any other shown text, and none of the view's other fields", async () => {
    const { send, api } = wire(() => json({ acknowledgedAt: AT }));
    const shown = { ...NOTICE, acknowledgedAt: null, extra: "x" } as ShownNotice;
    await acknowledgeNotice(shown, api);
    await acknowledgeNotice({ ...NOTICE, instructions: `${NOTICE.instructions} ` }, api);
    const same = sentBody(send, 0) as { fingerprint: string };
    const changed = sentBody(send, 1) as { fingerprint: string };
    expect(same).toEqual({ versionNo: 3, fingerprint: await expected(NOTICE) });
    expect(changed.fingerprint).not.toBe(same.fingerprint);
  });

  it("sends nothing when the fingerprint cannot be computed", async () => {
    const { send, api } = wire(() => json({ acknowledgedAt: AT }));
    const subtle = vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValueOnce(new Error("no Web Crypto"));
    expect(await acknowledgeNotice(NOTICE, api)).toEqual({ kind: "unavailable" });
    expect(await acknowledgeNotice({ ...NOTICE, dueAt: "jučer" }, api)).toEqual({ kind: "unavailable" });
    expect(send).not.toHaveBeenCalled();
    subtle.mockRestore();
  });

  it("calls nothing with a malformed id or version", async () => {
    const { send, api } = wire(() => json({ acknowledgedAt: AT }));
    for (const [id, version] of [["x", 1], [ID, 0], [ID, 1.5], [ID, Number.NaN]] as const) {
      expect(await acknowledgeNotice({ ...NOTICE, assignmentId: id, versionNo: version }, api)).toEqual({ kind: "invalid" });
    }
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    [401, "unauthorized", "unauthorized"],
    [403, "forbidden", "forbidden"],
    [403, "forbidden", "origin_mismatch"],
    [404, "unavailable", "not_found"],
    [409, "stale", "conflict"],
    [409, "stale", "notice_changed"],
    [400, "invalid", "invalid_json"],
    [422, "invalid", "invalid_input"],
    [503, "unavailable", "unavailable"],
  ] as const)("keeps HTTP %i as the local %s state", async (status, kind, error) => {
    const { api } = wire(() => json({ error }, status));
    expect(await acknowledgeNotice(NOTICE, api)).toEqual({ kind });
  });

  it.each([[{}], [{ acknowledgedAt: "jučer" }], [{ acknowledgedAt: 1 }], [[AT]], [null], [{ acknowledgedAt: AT, extra: 1 }],
    [{ acknowledgedAt: "2026-02-31T09:00:00.000Z" }], [{ acknowledgedAt: "2026-11-03T24:00:00.000Z" }]])(
    "never claims an acknowledgment on a reply the contract or the calendar refuses: %o",
    async (body) => {
      const { api } = wire(() => json(body));
      expect(await acknowledgeNotice(NOTICE, api)).toEqual({ kind: "unavailable" });
    },
  );

  it("treats a transport failure as unavailable", async () => {
    const { api } = wire(() => { throw new Error("offline"); });
    expect(await acknowledgeNotice(NOTICE, api)).toEqual({ kind: "unavailable" });
  });
});

// DAN-306 #1502 B1: whatever the notice holds, the body is exactly the
// version and the fingerprint of those fields, as the route requires.
test.prop([
  fc.record({
    title: fc.string(), instructions: fc.string(), workType: fc.string(),
    aiPolicy: fc.constantFrom("prohibited", "partially_allowed", "encouraged"),
    aiPurposes: fc.subarray(["formatting", "proofreading", "literature_search", "transcription", "translation"]),
    evidenceProfile: fc.constantFrom("basic", "extended"),
    wordMin: fc.option(fc.nat()), wordMax: fc.option(fc.nat()),
    versionNo: fc.integer({ min: 1, max: 2_147_483_647 }),
  }),
])("B1: the body is the version and the fingerprint of the shown fields, nothing else", async (fields) => {
  const notice = { ...NOTICE, ...fields };
  const { send, api } = wire(() => json({ acknowledgedAt: AT }));
  await acknowledgeNotice(notice, api);
  expect(sentBody(send)).toEqual({ versionNo: fields.versionNo, fingerprint: await expected(notice) });
});
