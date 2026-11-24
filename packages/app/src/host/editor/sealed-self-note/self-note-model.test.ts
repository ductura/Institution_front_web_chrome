// WEB-NF6-SIFRA: the flows of the sealed "Poruka sebi" over the real client and WebCrypto, a
// memory server that records every request, and a memory vault for the device key.
import { describe, expect, it } from "vitest";
import { commitKey, deleteSealed, readKey, readSealed, removeKey, writeSealed, type ServerKey } from "@/client/sealed-self-note/calls";
import { normaliseSecret } from "@/client/sealed-self-note/codec";
import { forgetDeviceKey, keepDeviceKey, readDeviceKey, type DeviceKeyDeps, type KeyVault } from "@/client/sealed-self-note/device-key";
import { createKeySetup, openNote, rewrapKey, sealNote, unlockKey, type KeyBody, type SealedNote } from "@/client/sealed-self-note/seal";
import { CURRENT_KEY } from "@/client/session-marks";
import { confirmRenew, confirmSetup, load, removeNote, reset, save, startRenew, startSetup, unlock, type OpenView, type SelfNotePort, type View } from "./self-note-model";

const BASE = "https://ductura.example.invalid";
const DOC = "rad-izmisljeni-nf6-3";
const PLACE = { nodeId: "2c3d4e5f-6071-4b8c-9dae-1f2a3b4c5d6e", offset: 12 };

type Seen = { method: string; path: string; body: string };

function memoryServer() {
  const seen: Seen[] = [];
  const state: { key: ServerKey | null; note: SealedNote | null; refuseNextPut: boolean } = { key: null, note: null, refuseNextPut: false };
  const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const err = (status: number, code: string) => json(status, { error: code, code, messageKey: `errors.${code}`, status });
  const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    seen.push({ method, path: `${url.pathname}${url.search}`, body });
    if (url.pathname === "/api/v1/me/self-note-key") {
      if (method === "GET") return json(200, { key: state.key });
      const sent = JSON.parse(body) as KeyBody;
      const lost = state.refuseNextPut;
      state.refuseNextPut = false;
      if ((sent.ifVersion ?? null) !== (state.key?.version ?? null)) return err(409, "conflict");
      if (state.key !== null && state.key.keyId !== sent.keyId) return err(409, "conflict");
      const { ifVersion: _, ...rest } = sent;
      state.key = { ...rest, version: (state.key?.version ?? 0) + 1, updatedAt: "2026-11-24T09:00:00.000Z" };
      return lost ? err(503, "unavailable") : json(200, { key: state.key });
    }
    if (url.pathname.startsWith("/api/v1/me/self-note-key/") && method === "DELETE") {
      const keyId = url.pathname.split("/").pop();
      if (state.key === null || state.key.keyId !== keyId || url.searchParams.get("ifVersion") !== String(state.key.version)) return err(409, "conflict");
      state.key = null;
      return json(200, { key: null });
    }
    if (url.pathname === `/api/v1/works/${DOC}/sealed-self-note`) {
      const answer = () => json(200, { note: state.note === null ? null : { sealed: state.note, updatedAt: "2026-11-24T09:01:00.000Z" }, readingPlace: null });
      if (method === "GET") return answer();
      if (method === "DELETE") { state.note = null; return answer(); }
      const sealed = (JSON.parse(body) as { sealed: SealedNote }).sealed;
      if (state.key === null || sealed.keyId !== state.key.keyId) return err(409, "conflict");
      state.note = sealed;
      return answer();
    }
    return err(404, "not_found");
  };
  return { seen, state, fetchImpl };
}

function memoryVault(): KeyVault & { has: () => boolean } {
  let kept: Awaited<ReturnType<KeyVault["read"]>> = null;
  return { has: () => kept !== null, read: async () => kept, write: async (r) => { kept = r; }, clear: async () => { kept = null; } };
}

function device(tag = "sesija-1") {
  const map = new Map<string, string>([[CURRENT_KEY, JSON.stringify({ tag, at: 1 })]]);
  const vault = memoryVault();
  const deps: DeviceKeyDeps = { vault, marks: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }, jar: null };
  return { vault, deps };
}

function port(server: ReturnType<typeof memoryServer>, dev: ReturnType<typeof device>): SelfNotePort {
  const o = { baseUrl: BASE, fetchImpl: server.fetchImpl };
  return {
    readKey: () => readKey(o), commitKey: (body) => commitKey(body, o), removeKey: (keyId) => removeKey(keyId, o),
    readSealed: (id) => readSealed(id, o), writeSealed: (id, s) => writeSealed(id, s, o), deleteSealed: (id) => deleteSealed(id, o),
    createKeySetup: () => createKeySetup(), unlockKey: (key, typed) => unlockKey(key, typed), rewrapKey: (key, typed) => rewrapKey(key, typed),
    sealNote: (d, id, c) => sealNote(d.key, d.keyId, id, c), openNote: (d, id, s) => openNote(d.key, d.keyId, id, s),
    readDeviceKey: () => readDeviceKey(dev.deps), keepDeviceKey: (d) => keepDeviceKey(d, dev.deps), forgetDeviceKey: () => forgetDeviceKey(dev.deps),
  };
}

const asOpen = (view: View): OpenView => { expect(view.kind).toBe("open"); return view as OpenView; };
const viewOf = <T,>(result: { view: View } | T): View => { expect(result).toHaveProperty("view"); return (result as { view: View }).view; };

describe("first use, then a second computer", () => {
  it("sets up, saves sealed, and opens on another device with the phrase; the server sees no plain text", async () => {
    const server = memoryServer();
    const first = device();
    const p1 = port(server, first);
    expect(await load(p1, DOC)).toEqual({ kind: "noKey" });
    const setupView = await startSetup(p1);
    expect(setupView.kind).toBe("setup");
    const setup = (setupView as Extract<View, { kind: "setup" }>).setup;
    const opened = asOpen(await confirmSetup(p1, DOC, setup));
    expect(first.vault.has()).toBe(true);
    const text = "Sljedeće: izmišljena tablica u drugom poglavlju.";
    const saved = asOpen(viewOf(await save(p1, DOC, opened, text, PLACE)));
    expect(saved.notice).toBe("saved");

    // Same device, page loaded again: opens without asking.
    expect(asOpen(await load(p1, DOC)).note).toEqual({ text, place: PLACE });

    // Another computer: locked, wrong entry refused, the phrase opens.
    const second = device("sesija-2");
    const p2 = port(server, second);
    const locked = await load(p2, DOC);
    expect(locked.kind).toBe("locked");
    const key = (locked as Extract<View, { kind: "locked" }>).key;
    expect(await unlock(p2, DOC, key, "kriva fraza")).toEqual({ error: "unlockMalformed" });
    expect(await unlock(p2, DOC, key, "0000-0000-0000-0000-0000-0000")).toEqual({ error: "unlockWrong" });
    const there = asOpen(viewOf(await unlock(p2, DOC, key, setup.phrase)));
    expect(there.note).toEqual({ text, place: PLACE });
    expect(there.via).toBe("phrase");

    const wire = JSON.stringify(server.seen);
    for (const secret of [text, "izmišljena", PLACE.nodeId, setup.phrase, setup.recovery, normaliseSecret(setup.phrase)!, normaliseSecret(setup.recovery)!]) {
      expect(wire).not.toContain(secret);
    }
    expect(server.seen.some((s) => /\/self-note(?:$|\?)/.test(s.path) || /\/works\/[^/]+\/self-note/.test(s.path))).toBe(false);
  }, 60_000);

  it("opens with the recovery code, suggests a new pair, and the new pair replaces the old one", async () => {
    const server = memoryServer();
    const p1 = port(server, device());
    const setup = (await startSetup(p1) as Extract<View, { kind: "setup" }>).setup;
    const opened = asOpen(await confirmSetup(p1, DOC, setup));
    await save(p1, DOC, opened, "Izmišljena bilješka.", null);

    const p2 = port(server, device("sesija-2"));
    const locked = await load(p2, DOC) as Extract<View, { kind: "locked" }>;
    const byCode = asOpen(viewOf(await unlock(p2, DOC, locked.key, setup.recovery)));
    expect(byCode.via).toBe("recovery");
    expect(byCode.notice).toBe("recoveryUsed");
    expect(await startRenew(p2, byCode, "0000-0000-0000-0000-0000-0000")).toEqual({ error: "unlockWrong" });
    const renew = viewOf(await startRenew(p2, byCode, setup.recovery)) as Extract<View, { kind: "renew" }>;
    expect(renew.kind).toBe("renew");
    expect(renew.setup.body.keyId).toBe(setup.body.keyId);
    expect(renew.setup.body.ifVersion).toBe(1);
    const done = asOpen(await confirmRenew(p2, DOC, renew));
    expect(done.notice).toBe("renewDone");
    expect(server.state.key?.version).toBe(2);
    expect(done.note).toEqual({ text: "Izmišljena bilješka.", place: null });

    const p3 = port(server, device("sesija-3"));
    const again = await load(p3, DOC) as Extract<View, { kind: "locked" }>;
    expect(await unlock(p3, DOC, again.key, setup.phrase)).toEqual({ error: "unlockWrong" });
    expect(asOpen(viewOf(await unlock(p3, DOC, again.key, renew.setup.phrase))).note?.text).toBe("Izmišljena bilješka.");
  }, 90_000);
});

describe("conflicts between devices", () => {
  it("takes a first key as set when only the answer was lost (N3)", async () => {
    const server = memoryServer();
    const p = port(server, device());
    const setup = (await startSetup(p) as Extract<View, { kind: "setup" }>).setup;
    server.state.refuseNextPut = true; // the server keeps it, the answer is lost
    expect((await confirmSetup(p, DOC, setup)).kind).toBe("unavailable");
    expect(asOpen(await confirmSetup(p, DOC, setup)).key.keyId).toBe(setup.body.keyId);
  });

  it("goes to unlocking when another device set its own key first", async () => {
    const server = memoryServer();
    const pa = port(server, device("a"));
    const pb = port(server, device("b"));
    const a = (await startSetup(pa) as Extract<View, { kind: "setup" }>).setup;
    const b = (await startSetup(pb) as Extract<View, { kind: "setup" }>).setup;
    await confirmSetup(pa, DOC, a);
    const lost = await confirmSetup(pb, DOC, b);
    expect(lost).toMatchObject({ kind: "locked", notice: "setupTaken", key: { keyId: a.body.keyId } });
  });

  it("drops a device key that is not the server's key", async () => {
    const server = memoryServer();
    const dev = device();
    const p = port(server, dev);
    const setup = (await startSetup(p) as Extract<View, { kind: "setup" }>).setup;
    await confirmSetup(p, DOC, setup);
    // Started over elsewhere: the server keeps another key now.
    const other = (await createKeySetup()).body;
    const { ifVersion: _, ...rest } = other;
    server.state.key = { ...rest, version: 1, updatedAt: "2026-11-24T09:00:00.000Z" };
    expect((await load(p, DOC)).kind).toBe("locked");
    expect(dev.vault.has()).toBe(false);
  });
});

describe("starting over (S2)", () => {
  it("deletes only the key the student saw, with its version, then offers a new one; the old note cannot be read", async () => {
    const server = memoryServer();
    const dev = device();
    const p = port(server, dev);
    const setup = (await startSetup(p) as Extract<View, { kind: "setup" }>).setup;
    const opened = asOpen(await confirmSetup(p, DOC, setup));
    await save(p, DOC, opened, "Stara izmišljena poruka.", null);
    const fresh = port(server, device("druga"));
    const locked = await load(fresh, DOC) as Extract<View, { kind: "locked" }>;
    expect(viewOf(await reset(fresh, DOC, locked.key))).toEqual({ kind: "noKey" });
    const del = server.seen.find((s) => s.method === "DELETE")!;
    expect(del.path).toBe(`/api/v1/me/self-note-key/${setup.body.keyId}?ifVersion=1`);
    expect(server.seen.indexOf(del)).toBeGreaterThan(0);
    expect(server.seen[server.seen.indexOf(del) - 1]).toMatchObject({ method: "GET", path: "/api/v1/me/self-note-key" });

    // The first device's key is dropped on the next load, and a new key cannot read the old note.
    expect((await load(p, DOC)).kind).toBe("noKey");
    expect(dev.vault.has()).toBe(false);
    const next = (await startSetup(fresh) as Extract<View, { kind: "setup" }>).setup;
    const reopened = asOpen(await confirmSetup(fresh, DOC, next));
    expect(reopened.old).toBe(true);
    expect(reopened.note).toBeNull();
    expect(asOpen(viewOf(await removeNote(fresh, DOC, reopened))).notice).toBe("removed");
  }, 60_000);

  it("deletes nothing when the key changed meanwhile", async () => {
    const server = memoryServer();
    const p = port(server, device());
    const setup = (await startSetup(p) as Extract<View, { kind: "setup" }>).setup;
    await confirmSetup(p, DOC, setup);
    const stale = { ...server.state.key!, keyId: "6f1e2d3c-4b5a-4968-8776-6554433221a1" };
    expect(viewOf(await reset(p, DOC, stale))).toMatchObject({ kind: "open", notice: "resetChanged" });
    expect(server.seen.some((s) => s.method === "DELETE")).toBe(false);
    expect(server.state.key).not.toBeNull();
  });
});

describe("saving", () => {
  it("refuses a note over 400 characters without sending anything", async () => {
    const server = memoryServer();
    const p = port(server, device());
    const opened = asOpen(await confirmSetup(p, DOC, (await startSetup(p) as Extract<View, { kind: "setup" }>).setup));
    const before = server.seen.length;
    expect(await save(p, DOC, opened, "a".repeat(401), null)).toEqual({ error: "tooLong" });
    expect(await save(p, DOC, opened, "😀".repeat(400), null)).toEqual({ error: "tooLong" });
    expect(server.seen.length).toBe(before);
  });

  it("goes back to unlocking when the server's key changed under the device (409)", async () => {
    const server = memoryServer();
    const dev = device();
    const p = port(server, dev);
    const opened = asOpen(await confirmSetup(p, DOC, (await startSetup(p) as Extract<View, { kind: "setup" }>).setup));
    const other = (await createKeySetup()).body;
    const { ifVersion: _, ...rest } = other;
    server.state.key = { ...rest, version: 3, updatedAt: "2026-11-24T09:00:00.000Z" };
    expect(viewOf(await save(p, DOC, opened, "Izmišljeno.", null))).toMatchObject({ kind: "locked", notice: "changedElsewhere" });
    expect(dev.vault.has()).toBe(false);
  });
});
