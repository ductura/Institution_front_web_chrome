// WEB-NF6-SIFRA: sealing, opening, unlocking with the phrase or the recovery code, re-wrapping.
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fromBase64Url, IV_BYTES, noteAad, normaliseSecret, SEALED_CT_BYTES, unpadMessage, wrapAad } from "./codec";
import { browserCrypto, createKeySetup, openNote, rewrapKey, sealNote, unlockKey, type StoredKey } from "./seal";

const DOC = "rad-izmisljeni-nf6-1";
const PLACE = { nodeId: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", offset: 7 };
const NOTE = { text: "Provjeriti izmišljeni izvor u trećem poglavlju.", place: PLACE };
const ab = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
const stored = (body: Awaited<ReturnType<typeof createKeySetup>>["body"], version = 1): StoredKey =>
  ({ v: body.v, keyId: body.keyId, kdf: body.kdf, phrase: body.phrase, recovery: body.recovery, version });

describe("a new key", () => {
  it("has a lower-case UUID, the contract's KDF, two different salts and wraps of the contract's lengths", async () => {
    const setup = await createKeySetup();
    const { body } = setup;
    expect(body.v).toBe(1);
    expect(body.keyId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(body.kdf).toEqual({ alg: "PBKDF2-SHA-256", iterations: 600_000 });
    expect(body.ifVersion).toBeNull();
    expect(body.phrase.salt).not.toBe(body.recovery.salt);
    for (const wrap of [body.phrase, body.recovery]) {
      expect(fromBase64Url(wrap.salt)).toHaveLength(16);
      expect(fromBase64Url(wrap.iv)).toHaveLength(12);
      expect(fromBase64Url(wrap.ct)).toHaveLength(48);
    }
    expect(setup.deviceKey.extractable).toBe(false);
    expect(setup.deviceKey.usages.sort()).toEqual(["decrypt", "encrypt"]);
    expect(setup.phrase).not.toBe(setup.recovery);
    expect(JSON.stringify(body)).not.toContain(normaliseSecret(setup.phrase));
    expect(JSON.stringify(body)).not.toContain(normaliseSecret(setup.recovery));
  });

  it("wraps the same DEK under the phrase and the recovery code, each by itself", async () => {
    const setup = await createKeySetup();
    const sealed = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, NOTE))!;
    const byPhrase = (await unlockKey(stored(setup.body), setup.phrase))!;
    const byCode = (await unlockKey(stored(setup.body), setup.recovery.toLowerCase().replaceAll("-", " ")))!;
    expect(byPhrase.via).toBe("phrase");
    expect(byCode.via).toBe("recovery");
    expect(byCode.deviceKey.extractable).toBe(false);
    expect(await openNote(byPhrase.deviceKey, setup.body.keyId, DOC, sealed)).toEqual(NOTE);
    expect(await openNote(byCode.deviceKey, setup.body.keyId, DOC, sealed)).toEqual(NOTE);
  }, 30_000);

  it("does not open with a wrong secret, a changed wrap, another keyId or a KDF outside the contract", async () => {
    const setup = await createKeySetup();
    const key = stored(setup.body);
    expect(await unlockKey(key, "0000-0000-0000-0000-0000-0000")).toBeNull();
    expect(await unlockKey(key, "nije fraza")).toBeNull();
    const flipped = key.phrase.ct.startsWith("A") ? `B${key.phrase.ct.slice(1)}` : `A${key.phrase.ct.slice(1)}`;
    expect(await unlockKey({ ...key, phrase: { ...key.phrase, ct: flipped } }, setup.phrase)).toBeNull();
    expect(await unlockKey({ ...key, keyId: "6f1e2d3c-4b5a-4968-8776-6554433221a1" }, setup.phrase)).toBeNull();
    expect(await unlockKey({ ...key, kdf: { alg: "PBKDF2-SHA-256", iterations: 100_000 } }, setup.phrase)).toBeNull();
  }, 30_000);
});

describe("a sealed note", () => {
  it("is v 1, the keyId, a fresh 12-byte IV and exactly 1296 bytes of ct, every time", async () => {
    const setup = await createKeySetup();
    const a = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, NOTE))!;
    const b = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, NOTE))!;
    const empty = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, { text: "", place: null }))!;
    for (const s of [a, b, empty]) {
      expect(Object.keys(s).sort()).toEqual(["ct", "iv", "keyId", "v"]);
      expect(s.v).toBe(1);
      expect(s.keyId).toBe(setup.body.keyId);
      expect(fromBase64Url(s.iv)).toHaveLength(IV_BYTES);
      expect(fromBase64Url(s.ct)).toHaveLength(SEALED_CT_BYTES);
      expect(s.ct).toHaveLength(1728);
    }
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    expect(JSON.stringify(a)).not.toContain("izvor");
    expect(JSON.stringify(a)).not.toContain(PLACE.nodeId);
  });

  it("opens only for the same work, the same key and unchanged bytes", async () => {
    const setup = await createKeySetup();
    const other = await createKeySetup();
    const s = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, NOTE))!;
    expect(await openNote(setup.deviceKey, setup.body.keyId, DOC, s)).toEqual(NOTE);
    expect(await openNote(setup.deviceKey, setup.body.keyId, "drugi-rad", s)).toBeNull();
    expect(await openNote(other.deviceKey, setup.body.keyId, DOC, s)).toBeNull();
    expect(await openNote(setup.deviceKey, other.body.keyId, DOC, s)).toBeNull();
    const ct = ab(fromBase64Url(s.ct)!);
    ct[0] = ct[0]! ^ 1;
    expect(await openNote(setup.deviceKey, setup.body.keyId, DOC, { ...s, ct: Buffer.from(ct).toString("base64url") })).toBeNull();
    expect(await openNote(setup.deviceKey, setup.body.keyId, DOC, { ...s, iv: `${s.iv}==` })).toBeNull();
  });

  it("is AES-256-GCM over the padded JCS with the contract's associated data (independent decrypt)", async () => {
    // A raw DEK the test knows, imported the way the device imports it.
    const raw = webcrypto.getRandomValues(new Uint8Array(32));
    const deps = browserCrypto();
    const deviceKey = await deps.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    const keyId = "6f1e2d3c-4b5a-4968-8776-6554433221a1";
    const s = (await sealNote(deviceKey, keyId, DOC, NOTE))!;
    const check = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = new Uint8Array(await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: ab(fromBase64Url(s.iv)!), additionalData: new TextEncoder().encode(`ductura-self-note-v1\n${DOC}`) }, check, ab(fromBase64Url(s.ct)!),
    ));
    expect(plain).toHaveLength(1280);
    expect(unpadMessage(plain)).toEqual(NOTE);
    expect(new TextDecoder().decode(plain).replace(/\0+$/, "")).toBe(JSON.stringify({ place: PLACE, text: NOTE.text }));
    expect([...noteAad(DOC)]).toEqual([...new TextEncoder().encode(`ductura-self-note-v1\n${DOC}`)]);
  });

  it("refuses a note that does not fit, without sealing anything", async () => {
    const setup = await createKeySetup();
    expect(await sealNote(setup.deviceKey, setup.body.keyId, DOC, { text: "x".repeat(401), place: null })).toBeNull();
    expect(await sealNote(setup.deviceKey, "NIJE-UUID", DOC, NOTE)).toBeNull();
  });
});

describe("a wrap", () => {
  it("is AES-GCM of the 32 DEK bytes under PBKDF2-SHA-256 of the phrase, bound to the keyId", async () => {
    const setup = await createKeySetup();
    const { phrase, keyId, kdf } = { ...setup.body, phrase: setup.body.phrase };
    const secret = new TextEncoder().encode(normaliseSecret(setup.phrase)!);
    const base = await webcrypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]);
    const kek = await webcrypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: ab(fromBase64Url(phrase.salt)!), iterations: kdf.iterations }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const raw = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: ab(fromBase64Url(phrase.iv)!), additionalData: ab(wrapAad(keyId)) }, kek, ab(fromBase64Url(phrase.ct)!)));
    expect(raw).toHaveLength(32);
    const check = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const s = (await sealNote(setup.deviceKey, keyId, DOC, NOTE))!;
    const plain = new Uint8Array(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: ab(fromBase64Url(s.iv)!), additionalData: ab(noteAad(DOC)) }, check, ab(fromBase64Url(s.ct)!)));
    expect(unpadMessage(plain)).toEqual(NOTE);
  }, 30_000);
});

describe("re-wrapping", () => {
  it("keeps the keyId and the DEK, sends the stored version and gives a new phrase and code", async () => {
    const setup = await createKeySetup();
    const s = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, NOTE))!;
    const again = (await rewrapKey(stored(setup.body, 3), setup.recovery))!;
    expect(again.body.keyId).toBe(setup.body.keyId);
    expect(again.body.ifVersion).toBe(3);
    expect(again.phrase).not.toBe(setup.phrase);
    expect(again.recovery).not.toBe(setup.recovery);
    expect(again.body.phrase.salt).not.toBe(again.body.recovery.salt);
    const opened = (await unlockKey(stored(again.body, 4), again.phrase))!;
    expect(await openNote(opened.deviceKey, setup.body.keyId, DOC, s)).toEqual(NOTE);
    expect(await unlockKey(stored(again.body, 4), setup.phrase)).toBeNull();
    expect(await rewrapKey(stored(setup.body), "0000-0000-0000-0000-0000-0000")).toBeNull();
  }, 60_000);

  it("refuses a random source that repeats the salt", async () => {
    const deps = browserCrypto();
    const stuck = { ...deps, random: (bytes: Uint8Array) => bytes.fill(7) };
    await expect(createKeySetup(stuck)).rejects.toThrow();
  });
});
