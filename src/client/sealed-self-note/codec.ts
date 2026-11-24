// Sealed "Poruka sebi" (WEB-NF6-SIFRA, SRV docs/contracts/self-note-sealed-v1.md §2, §4).
// The byte formats only: canonical base64url, the padded message, the associated data and
// the generated phrase and recovery code. No WebCrypto and no storage here.

/** Version of every sealed note and wrapped key (`v`). */
export const FORMAT_VERSION = 1;
/** The JCS message is padded with zero bytes to exactly this many bytes (§4.2). */
export const MESSAGE_BYTES = 1280;
/** AES-GCM tag. */
export const TAG_BYTES = 16;
/** ct of a sealed note: the padded message and the tag. */
export const SEALED_CT_BYTES = MESSAGE_BYTES + TAG_BYTES;
export const IV_BYTES = 12;
export const SALT_BYTES = 16;
export const DEK_BYTES = 32;
/** ct of a wrap: the 32 key bytes and the tag. */
export const WRAP_CT_BYTES = DEK_BYTES + TAG_BYTES;
/** The note's text, in characters (code points), as the contract allows (§4.1): 1 to 280. */
export const MIN_TEXT_CHARS = 1;
export const MAX_TEXT_CHARS = 280;
/** The place inside the work, as `readingPlace.place` of the contract. */
export const MAX_PLACE_OFFSET = 1_000_000;
/** PBKDF2 iterations the contract accepts (§4.1). */
export const MIN_ITERATIONS = 600_000;
export const MAX_ITERATIONS = 10_000_000;
/** Iterations used for a new wrap: the contract's floor. */
export const ITERATIONS = MIN_ITERATIONS;
/** Associated data of a note: label ‖ 0x0A ‖ documentId (§4.2). */
export const NOTE_AAD_LABEL = "ductura-self-note-v1";
/**
 * Associated data of a wrap: label ‖ 0x0A ‖ keyId. ASSUMPTION (PR „Pretpostavke”): the order
 * gives the note's associated data but not the wrap's; this binds a wrap to its keyId.
 */
export const WRAP_AAD_LABEL = "ductura-self-note-key-v1";

const utf8 = new TextEncoder();
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64URL_INDEX = new Map([...B64URL].map((char, index) => [char, index]));

/** Canonical base64url without padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const n = (a << 16) | (b << 8) | c;
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let k = 0; k < chars; k++) out += B64URL[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/**
 * The bytes of canonical base64url without padding, or null: padding, another alphabet, a
 * length that is no whole number of bytes or unused bits that are not zero all refuse.
 */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let at = 0;
  for (const char of text) {
    const index = B64URL_INDEX.get(char);
    if (index === undefined) return null;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (value >> bits) & 0xff;
      value &= (1 << bits) - 1;
    }
  }
  return value === 0 ? out : null;
}

/** The bytes when `text` is canonical base64url of exactly `length` bytes; else null. */
export function bytesOfLength(text: unknown, length: number): Uint8Array | null {
  if (typeof text !== "string") return null;
  const bytes = fromBase64Url(text);
  return bytes !== null && bytes.length === length ? bytes : null;
}

function joinAad(label: string, value: string): Uint8Array {
  const head = utf8.encode(label);
  const tail = utf8.encode(value);
  const out = new Uint8Array(head.length + 1 + tail.length);
  out.set(head, 0);
  out[head.length] = 0x0a;
  out.set(tail, head.length + 1);
  return out;
}

/** UTF-8("ductura-self-note-v1") ‖ 0x0A ‖ UTF-8(documentId). */
export const noteAad = (documentId: string): Uint8Array => joinAad(NOTE_AAD_LABEL, documentId);
/** UTF-8("ductura-self-note-key-v1") ‖ 0x0A ‖ UTF-8(keyId). */
export const wrapAad = (keyId: string): Uint8Array => joinAad(WRAP_AAD_LABEL, keyId);

export type NotePlace = { readonly nodeId: string; readonly offset: number };
export type NoteContent = { readonly text: string; readonly place: NotePlace | null };

const UUID_ANY = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
export const KEY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Controls other than tab and line feed; a lone surrogate has no UTF-8 form.
// eslint-disable-next-line no-control-regex
const NOT_TEXT = /[\u0000-\u0008\u000b-\u001f\u007f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
/** Direction controls the contract forbids (§4.1): U+200E, U+200F, U+202A–U+202E, U+2066–U+2069. */
const DIRECTION = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

export type TextProblem = "empty" | "tooLong" | "notAllowed";

/**
 * Why a note's text breaks the contract's rules (§4.1), or null when it keeps them: 1 to 280
 * code points, Unicode NFC, no controls but tab and line feed, no direction controls and no
 * lone surrogates. Applied before sealing and again after opening.
 */
export function textProblem(text: string): TextProblem | null {
  if (NOT_TEXT.test(text) || DIRECTION.test(text) || text !== text.normalize("NFC")) return "notAllowed";
  const chars = [...text].length;
  if (chars < MIN_TEXT_CHARS) return "empty";
  return chars > MAX_TEXT_CHARS ? "tooLong" : null;
}

function validPlace(place: unknown): place is NotePlace {
  if (typeof place !== "object" || place === null || Array.isArray(place)) return false;
  const keys = Object.keys(place);
  const { nodeId, offset } = place as Record<string, unknown>;
  return keys.length === 2 && typeof nodeId === "string" && UUID_ANY.test(nodeId)
    && typeof offset === "number" && Number.isSafeInteger(offset) && offset >= 0 && offset <= MAX_PLACE_OFFSET;
}

export function validContent(content: unknown): content is NoteContent {
  if (typeof content !== "object" || content === null || Array.isArray(content)) return false;
  const keys = Object.keys(content).sort();
  const { text, place } = content as Record<string, unknown>;
  return keys.length === 2 && keys[0] === "place" && keys[1] === "text"
    && typeof text === "string" && textProblem(text) === null
    && (place === null || validPlace(place));
}

/**
 * JCS (RFC 8785) of {text, place}: members in code-unit order ("place" < "text", "nodeId" <
 * "offset"), the ECMAScript string and integer forms. Only these shapes, so no general
 * canonicaliser is needed; the test checks it against @ductura/contracts' canonicalJson.
 */
export function canonicalMessage(content: NoteContent): string {
  const place = content.place === null ? null : { nodeId: content.place.nodeId, offset: content.place.offset };
  return JSON.stringify({ place, text: content.text });
}

/** The message bytes: JCS padded with zeros to MESSAGE_BYTES, or null when it does not fit. */
export function padMessage(content: NoteContent): Uint8Array | null {
  if (!validContent(content)) return null;
  const json = utf8.encode(canonicalMessage(content));
  if (json.length > MESSAGE_BYTES) return null;
  const out = new Uint8Array(MESSAGE_BYTES);
  out.set(json, 0);
  return out;
}

/** The note in padded message bytes, or null unless they are exactly what padMessage makes. */
export function unpadMessage(bytes: Uint8Array): NoteContent | null {
  if (bytes.length !== MESSAGE_BYTES) return null;
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end)));
  } catch {
    return null;
  }
  if (!validContent(value)) return null;
  const again = utf8.encode(canonicalMessage(value));
  if (again.length !== end || again.some((byte, i) => byte !== bytes[i])) return null;
  return { text: value.text, place: value.place === null ? null : { nodeId: value.place.nodeId, offset: value.place.offset } };
}

// --- The phrase and the recovery code (variant B2: both made on the device) -------------

/** Crockford base32: no I, L, O or U, so nothing reads as another sign. */
export const SECRET_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SECRET_GROUPS = 6;
export const SECRET_GROUP_CHARS = 4;
export const SECRET_CHARS = SECRET_GROUPS * SECRET_GROUP_CHARS;
/** 24 signs of 5 bits each: 120 bits, exactly 15 random bytes. */
export const SECRET_RANDOM_BYTES = (SECRET_CHARS * 5) / 8;

/** The 24 signs of 15 random bytes, 5 bits each, most significant first. */
export function secretFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== SECRET_RANDOM_BYTES) throw new RangeError("secret bytes");
  let out = "";
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += SECRET_ALPHABET[(value >> bits) & 31];
      value &= (1 << bits) - 1;
    }
  }
  return out;
}

/** The secret as shown: six groups of four, joined by hyphens. */
export function formatSecret(secret: string): string {
  const groups: string[] = [];
  for (let i = 0; i < secret.length; i += SECRET_GROUP_CHARS) groups.push(secret.slice(i, i + SECRET_GROUP_CHARS));
  return groups.join("-");
}

/**
 * What a person typed, as the 24 signs the KDF reads, or null. Case, spaces and hyphens do
 * not matter, and O, I and L are read as 0, 1 and 1 (Crockford). ASSUMPTION (PR
 * „Pretpostavke”): the KDF input is UTF-8 of these 24 upper-case signs, without hyphens.
 */
export function normaliseSecret(typed: string): string | null {
  const plain = typed.toUpperCase().replace(/[\s\-‐-―]/gu, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (plain.length !== SECRET_CHARS) return null;
  for (const char of plain) if (!SECRET_ALPHABET.includes(char)) return null;
  return plain;
}
