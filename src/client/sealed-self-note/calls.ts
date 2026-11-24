// The routes of the sealed "Poruka sebi" (WEB-NF6-SIFRA, SRV self-note-sealed-v1 §5), through
// the shared client only: profile.self-note-key.{get,put}, profile.self-note-key-checked.delete
// and work.sealed-self-note.{get,put,delete}. The unchecked key delete and the old
// work.self-note.* routes are never called.

import { browserTransport, createApi, type ApiOptions, type ApiResult } from "../api";
import type { KeyBody, SealedNote, StoredKey } from "./seal";

type KeyAnswer = Extract<ApiResult<"profile.self-note-key.get">, { ok: true }>["body"]["key"];
type NoteAnswer = Extract<ApiResult<"work.sealed-self-note.get">, { ok: true }>["body"];

/** What the server keeps of a key, as read. */
export type ServerKey = StoredKey & { readonly updatedAt: string };
export type Failure = { kind: "signedOut" } | { kind: "unavailable" };
export type KeyRead = { kind: "ready"; key: ServerKey | null } | Failure;
export type KeyWrite = { kind: "ready"; key: ServerKey } | { kind: "conflict" } | { kind: "invalid" } | Failure;
export type KeyDelete = { kind: "deleted" } | { kind: "conflict" } | { kind: "invalid" } | Failure;
export type SealedRead = { kind: "ready"; sealed: SealedNote | null; updatedAt: string | null } | { kind: "notFound" } | Failure;
export type SealedWrite = { kind: "ready" } | { kind: "conflict" } | { kind: "notFound" } | { kind: "invalid" } | Failure;
export type SealedDelete = { kind: "ready" } | { kind: "notFound" } | Failure;

function call(options: ApiOptions, signal?: AbortSignal) {
  const transport = options.fetchImpl ?? browserTransport;
  return createApi({ ...options, fetchImpl: (url, init) => transport(url, { ...init, signal, cache: "no-store" }) });
}

function failure(status: number): Failure {
  return status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
}

const toKey = (key: NonNullable<KeyAnswer>): ServerKey => ({
  v: key.v, keyId: key.keyId, kdf: { alg: key.kdf.alg, iterations: key.kdf.iterations },
  phrase: { ...key.phrase }, recovery: { ...key.recovery }, version: key.version, updatedAt: key.updatedAt,
});

export async function readKey(options: ApiOptions = {}, signal?: AbortSignal): Promise<KeyRead> {
  try {
    const result = await call(options, signal)("profile.self-note-key.get", { params: undefined, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready", key: result.body.key === null ? null : toKey(result.body.key) };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

export async function writeKey(body: KeyBody, options: ApiOptions = {}): Promise<KeyWrite> {
  try {
    const result = await call(options)("profile.self-note-key.put", { params: undefined, query: undefined, body: { ...body } });
    if (result.ok) return result.body.key === null ? { kind: "unavailable" } : { kind: "ready", key: toKey(result.body.key) };
    if (result.status === 409) return { kind: "conflict" };
    if (result.status === 0 || result.status === 422) return { kind: "invalid" };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Only the checked delete: the keyId the student saw and its version. */
export async function deleteKeyChecked(keyId: string, version: number, options: ApiOptions = {}): Promise<KeyDelete> {
  try {
    const result = await call(options)("profile.self-note-key-checked.delete", {
      params: { keyId }, query: { ifVersion: String(version) }, body: undefined,
    });
    if (result.ok) return result.body.key === null ? { kind: "deleted" } : { kind: "conflict" };
    if (result.status === 409) return { kind: "conflict" };
    if (result.status === 0 || result.status === 422) return { kind: "invalid" };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

const noteOf = (body: NoteAnswer): SealedRead => ({
  kind: "ready",
  sealed: body.note === null ? null : { v: body.note.sealed.v, keyId: body.note.sealed.keyId, iv: body.note.sealed.iv, ct: body.note.sealed.ct },
  updatedAt: body.note?.updatedAt ?? null,
});

export async function readSealed(documentId: string, options: ApiOptions = {}, signal?: AbortSignal): Promise<SealedRead> {
  try {
    const result = await call(options, signal)("work.sealed-self-note.get", { params: { documentId }, query: undefined, body: undefined });
    if (result.ok) return noteOf(result.body);
    if (result.status === 404) return { kind: "notFound" };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Sends only the sealed note: {v, keyId, iv, ct}. */
export async function writeSealed(documentId: string, sealed: SealedNote, options: ApiOptions = {}): Promise<SealedWrite> {
  try {
    const result = await call(options)("work.sealed-self-note.put", {
      params: { documentId }, query: undefined, body: { sealed: { v: sealed.v, keyId: sealed.keyId, iv: sealed.iv, ct: sealed.ct } },
    });
    if (result.ok) return { kind: "ready" };
    if (result.status === 409) return { kind: "conflict" };
    if (result.status === 404) return { kind: "notFound" };
    if (result.status === 0 || result.status === 422) return { kind: "invalid" };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

export async function deleteSealed(documentId: string, options: ApiOptions = {}): Promise<SealedDelete> {
  try {
    const result = await call(options)("work.sealed-self-note.delete", { params: { documentId }, query: undefined, body: undefined });
    if (result.ok) return { kind: "ready" };
    if (result.status === 404) return { kind: "notFound" };
    return failure(result.status);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Same wraps and KDF: the key the server keeps is the one this device sent. */
export function sameKey(sent: KeyBody, kept: StoredKey): boolean {
  return sent.keyId === kept.keyId && sent.kdf.iterations === kept.kdf.iterations
    && sent.phrase.salt === kept.phrase.salt && sent.phrase.iv === kept.phrase.iv && sent.phrase.ct === kept.phrase.ct
    && sent.recovery.salt === kept.recovery.salt && sent.recovery.iv === kept.recovery.iv && sent.recovery.ct === kept.recovery.ct;
}

export type KeyCommit = { kind: "ready"; key: ServerKey } | { kind: "taken"; key: ServerKey | null } | { kind: "invalid" } | Failure;

/**
 * PUT of a new or re-wrapped key. A 409 is read again (review N3 of SRV #676): when the server
 * keeps exactly what was sent, the earlier answer was only lost and the key is set; otherwise
 * another device changed it and the caller starts over from what the server keeps.
 */
export async function commitKey(body: KeyBody, options: ApiOptions = {}): Promise<KeyCommit> {
  const written = await writeKey(body, options);
  if (written.kind !== "conflict") return written;
  const read = await readKey(options);
  if (read.kind !== "ready") return read;
  if (read.key !== null && sameKey(body, read.key)) return { kind: "ready", key: read.key };
  return { kind: "taken", key: read.key };
}

export type KeyRemoval = { kind: "deleted" } | { kind: "changed"; key: ServerKey | null } | { kind: "invalid" } | Failure;

/**
 * Removes the key the student confirmed (review S2 of SRV #676): GET first, and the checked
 * delete only when the server still keeps that keyId; its version goes as ifVersion.
 */
export async function removeKey(expectedKeyId: string, options: ApiOptions = {}): Promise<KeyRemoval> {
  const read = await readKey(options);
  if (read.kind !== "ready") return read;
  if (read.key === null || read.key.keyId !== expectedKeyId) return { kind: "changed", key: read.key };
  const removed = await deleteKeyChecked(read.key.keyId, read.key.version, options);
  if (removed.kind === "conflict") {
    const again = await readKey(options);
    return again.kind === "ready" ? { kind: "changed", key: again.key } : again;
  }
  return removed;
}
