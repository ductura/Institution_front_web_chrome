import { describe, expect, it } from "vitest";

import { createApi } from "./api";
import { postViaApi, readAttachment, toBase64 } from "./work-attachments";
import { sha256Hex, uploadImage } from "../components/editor/rich/table-image/attachment";

// F4-PM1-R03. Invented data only.
const ASSIGNMENT = "11111111-1111-4111-8111-111111111111";
const ATT = "33333333-3333-4333-8333-333333333333";
const BYTES = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function stored(over: Record<string, unknown> = {}) {
  return { attachmentId: ATT, attachmentSha256: await sha256Hex(BYTES), mediaType: "image/png", byteSize: BYTES.length, pixelWidth: null, pixelHeight: null, created: true, ...over };
}

describe("work attachments through createApi (F4-PM1-R03)", () => {
  it("uploads to the assignment route with the bytes as base64", async () => {
    const seen: { url: string; method: string | undefined; body: unknown }[] = [];
    const api = createApi({ baseUrl: "https://x.test", fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) });
      return json(200, await stored());
    }) as typeof fetch });
    const result = await uploadImage(new Blob([BYTES], { type: "image/png" }), postViaApi(api, ASSIGNMENT));
    expect(result).toEqual({ ok: true, value: { attachmentId: ATT, attachmentSha256: await sha256Hex(BYTES) } });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(`https://x.test/api/v1/student/assignments/${ASSIGNMENT}/attachments`);
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.body).toEqual({ imageBase64: toBase64(BYTES) });
  });

  it("says 'send' for a refusal, a different hash or type, and a bad assignment id (nothing sent)", async () => {
    const file = new Blob([BYTES], { type: "image/png" });
    const refuse = createApi({ baseUrl: "https://x.test", fetchImpl: (async () => json(404, { error: { code: "not_found" } })) as typeof fetch });
    expect(await uploadImage(file, postViaApi(refuse, ASSIGNMENT))).toEqual({ ok: false, reason: "send" });
    for (const over of [{ attachmentSha256: "a".repeat(64) }, { mediaType: "image/jpeg" }]) {
      const api = createApi({ baseUrl: "https://x.test", fetchImpl: (async () => json(200, await stored(over))) as typeof fetch });
      expect(await uploadImage(file, postViaApi(api, ASSIGNMENT))).toEqual({ ok: false, reason: "send" });
    }
    let calls = 0;
    const api = createApi({ baseUrl: "https://x.test", fetchImpl: (async () => { calls++; return json(200, await stored()); }) as typeof fetch });
    expect(await uploadImage(file, postViaApi(api, "not-an-id"))).toEqual({ ok: false, reason: "send" });
    expect(calls).toBe(0);
  });

  it("reads one image for display; 404 of another's image is notFound, 401 signedOut", async () => {
    const { created: _created, ...head } = await stored();
    const body = { ...head, imageBase64: toBase64(BYTES) };
    const ok = createApi({ baseUrl: "https://x.test", fetchImpl: (async (url: RequestInfo | URL) => { expect(String(url)).toBe(`https://x.test/api/v1/work-attachments/${ATT}`); return json(200, body); }) as typeof fetch });
    expect(await readAttachment(ok, ATT)).toMatchObject({ kind: "ready", bytes: BYTES, mediaType: "image/png" });
    const other = createApi({ baseUrl: "https://x.test", fetchImpl: (async () => json(200, { ...body, attachmentId: "44444444-4444-4444-8444-444444444444" })) as typeof fetch });
    expect(await readAttachment(other, ATT)).toEqual({ kind: "unavailable" });
    for (const [status, kind] of [[404, "notFound"], [401, "signedOut"], [503, "unavailable"]] as const) {
      const api = createApi({ baseUrl: "https://x.test", fetchImpl: (async () => json(status, { error: { code: "x" } })) as typeof fetch });
      expect((await readAttachment(api, ATT)).kind).toBe(kind);
    }
    expect(await readAttachment(ok, "bad")).toEqual({ kind: "unavailable" });
  });
});
