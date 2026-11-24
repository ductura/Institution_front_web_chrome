// The flows of the sealed "Poruka sebi" (WEB-NF6-SIFRA, variant B2) as plain async steps over a
// port, so the component only renders and the tests run without a browser. Every step returns
// the next view; nothing here holds the phrase or the recovery code longer than one step.

import { commitKey, deleteSealed, readKey, readSealed, removeKey, writeSealed, type ServerKey } from "@/client/sealed-self-note/calls";
import { MAX_TEXT_CHARS, normaliseSecret, type NoteContent, type NotePlace } from "@/client/sealed-self-note/codec";
import { forgetDeviceKey, keepDeviceKey, readDeviceKey, type DeviceKey } from "@/client/sealed-self-note/device-key";
import { createKeySetup, openNote, rewrapKey, sealNote, unlockKey, type KeySetup } from "@/client/sealed-self-note/seal";
import type { SealedSelfNoteText } from "./messages";

export type SelfNotePort = {
  readKey: typeof readKey; commitKey: typeof commitKey; removeKey: typeof removeKey;
  readSealed: typeof readSealed; writeSealed: typeof writeSealed; deleteSealed: typeof deleteSealed;
  createKeySetup: () => Promise<KeySetup>; unlockKey: (key: ServerKey, typed: string) => ReturnType<typeof unlockKey>;
  rewrapKey: (key: ServerKey, typed: string) => ReturnType<typeof rewrapKey>;
  sealNote: (device: DeviceKey, documentId: string, content: NoteContent) => ReturnType<typeof sealNote>;
  openNote: (device: DeviceKey, documentId: string, sealed: Parameters<typeof openNote>[3]) => ReturnType<typeof openNote>;
  readDeviceKey: () => ReturnType<typeof readDeviceKey>; keepDeviceKey: (device: DeviceKey) => ReturnType<typeof keepDeviceKey>;
  forgetDeviceKey: () => ReturnType<typeof forgetDeviceKey>;
};

export function browserSelfNotePort(): SelfNotePort {
  return {
    readKey: (options, signal) => readKey(options, signal), commitKey: (body) => commitKey(body), removeKey: (keyId) => removeKey(keyId),
    readSealed: (documentId, options, signal) => readSealed(documentId, options, signal),
    writeSealed: (documentId, sealed) => writeSealed(documentId, sealed), deleteSealed: (documentId) => deleteSealed(documentId),
    createKeySetup: () => createKeySetup(),
    unlockKey: (key, typed) => unlockKey(key, typed),
    rewrapKey: (key, typed) => rewrapKey(key, typed),
    sealNote: (device, documentId, content) => sealNote(device.key, device.keyId, documentId, content),
    openNote: (device, documentId, sealed) => openNote(device.key, device.keyId, documentId, sealed),
    readDeviceKey: () => readDeviceKey(), keepDeviceKey: (device) => keepDeviceKey(device), forgetDeviceKey: () => forgetDeviceKey(),
  };
}

/** A message key of the catalogue, never free text. */
export type Notice = keyof { [K in keyof SealedSelfNoteText as SealedSelfNoteText[K] extends string ? K : never]: true };

export type OpenView = {
  kind: "open"; key: ServerKey; device: DeviceKey;
  /** The note as opened; null when there is none (or an old one that cannot be read). */
  note: NoteContent | null;
  /** A note is kept but sealed with an earlier key (after starting over). */
  old: boolean;
  via: "phrase" | "recovery" | "device";
  notice?: Notice;
};

export type View =
  | { kind: "loading" } | { kind: "signedOut" } | { kind: "unavailable" } | { kind: "notFound" }
  | { kind: "noKey"; notice?: Notice }
  | { kind: "setup"; setup: KeySetup; notice?: Notice }
  | { kind: "locked"; key: ServerKey; notice?: Notice }
  | OpenView
  | { kind: "renew"; open: OpenView; setup: KeySetup; notice?: Notice };

type Failure = { kind: "signedOut" } | { kind: "unavailable" };
const failed = (result: Failure): View => ({ kind: result.kind });

async function openWith(port: SelfNotePort, documentId: string, key: ServerKey, device: DeviceKey, via: OpenView["via"], notice?: Notice): Promise<View> {
  const read = await port.readSealed(documentId);
  if (read.kind === "notFound") return { kind: "notFound" };
  if (read.kind !== "ready") return failed(read);
  if (read.sealed === null) return { kind: "open", key, device, note: null, old: false, via, notice };
  if (read.sealed.keyId !== device.keyId) return { kind: "open", key, device, note: null, old: true, via, notice };
  const note = await port.openNote(device, documentId, read.sealed);
  return { kind: "open", key, device, note, old: false, via, notice: note === null ? "unreadable" : notice };
}

/** What the page shows first: no key yet, a key this device has not opened, or the note. */
export async function load(port: SelfNotePort, documentId: string, notice?: Notice): Promise<View> {
  const read = await port.readKey();
  if (read.kind !== "ready") return failed(read);
  if (read.key === null) {
    await port.forgetDeviceKey();
    return { kind: "noKey", notice };
  }
  const device = await port.readDeviceKey();
  if (device !== null && device.keyId === read.key.keyId) return openWith(port, documentId, read.key, device, "device", notice);
  if (device !== null) await port.forgetDeviceKey();
  return { kind: "locked", key: read.key, notice };
}

export async function startSetup(port: SelfNotePort): Promise<View> {
  return { kind: "setup", setup: await port.createKeySetup() };
}

/** After the student confirmed the phrase and the code are saved. A 409 is resolved in commitKey (N3). */
export async function confirmSetup(port: SelfNotePort, documentId: string, setup: KeySetup): Promise<View> {
  const committed = await port.commitKey(setup.body);
  if (committed.kind === "ready") {
    const device = { keyId: committed.key.keyId, key: setup.deviceKey };
    const kept = await port.keepDeviceKey(device);
    return openWith(port, documentId, committed.key, device, "device", kept ? undefined : "unlockDeviceFailed");
  }
  if (committed.kind === "taken") return committed.key === null ? load(port, documentId, "setupFailed") : { kind: "locked", key: committed.key, notice: "setupTaken" };
  if (committed.kind === "invalid") return { kind: "setup", setup, notice: "setupFailed" };
  return failed(committed);
}

export type UnlockResult = { view: View } | { error: "unlockWrong" | "unlockMalformed" };

export async function unlock(port: SelfNotePort, documentId: string, key: ServerKey, typed: string): Promise<UnlockResult> {
  if (normaliseSecret(typed) === null) return { error: "unlockMalformed" };
  const unlocked = await port.unlockKey(key, typed);
  if (unlocked === null) return { error: "unlockWrong" };
  const device = { keyId: key.keyId, key: unlocked.deviceKey };
  const kept = await port.keepDeviceKey(device);
  const notice: Notice | undefined = !kept ? "unlockDeviceFailed" : unlocked.via === "recovery" ? "recoveryUsed" : undefined;
  return { view: await openWith(port, documentId, key, device, unlocked.via, notice) };
}

/** Characters as the contract counts them (code points). */
export const textLength = (text: string): number => [...text].length;
export const charsLeft = (text: string): number => MAX_TEXT_CHARS - textLength(text);

export type SaveResult = { view: View } | { error: "tooLong" | "saveFailed" };

/** Seals the text and the place on the device and sends only the sealed note. */
export async function save(port: SelfNotePort, documentId: string, view: OpenView, text: string, place: NotePlace | null): Promise<SaveResult> {
  if (charsLeft(text) < 0) return { error: "tooLong" };
  const content: NoteContent = { text, place };
  const sealed = await port.sealNote(view.device, documentId, content);
  if (sealed === null) return { error: "tooLong" };
  const written = await port.writeSealed(documentId, sealed);
  if (written.kind === "ready") return { view: { ...view, note: content, old: false, notice: "saved" } };
  if (written.kind === "conflict") {
    await port.forgetDeviceKey();
    return { view: await load(port, documentId, "changedElsewhere") };
  }
  if (written.kind === "notFound") return { view: { kind: "notFound" } };
  if (written.kind === "signedOut") return { view: { kind: "signedOut" } };
  return { error: "saveFailed" };
}

export async function removeNote(port: SelfNotePort, documentId: string, view: OpenView): Promise<SaveResult> {
  const removed = await port.deleteSealed(documentId);
  if (removed.kind === "ready") return { view: { ...view, note: null, old: false, notice: "removed" } };
  if (removed.kind === "notFound") return { view: { kind: "notFound" } };
  if (removed.kind === "signedOut") return { view: { kind: "signedOut" } };
  return { error: "saveFailed" };
}

export type RenewResult = { view: View } | { error: "unlockWrong" | "unlockMalformed" };

/** A new phrase and code for the same messages: opened with what the student typed now. */
export async function startRenew(port: SelfNotePort, view: OpenView, typed: string): Promise<RenewResult> {
  if (normaliseSecret(typed) === null) return { error: "unlockMalformed" };
  const setup = await port.rewrapKey(view.key, typed);
  if (setup === null) return { error: "unlockWrong" };
  return { view: { kind: "renew", open: view, setup } };
}

export async function confirmRenew(port: SelfNotePort, documentId: string, renew: Extract<View, { kind: "renew" }>): Promise<View> {
  const committed = await port.commitKey(renew.setup.body);
  if (committed.kind === "ready") {
    const device = { keyId: committed.key.keyId, key: renew.setup.deviceKey };
    await port.keepDeviceKey(device);
    return { ...renew.open, key: committed.key, device, via: "device", notice: "renewDone" };
  }
  if (committed.kind === "taken") {
    await port.forgetDeviceKey();
    return committed.key === null ? load(port, documentId) : { kind: "locked", key: committed.key, notice: "renewTaken" };
  }
  if (committed.kind === "invalid") return { ...renew, notice: "setupFailed" };
  return failed(committed);
}

export type ResetResult = { view: View } | { error: "resetFailed" };

/**
 * Starting over after both are lost: the checked delete of the key the student saw (S2),
 * then a fresh start. Old notes stay sealed under the removed key and cannot be read.
 */
export async function reset(port: SelfNotePort, documentId: string, key: ServerKey): Promise<ResetResult> {
  const removed = await port.removeKey(key.keyId);
  if (removed.kind === "deleted") {
    await port.forgetDeviceKey();
    return { view: { kind: "noKey" } };
  }
  if (removed.kind === "changed") return { view: await load(port, documentId, "resetChanged") };
  if (removed.kind === "signedOut") return { view: { kind: "signedOut" } };
  return { error: "resetFailed" };
}
