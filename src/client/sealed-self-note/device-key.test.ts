// WEB-NF6-SIFRA: the DEK on the device, in IndexedDB, removed at sign-out.
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { CURRENT_KEY, ENDED_KEY, type MarkStore } from "../session-marks";
import { forgetDeviceKey, indexedDbVault, keepDeviceKey, readDeviceKey, type DeviceKeyDeps } from "./device-key";

const KEY_ID = "6f1e2d3c-4b5a-4968-8776-6554433221a1";

function marks(): MarkStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
const session = (store: ReturnType<typeof marks>, tag: string, at: number) => store.setItem(CURRENT_KEY, JSON.stringify({ tag, at }));
const aesKey = (extractable = false) => crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, extractable, ["encrypt", "decrypt"]);

function deps(): DeviceKeyDeps & { marks: ReturnType<typeof marks> } {
  return { vault: indexedDbVault(new IDBFactory()), marks: marks(), jar: null };
}

describe("the key on this device", () => {
  it("is kept in IndexedDB as a CryptoKey that cannot be exported, and still works when read back", async () => {
    const d = deps();
    session(d.marks, "sesija-a", 1);
    const key = (await aesKey()) as CryptoKey;
    expect(await keepDeviceKey({ keyId: KEY_ID, key }, d)).toBe(true);
    const back = (await readDeviceKey(d))!;
    expect(back.keyId).toBe(KEY_ID);
    expect(back.key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", back.key)).rejects.toThrow();
    const iv = new Uint8Array(12);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, back.key, new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct))).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("refuses to keep a key that could be exported", async () => {
    const d = deps();
    expect(await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey(true)) as CryptoKey }, d)).toBe(false);
    expect(await readDeviceKey(d)).toBeNull();
  });

  it("is gone after forgetDeviceKey (the sign-out)", async () => {
    const d = deps();
    session(d.marks, "sesija-a", 1);
    await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey()) as CryptoKey }, d);
    expect(await forgetDeviceKey(d)).toBe(true);
    expect(await readDeviceKey(d)).toBeNull();
    expect(await d.vault!.read()).toBeNull();
  });

  it("is removed when the session it was kept in has ended or another session is current", async () => {
    const ended = deps();
    session(ended.marks, "sesija-a", 1);
    await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey()) as CryptoKey }, ended);
    ended.marks.setItem(ENDED_KEY, JSON.stringify(["sesija-a"]));
    expect(await readDeviceKey(ended)).toBeNull();
    expect(await ended.vault!.read()).toBeNull();

    const other = deps();
    session(other.marks, "sesija-a", 1);
    await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey()) as CryptoKey }, other);
    session(other.marks, "sesija-b", 2);
    expect(await readDeviceKey(other)).toBeNull();
    expect(await other.vault!.read()).toBeNull();

    const gone = deps();
    session(gone.marks, "sesija-a", 1);
    await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey()) as CryptoKey }, gone);
    gone.marks.map.clear();
    expect(await readDeviceKey(gone)).toBeNull();
  });

  it("drops a malformed record and works without storage", async () => {
    const d = deps();
    await d.vault!.write({ keyId: "NIJE", key: (await aesKey()) as CryptoKey, session: null });
    expect(await readDeviceKey(d)).toBeNull();
    expect(await d.vault!.read()).toBeNull();
    const none = { vault: null, marks: null, jar: null };
    expect(await readDeviceKey(none)).toBeNull();
    expect(await keepDeviceKey({ keyId: KEY_ID, key: (await aesKey()) as CryptoKey }, none)).toBe(false);
    expect(await forgetDeviceKey(none)).toBe(true);
  });
});
