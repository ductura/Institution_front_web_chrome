// WEB-NF6-SIFRA: byte formats of the sealed "Poruka sebi", against the contract extract.
import { canonicalJson } from "@ductura/contracts";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import vectors from "../migration-contract-vectors.generated.json" with { type: "json" };
import {
  bytesOfLength, canonicalMessage, formatSecret, fromBase64Url, MESSAGE_BYTES, normaliseSecret, noteAad, padMessage,
  SECRET_ALPHABET, SECRET_CHARS, secretFromBytes, toBase64Url, unpadMessage, wrapAad,
} from "./codec";

const PLACE = { nodeId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", offset: 42 };

describe("canonical base64url", () => {
  it("round-trips any bytes without padding and matches Node's base64url", () => {
    fc.assert(fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
      const text = toBase64Url(bytes);
      expect(text).toBe(Buffer.from(bytes).toString("base64url"));
      expect(text).not.toMatch(/[=+/]/);
      expect(fromBase64Url(text)).toEqual(bytes);
    }));
  });

  it("refuses padding, another alphabet, a stray length and unused bits that are not zero", () => {
    expect(fromBase64Url("AA==")).toBeNull();
    expect(fromBase64Url("A+/A")).toBeNull();
    expect(fromBase64Url("AAAAA")).toBeNull();
    expect(fromBase64Url("AB")).toBeNull(); // 0b000000_000001: the last 4 bits are not zero
    expect(fromBase64Url("AA")).toEqual(new Uint8Array([0]));
  });

  it("reads the contract's vector fields at exactly the contract's lengths", () => {
    const put = vectors.find((v) => v.route === "profile.self-note-key.put" && v.name === "set")!.request.body as Record<string, Record<string, string>>;
    for (const wrap of [put.phrase!, put.recovery!]) {
      expect(bytesOfLength(wrap.salt, 16)).not.toBeNull();
      expect(bytesOfLength(wrap.iv, 12)).not.toBeNull();
      expect(bytesOfLength(wrap.ct, 48)).not.toBeNull();
    }
    expect(put.phrase!.salt).not.toBe(put.recovery!.salt);
    const note = vectors.find((v) => v.route === "work.sealed-self-note.put" && v.name === "written")!.request.body as { sealed: Record<string, string> };
    expect(bytesOfLength(note.sealed.iv, 12)).not.toBeNull();
    expect(bytesOfLength(note.sealed.ct, 1296)).not.toBeNull();
    const padded = vectors.find((v) => v.route === "work.sealed-self-note.put" && v.name === "invalid-input-padded-iv")!.request.body as { sealed: Record<string, string> };
    expect(bytesOfLength(padded.sealed.iv, 12)).toBeNull();
    const short = vectors.find((v) => v.route === "work.sealed-self-note.put" && v.name === "invalid-input-short-ciphertext")!.request.body as { sealed: Record<string, string> };
    expect(bytesOfLength(short.sealed.ct, 1296)).toBeNull();
  });
});

describe("the message", () => {
  it("is JCS of {text, place}, the same as the contract package's canonicalJson", () => {
    fc.assert(fc.property(fc.string({ maxLength: 60 }), fc.boolean(), fc.nat({ max: 1_000_000 }), (raw, withPlace, offset) => {
      const text = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f\uD800-\uDFFF]/g, "");
      const content = { text, place: withPlace ? { ...PLACE, offset } : null };
      expect(canonicalMessage(content)).toBe(canonicalJson(content));
    }));
    expect(canonicalMessage({ text: "Provjeri izvor.", place: PLACE }))
      .toBe('{"place":{"nodeId":"0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d","offset":42},"text":"Provjeri izvor."}');
  });

  it("is padded with zeros to exactly 1280 bytes and read back only in that exact form", () => {
    const content = { text: "Sutra: drugo poglavlje, čšž ✓", place: PLACE };
    const padded = padMessage(content)!;
    expect(padded.length).toBe(MESSAGE_BYTES);
    const json = new TextEncoder().encode(canonicalMessage(content));
    expect(padded.subarray(json.length).every((b) => b === 0)).toBe(true);
    expect(unpadMessage(padded)).toEqual(content);
    const extra = padded.slice();
    extra[MESSAGE_BYTES - 1] = 1;
    expect(unpadMessage(extra)).toBeNull();
    const spaced = new Uint8Array(MESSAGE_BYTES);
    spaced.set(new TextEncoder().encode('{"text":"a","place":null}'));
    expect(unpadMessage(spaced)).toBeNull(); // not the canonical order
    expect(unpadMessage(padded.subarray(1))).toBeNull();
  });

  it("refuses what does not fit: too many characters, too many bytes, controls, another shape", () => {
    expect(padMessage({ text: "a".repeat(400), place: PLACE })).not.toBeNull();
    expect(padMessage({ text: "a".repeat(401), place: null })).toBeNull();
    expect(padMessage({ text: "😀".repeat(400), place: null })).toBeNull(); // 1600 bytes
    expect(padMessage({ text: "a\u0000b", place: null })).toBeNull();
    expect(padMessage({ text: "a\ud800", place: null })).toBeNull();
    expect(padMessage({ text: "a", place: { nodeId: "x", offset: 1 } })).toBeNull();
    expect(padMessage({ text: "a", place: { ...PLACE, offset: 1_000_001 } })).toBeNull();
    expect(padMessage({ text: "a", place: null, extra: 1 } as never)).toBeNull();
    expect(padMessage({ text: "red\npa\tred", place: null })).not.toBeNull();
  });
});

describe("associated data", () => {
  it("is the label, a line feed and the id, in UTF-8", () => {
    expect(new TextDecoder().decode(noteAad("rad-izmišljeni-1"))).toBe("ductura-self-note-v1\nrad-izmišljeni-1");
    expect([...noteAad("d")]).toEqual([...new TextEncoder().encode("ductura-self-note-v1"), 0x0a, 0x64]);
    expect(new TextDecoder().decode(wrapAad("6f1e2d3c-4b5a-4968-8776-6554433221a1"))).toBe("ductura-self-note-key-v1\n6f1e2d3c-4b5a-4968-8776-6554433221a1");
  });
});

describe("the phrase and the recovery code", () => {
  it("are 24 signs of a closed alphabet from 15 random bytes (120 bits), six groups of four", () => {
    fc.assert(fc.property(fc.uint8Array({ minLength: 15, maxLength: 15 }), (bytes) => {
      const secret = secretFromBytes(bytes);
      expect(secret).toHaveLength(SECRET_CHARS);
      for (const char of secret) expect(SECRET_ALPHABET).toContain(char);
      expect(formatSecret(secret)).toMatch(/^[0-9A-Z]{4}(?:-[0-9A-Z]{4}){5}$/);
      expect(normaliseSecret(formatSecret(secret))).toBe(secret);
      expect(normaliseSecret(` ${formatSecret(secret).toLowerCase().replaceAll("-", " ")} `)).toBe(secret);
    }));
    expect(secretFromBytes(new Uint8Array(15))).toBe("0".repeat(24));
    expect(secretFromBytes(new Uint8Array(15).fill(255))).toBe("Z".repeat(24));
    expect(() => secretFromBytes(new Uint8Array(14))).toThrow();
  });

  it("reads O, I and L as 0, 1 and 1 and refuses U, a short or a long entry", () => {
    expect(normaliseSecret("OOOO-IIII-LLLL-0000-1111-2222")).toBe("000011111111000011112222");
    expect(normaliseSecret("UUUU-0000-0000-0000-0000-0000")).toBeNull();
    expect(normaliseSecret("0000-0000-0000-0000-0000")).toBeNull();
    expect(normaliseSecret("0000-0000-0000-0000-0000-0000-0")).toBeNull();
  });
});
