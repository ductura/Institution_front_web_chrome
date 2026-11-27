import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { attachedCount, attachedRefs, conversationRef, messagesSha256, readSecond, withRef } from "./declaration-attachments";

// F4-PRE-R02. Invented data only. The expected hashes are computed here with node:crypto from the text the
// server hashes (db/main/migrations/20261220360000_teacher_declaration_conversation.sql:70-77).
const H = (c: string) => c.repeat(64);
const node = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const REF = { conversationId: "c1", throughSeq: 2, messagesSha256: H("e") };

describe("declaration attachments (F4-PRE-R02)", () => {
  it("hashes the messages as the server does: sha256 of [\"h1\",\"h2\"] with no spaces", async () => {
    expect(await messagesSha256([H("a"), H("b")])).toBe(node(`["${H("a")}","${H("b")}"]`));
    expect(await messagesSha256([H("a")])).toBe(node(`["${H("a")}"]`));
  });

  it("makes a ref of the whole conversation, and none from a gap or a bad hash", async () => {
    const ref = await conversationRef("c1", [{ seq: 2, contentSha256: H("b") }, { seq: 1, contentSha256: H("a") }]);
    expect(ref).toEqual({ conversationId: "c1", throughSeq: 2, messagesSha256: node(`["${H("a")}","${H("b")}"]`) });
    expect(await conversationRef("c1", [{ seq: 1, contentSha256: H("a") }, { seq: 3, contentSha256: H("b") }])).toBeNull();
    expect(await conversationRef("c1", [{ seq: 1, contentSha256: "A".repeat(64) }])).toBeNull();
    expect(await conversationRef("c1", [])).toBeNull();
  });

  it("reads the refs and the count; an answer off the shape is not 'none attached'", () => {
    const draft = { state: "draft", draft: { ai: { attachments: [REF] } }, payload: null };
    expect(attachedRefs(draft)).toEqual([REF]);
    expect(attachedCount(draft)).toBe(1);
    expect(attachedRefs({ state: "draft", draft: null, payload: null })).toEqual([]);
    const confirmed = { state: "confirmed", draft: { ai: { attachments: [] } }, payload: { ai: { attachments: [REF, { uploadId: "u1" }] } } };
    expect(attachedCount(confirmed)).toBe(1);
    expect(attachedRefs({ state: "draft", draft: { ai: { attachments: [{ conversationId: "c1" }] } }, payload: null })).toBeNull();
    expect(attachedCount({ state: "draft" })).toBeNull();
  });

  it("tells a client that does not know declaration-v2 from a failed read", async () => {
    expect(await readSecond(async () => ({ ok: false, status: 0, code: "client_rejected" }), "a1")).toEqual({ kind: "unsupported" });
    expect(await readSecond(async () => ({ ok: false, status: 401, code: "unauthorized" }), "a1")).toEqual({ kind: "signedOut" });
    expect(await readSecond(async () => ({ ok: false, status: 503, code: "unavailable" }), "a1")).toEqual({ kind: "unavailable" });
    expect(await readSecond(async () => ({ ok: true, status: 200, body: { nope: true } }), "a1")).toEqual({ kind: "unavailable" });
    expect(await readSecond(async () => { throw new Error("net"); }, "a1")).toEqual({ kind: "unavailable" });
  });

  it("attaches and takes off one conversation, keeping the others in order", () => {
    const r2 = { ...REF, conversationId: "c2" };
    expect(withRef([REF], "c2", r2)).toEqual([REF, r2]);
    expect(withRef([REF, r2], "c1", null)).toEqual([r2]);
    expect(withRef([REF, r2], "c1", { ...REF, throughSeq: 3 })).toEqual([r2, { ...REF, throughSeq: 3 }]);
  });
});
