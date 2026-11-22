import { describe, expect, it } from "vitest";

import { REVISION_ZERO_JCS, REVISION_ZERO_SHA256 } from "../../../../../editor-core/src/document/document/revision-zero";
import { readVersionedDocument } from "./reader";

const ID = "izmisljeni-rad-1";
const reply = (status: number, body: string | null = null, etag?: string) => {
  const sent = body ?? (status >= 400 ? JSON.stringify({ error: "invented" }) : null);
  return (async () => new Response(sent, {
    status,
    headers: { ...(sent === null ? {} : { "content-type": "application/json" }), ...(etag === undefined ? {} : { etag: `"${etag}"` }) },
  })) as unknown as typeof fetch;
};
const read = (f: typeof fetch) => readVersionedDocument(ID, f, "https://ductura.test");

describe("readVersionedDocument", () => {
  it.each([[204, "empty"], [401, "signedOut"], [404, "notFound"], [403, "unavailable"], [500, "unavailable"]])("maps %i", async (status, kind) => {
    expect(await read(reply(status))).toEqual({ kind });
  });
  it("accepts exact JCS whose hash is the ETag", async () => {
    expect(await read(reply(200, REVISION_ZERO_JCS, REVISION_ZERO_SHA256))).toMatchObject({ kind: "document" });
  });
  it("refuses bytes whose hash is not the ETag", async () => {
    expect(await read(reply(200, REVISION_ZERO_JCS, "0".repeat(64)))).toEqual({ kind: "unavailable" });
  });
  it("is unavailable when the transport throws", async () => {
    expect(await read((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ kind: "unavailable" });
  });
});
