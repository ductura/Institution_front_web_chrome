// WebCrypto for the sealed "Poruka sebi" (WEB-NF6-SIFRA, SRV self-note-sealed-v1 §4.1, §4.2).
// AES-256-GCM with a fresh 12-byte IV for every seal; the key of the notes (DEK) is a random
// 32-byte key, wrapped twice with AES-GCM under PBKDF2-SHA-256 keys from the phrase and the
// recovery code. The DEK the device keeps is a CryptoKey that cannot be exported.

import {
  bytesOfLength, DEK_BYTES, FORMAT_VERSION, formatSecret, ITERATIONS, IV_BYTES, KEY_ID, MAX_ITERATIONS,
  MIN_ITERATIONS, noteAad, normaliseSecret, padMessage, SALT_BYTES, SEALED_CT_BYTES, SECRET_RANDOM_BYTES,
  secretFromBytes, toBase64Url, unpadMessage, wrapAad, WRAP_CT_BYTES, type NoteContent,
} from "./codec";

export type SealedNote = { readonly v: 1; readonly keyId: string; readonly iv: string; readonly ct: string };
export type Wrap = { readonly salt: string; readonly iv: string; readonly ct: string };
export type Kdf = { readonly alg: "PBKDF2-SHA-256"; readonly iterations: number };
/** The PUT body of profile.self-note-key.put. */
export type KeyBody = {
  readonly v: 1; readonly keyId: string; readonly kdf: Kdf; readonly phrase: Wrap; readonly recovery: Wrap;
  readonly ifVersion: number | null;
};
/** What the server keeps (profile.self-note-key.get), without updatedAt. */
export type StoredKey = Omit<KeyBody, "ifVersion"> & { readonly version: number };

/** Randomness and WebCrypto, injectable for tests. */
export type CryptoDeps = { readonly subtle: SubtleCrypto; readonly random: (bytes: Uint8Array) => Uint8Array; readonly uuid: () => string };

export function browserCrypto(): CryptoDeps {
  const c = globalThis.crypto;
  return { subtle: c.subtle, random: (bytes) => c.getRandomValues(bytes), uuid: () => c.randomUUID() };
}

const AES = { name: "AES-GCM", length: 256 } as const;
/** BufferSource for WebCrypto from any Uint8Array view. */
const buf = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

/** A DEK the page can use and never read: not extractable, encrypt and decrypt only. */
export function importDeviceKey(raw: Uint8Array, deps: CryptoDeps): Promise<CryptoKey> {
  return deps.subtle.importKey("raw", buf(raw), AES, false, ["encrypt", "decrypt"]);
}

async function kek(secret: string, salt: Uint8Array, iterations: number, deps: CryptoDeps): Promise<CryptoKey> {
  const base = await deps.subtle.importKey("raw", buf(new TextEncoder().encode(secret)), "PBKDF2", false, ["deriveKey"]);
  return deps.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations }, base, AES, false, ["encrypt", "decrypt"]);
}

async function wrapRaw(raw: Uint8Array, secret: string, keyId: string, iterations: number, deps: CryptoDeps): Promise<Wrap> {
  const salt = deps.random(new Uint8Array(SALT_BYTES));
  const iv = deps.random(new Uint8Array(IV_BYTES));
  const key = await kek(secret, salt, iterations, deps);
  const ct = new Uint8Array(await deps.subtle.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(wrapAad(keyId)) }, key, buf(raw)));
  return { salt: toBase64Url(salt), iv: toBase64Url(iv), ct: toBase64Url(ct) };
}

/** The 32 DEK bytes in a wrap, or null: wrong secret, a changed wrap or a malformed one. */
async function unwrapRaw(wrap: Wrap, secret: string, keyId: string, iterations: number, deps: CryptoDeps): Promise<Uint8Array | null> {
  const salt = bytesOfLength(wrap.salt, SALT_BYTES);
  const iv = bytesOfLength(wrap.iv, IV_BYTES);
  const ct = bytesOfLength(wrap.ct, WRAP_CT_BYTES);
  if (salt === null || iv === null || ct === null) return null;
  try {
    const key = await kek(secret, salt, iterations, deps);
    const raw = new Uint8Array(await deps.subtle.decrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(wrapAad(keyId)) }, key, buf(ct)));
    return raw.length === DEK_BYTES ? raw : null;
  } catch {
    return null;
  }
}

/** A new phrase or recovery code, as shown to the student. */
export const newSecret = (deps: CryptoDeps): string => formatSecret(secretFromBytes(deps.random(new Uint8Array(SECRET_RANDOM_BYTES))));

/** Two different salts (§4.1); a random source that repeats itself is refused. */
function distinctSalts(phrase: Wrap, recovery: Wrap): boolean {
  return phrase.salt !== recovery.salt;
}

async function wrapBoth(raw: Uint8Array, phrase: string, recovery: string, keyId: string, deps: CryptoDeps) {
  const p = normaliseSecret(phrase);
  const r = normaliseSecret(recovery);
  if (p === null || r === null || p === r) throw new Error("secrets");
  const phraseWrap = await wrapRaw(raw, p, keyId, ITERATIONS, deps);
  const recoveryWrap = await wrapRaw(raw, r, keyId, ITERATIONS, deps);
  if (!distinctSalts(phraseWrap, recoveryWrap)) throw new Error("salts");
  return { phrase: phraseWrap, recovery: recoveryWrap };
}

export type KeySetup = {
  /** The PUT body, `ifVersion: null`: a first key. */
  readonly body: KeyBody;
  /** The phrase and the recovery code, shown once; never sent. */
  readonly phrase: string;
  readonly recovery: string;
  /** The DEK for this device, not extractable. */
  readonly deviceKey: CryptoKey;
};

/** A new key: a random DEK, a new keyId, a phrase and a recovery code, both wraps. */
export async function createKeySetup(deps: CryptoDeps = browserCrypto()): Promise<KeySetup> {
  const raw = deps.random(new Uint8Array(DEK_BYTES));
  try {
    const keyId = deps.uuid().toLowerCase();
    if (!KEY_ID.test(keyId)) throw new Error("keyId");
    const phrase = newSecret(deps);
    const recovery = newSecret(deps);
    const wraps = await wrapBoth(raw, phrase, recovery, keyId, deps);
    const body: KeyBody = { v: FORMAT_VERSION, keyId, kdf: { alg: "PBKDF2-SHA-256", iterations: ITERATIONS }, ...wraps, ifVersion: null };
    return { body, phrase, recovery, deviceKey: await importDeviceKey(raw, deps) };
  } finally {
    raw.fill(0);
  }
}

export type Unlocked = { readonly deviceKey: CryptoKey; readonly via: "phrase" | "recovery" };

function usableKdf(stored: StoredKey): boolean {
  const { iterations } = stored.kdf;
  return stored.v === FORMAT_VERSION && stored.kdf.alg === "PBKDF2-SHA-256" && Number.isSafeInteger(iterations)
    && iterations >= MIN_ITERATIONS && iterations <= MAX_ITERATIONS && KEY_ID.test(stored.keyId);
}

/** The DEK bytes through the phrase, else the recovery code. Caller zeroes them. */
async function rawOf(stored: StoredKey, typed: string, deps: CryptoDeps): Promise<{ raw: Uint8Array; via: Unlocked["via"] } | null> {
  const secret = normaliseSecret(typed);
  if (secret === null || !usableKdf(stored)) return null;
  const { iterations } = stored.kdf;
  const byPhrase = await unwrapRaw(stored.phrase, secret, stored.keyId, iterations, deps);
  if (byPhrase !== null) return { raw: byPhrase, via: "phrase" };
  const byRecovery = await unwrapRaw(stored.recovery, secret, stored.keyId, iterations, deps);
  return byRecovery === null ? null : { raw: byRecovery, via: "recovery" };
}

/** Unlocks the DEK on this device with the phrase or the recovery code; null when neither opens. */
export async function unlockKey(stored: StoredKey, typed: string, deps: CryptoDeps = browserCrypto()): Promise<Unlocked | null> {
  const found = await rawOf(stored, typed, deps);
  if (found === null) return null;
  try {
    return { deviceKey: await importDeviceKey(found.raw, deps), via: found.via };
  } finally {
    found.raw.fill(0);
  }
}

/**
 * A new phrase and recovery code for the same DEK and keyId (§4.1 re-wrap): opened with what
 * the student typed, the PUT carries the stored version as `ifVersion`. Null when it does not open.
 */
export async function rewrapKey(stored: StoredKey, typed: string, deps: CryptoDeps = browserCrypto()): Promise<KeySetup | null> {
  const found = await rawOf(stored, typed, deps);
  if (found === null) return null;
  try {
    const phrase = newSecret(deps);
    const recovery = newSecret(deps);
    const wraps = await wrapBoth(found.raw, phrase, recovery, stored.keyId, deps);
    const body: KeyBody = { v: FORMAT_VERSION, keyId: stored.keyId, kdf: { alg: "PBKDF2-SHA-256", iterations: ITERATIONS }, ...wraps, ifVersion: stored.version };
    return { body, phrase, recovery, deviceKey: await importDeviceKey(found.raw, deps) };
  } finally {
    found.raw.fill(0);
  }
}

/** Seals {text, place} for one work: a fresh IV, exactly 1296 bytes of ct. Null when it does not fit. */
export async function sealNote(
  deviceKey: CryptoKey, keyId: string, documentId: string, content: NoteContent, deps: CryptoDeps = browserCrypto(),
): Promise<SealedNote | null> {
  const message = padMessage(content);
  if (message === null || !KEY_ID.test(keyId)) return null;
  const iv = deps.random(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await deps.subtle.encrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(noteAad(documentId)) }, deviceKey, buf(message)));
  message.fill(0);
  if (ct.length !== SEALED_CT_BYTES) return null;
  return { v: FORMAT_VERSION, keyId, iv: toBase64Url(iv), ct: toBase64Url(ct) };
}

/** {text, place} of a sealed note of this work, or null: another key, another work, changed bytes. */
export async function openNote(
  deviceKey: CryptoKey, keyId: string, documentId: string, sealed: SealedNote, deps: CryptoDeps = browserCrypto(),
): Promise<NoteContent | null> {
  if (sealed.v !== FORMAT_VERSION || sealed.keyId !== keyId) return null;
  const iv = bytesOfLength(sealed.iv, IV_BYTES);
  const ct = bytesOfLength(sealed.ct, SEALED_CT_BYTES);
  if (iv === null || ct === null) return null;
  try {
    const message = new Uint8Array(await deps.subtle.decrypt({ name: "AES-GCM", iv: buf(iv), additionalData: buf(noteAad(documentId)) }, deviceKey, buf(ct)));
    const content = unpadMessage(message);
    message.fill(0);
    return content;
  } catch {
    return null;
  }
}
