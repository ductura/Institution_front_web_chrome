import { describe, expect, it } from "vitest";

import {
  draftFits, imagePathFits, listProofs, looksLikeJpeg, normalPage, PROOF_IMAGE_MAX_BYTES, proofsPath, readProofImage, uploadProof,
  type SourceProof,
} from "./source-proofs";

// Invented identifiers only.
const A = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";
const BASE = "https://ductura.invalid";
const ROUTE = `/api/v1/student/assignments/${A}/sources/${S}/proofs`;
const PROOF: SourceProof = {
  id: P, sourceId: S, page: "14", note: null, createdAt: "2026-11-20T10:00:00.000Z", size: 1234, imagePath: `${ROUTE}/${P}/image`,
};
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

type Call = { url: string; init: RequestInit | undefined };
function recorder(answer: () => Response) {
  const calls: Call[] = [];
  const transport = (async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer();
  }) as typeof fetch;
  return { calls, transport };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const jpeg = (bytes: Uint8Array<ArrayBuffer> = JPEG_BYTES) => new Blob([bytes], { type: "image/jpeg" });

describe("proofsPath and imagePathFits", () => {
  it("builds the route under /api/v1 only for UUIDs", () => {
    expect(proofsPath(A, S)).toBe(ROUTE);
    expect(proofsPath("rad-1", S)).toBeNull();
    expect(proofsPath(A, "../x")).toBeNull();
  });
  it("reads an image only under this proof's own route", () => {
    expect(imagePathFits(`${ROUTE}/${P}/image`, A, S)).toBe(true);
    expect(imagePathFits(`${ROUTE}/${P}/../../other`, A, S)).toBe(false);
    expect(imagePathFits(`${ROUTE}/${P}/image?x=1`, A, S)).toBe(false);
    expect(imagePathFits(`https://drugi.invalid${ROUTE}/${P}`, A, S)).toBe(false);
    expect(imagePathFits(`/api/v1/student/assignments/${A}/sources/${P}/proofs/${P}`, A, S)).toBe(false);
    expect(imagePathFits(`${ROUTE}//image`, A, S)).toBe(false);
  });
});

describe("listProofs", () => {
  it("GETs the route with no body and returns the proofs", async () => {
    const { calls, transport } = recorder(() => json(200, { proofs: [PROOF] }));
    expect(await listProofs(A, S, { baseUrl: BASE, transport })).toEqual({ kind: "ok", proofs: [PROOF] });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE}${ROUTE}`);
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.body).toBeUndefined();
    expect(calls[0]?.init?.credentials).toBe("include");
  });
  it("refuses an unknown field, another source or a foreign image path", async () => {
    for (const proof of [{ ...PROOF, extra: 1 }, { ...PROOF, sourceId: P }, { ...PROOF, imagePath: "/drugo" }, { ...PROOF, createdAt: "jučer" }]) {
      const { transport } = recorder(() => json(200, { proofs: [proof] }));
      expect(await listProofs(A, S, { baseUrl: BASE, transport })).toEqual({ kind: "nepoznato" });
    }
  });
  it("maps refusals and a broken connection", async () => {
    expect(await listProofs(A, S, { baseUrl: BASE, transport: recorder(() => json(401, {})).transport })).toEqual({ kind: "session-expired" });
    expect(await listProofs(A, S, { baseUrl: BASE, transport: recorder(() => json(404, {})).transport })).toEqual({ kind: "greska", code: "not_found" });
    expect(await listProofs(A, S, { baseUrl: BASE, transport: recorder(() => new Response("x", { status: 200 })).transport })).toEqual({ kind: "nepoznato" });
    const broken = (async () => { throw new TypeError("mreža"); }) as typeof fetch;
    expect(await listProofs(A, S, { baseUrl: BASE, transport: broken })).toEqual({ kind: "nepoznato" });
  });
  it("makes no request for an id that is not a UUID", async () => {
    const { calls, transport } = recorder(() => json(200, { proofs: [] }));
    expect(await listProofs("x", S, { baseUrl: BASE, transport })).toEqual({ kind: "greska", code: "not_found" });
    expect(calls).toHaveLength(0);
  });
});

describe("uploadProof", () => {
  it("sends exactly image, page and note as multipart and nothing else", async () => {
    const { calls, transport } = recorder(() => json(201, { ...PROOF, note: "uvod" }));
    const result = await uploadProof(A, S, { image: jpeg(), page: "  14 ", note: " uvod " }, { baseUrl: BASE, transport });
    expect(result).toEqual({ kind: "ok", proof: { ...PROOF, note: "uvod" } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init?.method).toBe("POST");
    const form = calls[0]?.init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()]).toEqual(["image", "page", "note"]);
    expect(form.get("page")).toBe("14");
    expect(form.get("note")).toBe("uvod");
    const image = form.get("image") as File;
    expect(image.type).toBe("image/jpeg");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(JPEG_BYTES);
    // The browser sets the multipart boundary itself.
    expect(Object.keys((calls[0]?.init?.headers ?? {}) as object)).toEqual(["accept"]);
  });
  it("leaves out an empty note", async () => {
    const { calls, transport } = recorder(() => json(201, PROOF));
    await uploadProof(A, S, { image: jpeg(), page: "14", note: "   " }, { baseUrl: BASE, transport });
    expect([...(calls[0]?.init?.body as FormData).keys()]).toEqual(["image", "page"]);
  });
  it("sends nothing for a draft that does not fit", async () => {
    const { calls, transport } = recorder(() => json(201, PROOF));
    const drafts = [
      { image: new Blob([JPEG_BYTES], { type: "image/png" }), page: "14" },
      { image: jpeg(new Uint8Array(0)), page: "14" },
      { image: jpeg(new Uint8Array(PROOF_IMAGE_MAX_BYTES + 1)), page: "14" },
      { image: jpeg(), page: "  " },
      { image: jpeg(), page: "1".repeat(21) },
      { image: jpeg(), page: "14", note: "x".repeat(501) },
    ];
    for (const draft of drafts) expect(await uploadProof(A, S, draft, { baseUrl: BASE, transport })).toEqual({ kind: "odbijeno" });
    expect(calls).toHaveLength(0);
  });
  it("is a success only on 201 with a proof of this source", async () => {
    const answers: [Response, unknown][] = [
      [json(200, PROOF), { kind: "nepoznato" }],
      [json(201, { ...PROOF, sourceId: P }), { kind: "nepoznato" }],
      [json(413, {}), { kind: "greska", code: "too_large" }],
      [json(422, {}), { kind: "greska", code: "invalid" }],
      [json(403, {}), { kind: "greska", code: "forbidden" }],
      [json(503, {}), { kind: "nepoznato" }],
    ];
    for (const [res, expected] of answers) {
      expect(await uploadProof(A, S, { image: jpeg(), page: "14" }, { baseUrl: BASE, transport: recorder(() => res).transport })).toEqual(expected);
    }
  });
});

describe("readProofImage", () => {
  it("GETs the image path with no body and returns a JPEG", async () => {
    const { calls, transport } = recorder(() => new Response(JPEG_BYTES, { status: 200, headers: { "content-type": "image/jpeg" } }));
    const result = await readProofImage(PROOF, A, S, { baseUrl: BASE, transport });
    expect(result.kind).toBe("ok");
    expect(calls[0]?.url).toBe(`${BASE}${PROOF.imagePath}`);
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.body).toBeUndefined();
    if (result.kind === "ok") expect(result.image.type).toBe("image/jpeg");
  });
  it("refuses another type, bytes that are not a JPEG and a foreign path", async () => {
    const png = recorder(() => new Response(JPEG_BYTES, { status: 200, headers: { "content-type": "image/png" } }));
    expect(await readProofImage(PROOF, A, S, { baseUrl: BASE, transport: png.transport })).toEqual({ kind: "nepoznato" });
    const html = recorder(() => new Response("<html>", { status: 200, headers: { "content-type": "image/jpeg" } }));
    expect(await readProofImage(PROOF, A, S, { baseUrl: BASE, transport: html.transport })).toEqual({ kind: "nepoznato" });
    const foreign = recorder(() => new Response(JPEG_BYTES, { status: 200, headers: { "content-type": "image/jpeg" } }));
    expect(await readProofImage({ imagePath: "https://drugi.invalid/x" }, A, S, { baseUrl: BASE, transport: foreign.transport }))
      .toEqual({ kind: "greska", code: "not_found" });
    expect(foreign.calls).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("normalises a page and checks a draft", () => {
    expect(normalPage("  str.\t 14 ")).toBe("str. 14");
    expect(draftFits({ image: jpeg(), page: "14" })).toBe(true);
    expect(looksLikeJpeg(JPEG_BYTES)).toBe(true);
    expect(looksLikeJpeg(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false);
  });
});
