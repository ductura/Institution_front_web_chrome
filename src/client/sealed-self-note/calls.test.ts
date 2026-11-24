// WEB-NF6-SIFRA: the routes through the shared client, the contract's vectors, the 409 and
// checked-delete flows, and a whole session over a recording server that never sees plain text.
import { describe, expect, it, vi } from "vitest";
import vectors from "../migration-contract-vectors.generated.json" with { type: "json" };
import { normaliseSecret } from "./codec";
import { commitKey, readKey, readSealed, removeKey, writeKey, writeSealed, deleteSealed, type ServerKey } from "./calls";
import { createKeySetup, openNote, sealNote, unlockKey, type KeyBody, type SealedNote } from "./seal";

const BASE = "https://ductura.example.invalid";
const DOC = "rad-izmisljeni-nf6-2";
type Vector = { route: string; name: string; request: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown }; response: { status: number; body: unknown } };
const vector = (route: string, name: string) => (vectors as Vector[]).find((v) => v.route === route && v.name === name)!;
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const answer = (v: Vector) => reply(v.response.status, v.response.body);
const at = (fn: ReturnType<typeof reply>, i = 0) => ({ url: String(fn.mock.calls[i]![0]), init: fn.mock.calls[i]![1]! });

describe("the contract's vectors", () => {
  it("reads every 200 answer and maps the refusals", async () => {
    expect(await readKey({ baseUrl: BASE, fetchImpl: answer(vector("profile.self-note-key.get", "no-key")) })).toEqual({ kind: "ready", key: null });
    const wrapped = await readKey({ baseUrl: BASE, fetchImpl: answer(vector("profile.self-note-key.get", "wrapped-key")) });
    expect(wrapped.kind === "ready" && wrapped.key?.keyId).toBe("6f1e2d3c-4b5a-4968-8776-6554433221a1");
    expect(await readKey({ baseUrl: BASE, fetchImpl: answer(vector("profile.self-note-key.get", "unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await readKey({ baseUrl: BASE, fetchImpl: answer(vector("profile.self-note-key.get", "unavailable")) })).toEqual({ kind: "unavailable" });

    expect((await readSealed(DOC, { baseUrl: BASE, fetchImpl: answer(vector("work.sealed-self-note.get", "nothing-kept")) })).kind).toBe("ready");
    const kept = await readSealed(DOC, { baseUrl: BASE, fetchImpl: answer(vector("work.sealed-self-note.get", "sealed-note-and-reading-place")) });
    expect(kept.kind === "ready" && kept.sealed?.ct).toHaveLength(1728);
    expect(await readSealed(DOC, { baseUrl: BASE, fetchImpl: answer(vector("work.sealed-self-note.get", "not-found")) })).toEqual({ kind: "notFound" });
    expect(await deleteSealed(DOC, { baseUrl: BASE, fetchImpl: answer(vector("work.sealed-self-note.delete", "deleted")) })).toEqual({ kind: "ready" });
  });

  it("sends the vectors' own request bodies unchanged to the contract's paths", async () => {
    const set = vector("profile.self-note-key.put", "set");
    const put = answer(set);
    expect((await writeKey(set.request.body as KeyBody, { baseUrl: BASE, fetchImpl: put })).kind).toBe("ready");
    expect(at(put).url).toBe(`${BASE}/api/v1/me/self-note-key`);
    expect(at(put).init.method).toBe("PUT");
    expect(JSON.parse(String(at(put).init.body))).toEqual(set.request.body);

    const written = vector("work.sealed-self-note.put", "written");
    const note = answer(written);
    expect(await writeSealed(DOC, (written.request.body as { sealed: SealedNote }).sealed, { baseUrl: BASE, fetchImpl: note })).toEqual({ kind: "ready" });
    expect(at(note).url).toBe(`${BASE}/api/v1/works/${DOC}/sealed-self-note`);
    expect(JSON.parse(String(at(note).init.body))).toEqual(written.request.body);
  });

  it("maps 409 and 422 of a write, and refuses on the client what the contract refuses", async () => {
    const set = vector("profile.self-note-key.put", "set").request.body as KeyBody;
    expect(await writeKey(set, { baseUrl: BASE, fetchImpl: answer(vector("profile.self-note-key.put", "conflict-already-set")) })).toEqual({ kind: "conflict" });
    const few = vector("profile.self-note-key.put", "invalid-input-few-iterations").request.body as KeyBody;
    const never = reply(200, {});
    expect(await writeKey(few, { baseUrl: BASE, fetchImpl: never })).toEqual({ kind: "invalid" });
    // The text beside the sealed note never travels: writeSealed sends only {sealed: {v, keyId, iv, ct}}.
    const clear = vector("work.sealed-self-note.put", "invalid-input-text-in-the-clear").request.body as { sealed: SealedNote & { text?: string }; text: string };
    const kept = answer(vector("work.sealed-self-note.put", "written"));
    expect(await writeSealed(DOC, { ...clear.sealed, text: clear.text } as SealedNote, { baseUrl: BASE, fetchImpl: kept })).toEqual({ kind: "ready" });
    expect(JSON.parse(String(at(kept).init.body))).toEqual({ sealed: clear.sealed });
    const padded = vector("work.sealed-self-note.put", "invalid-input-padded-iv").request.body as { sealed: SealedNote };
    expect(await writeSealed(DOC, padded.sealed, { baseUrl: BASE, fetchImpl: never })).toEqual({ kind: "invalid" });
    expect(never).not.toHaveBeenCalled();
    const other = vector("work.sealed-self-note.put", "conflict-another-key");
    expect(await writeSealed(DOC, (other.request.body as { sealed: SealedNote }).sealed, { baseUrl: BASE, fetchImpl: answer(other) })).toEqual({ kind: "conflict" });
  });
});

const keyAnswer = (body: KeyBody, version: number): ServerKey =>
  ({ v: 1, keyId: body.keyId, kdf: body.kdf, phrase: body.phrase, recovery: body.recovery, version, updatedAt: "2026-11-24T08:00:00.000Z" });

describe("commitKey (review N3: a lost answer to the first PUT)", () => {
  it("reads the key again on 409 and takes it as set when it is exactly what was sent", async () => {
    const { body } = await createKeySetup();
    const fetchImpl = vi.fn()
      .mockImplementationOnce(reply(409, { error: "conflict", code: "conflict", messageKey: "errors.conflict", status: 409 }))
      .mockImplementationOnce(reply(200, { key: keyAnswer(body, 1) }));
    expect(await commitKey(body, { baseUrl: BASE, fetchImpl })).toMatchObject({ kind: "ready", key: { keyId: body.keyId, version: 1 } });
    expect(fetchImpl.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual(["PUT", "GET"]);
  });

  it("reports another device's key on 409 when the server keeps something else", async () => {
    const mine = (await createKeySetup()).body;
    const theirs = (await createKeySetup()).body;
    const fetchImpl = vi.fn()
      .mockImplementationOnce(reply(409, { error: "conflict", code: "conflict", messageKey: "errors.conflict", status: 409 }))
      .mockImplementationOnce(reply(200, { key: keyAnswer(theirs, 2) }));
    expect(await commitKey(mine, { baseUrl: BASE, fetchImpl })).toMatchObject({ kind: "taken", key: { keyId: theirs.keyId } });
  });
});

describe("removeKey (review S2: the checked delete only)", () => {
  it("reads first and deletes only the confirmed keyId at its version", async () => {
    const { body } = await createKeySetup();
    const fetchImpl = vi.fn()
      .mockImplementationOnce(reply(200, { key: keyAnswer(body, 5) }))
      .mockImplementationOnce(reply(200, { key: null }));
    expect(await removeKey(body.keyId, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "deleted" });
    const [url, init] = fetchImpl.mock.calls[1]! as [URL, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(String(url)).toBe(`${BASE}/api/v1/me/self-note-key/${body.keyId}?ifVersion=5`);
  });

  it("deletes nothing when the server keeps another key or none", async () => {
    const { body } = await createKeySetup();
    const other = (await createKeySetup()).body;
    const fetchImpl = vi.fn().mockImplementationOnce(reply(200, { key: keyAnswer(other, 1) }));
    expect(await removeKey(body.keyId, { baseUrl: BASE, fetchImpl })).toMatchObject({ kind: "changed", key: { keyId: other.keyId } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reads again after a 409 of the delete", async () => {
    const { body } = await createKeySetup();
    const fetchImpl = vi.fn()
      .mockImplementationOnce(reply(200, { key: keyAnswer(body, 1) }))
      .mockImplementationOnce(answer(vector("profile.self-note-key-checked.delete", "conflict")))
      .mockImplementationOnce(reply(200, { key: keyAnswer(body, 2) }));
    expect(await removeKey(body.keyId, { baseUrl: BASE, fetchImpl })).toMatchObject({ kind: "changed", key: { version: 2 } });
  });
});

describe("a whole session over a recording server", () => {
  it("never sends the text, the place, the phrase or the recovery code; only the contract's routes", async () => {
    const seen: { method: string; url: string; body: string }[] = [];
    let key: ServerKey | null = null;
    let note: SealedNote | null = null;
    const server = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : "";
      seen.push({ method, url: url.href, body });
      const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
      if (url.pathname === "/api/v1/me/self-note-key" && method === "GET") return json(200, { key });
      if (url.pathname === "/api/v1/me/self-note-key" && method === "PUT") {
        const sent = JSON.parse(body) as KeyBody;
        key = keyAnswer(sent, (key?.version ?? 0) + 1);
        return json(200, { key });
      }
      if (url.pathname === `/api/v1/works/${DOC}/sealed-self-note` && method === "PUT") {
        note = (JSON.parse(body) as { sealed: SealedNote }).sealed;
        return json(200, { note: { sealed: note, updatedAt: "2026-11-24T08:01:00.000Z" }, readingPlace: null });
      }
      if (url.pathname === `/api/v1/works/${DOC}/sealed-self-note` && method === "GET") {
        return json(200, { note: note === null ? null : { sealed: note, updatedAt: "2026-11-24T08:01:00.000Z" }, readingPlace: null });
      }
      return json(404, { error: "not_found", code: "not_found", messageKey: "errors.notFound", status: 404 });
    });
    const options = { baseUrl: BASE, fetchImpl: server };
    const content = { text: "Tajna bilješka: izmišljeni zaključak broj sedam.", place: { nodeId: "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d", offset: 314 } };

    // First device: set up, then seal and send.
    const setup = await createKeySetup();
    const committed = await commitKey(setup.body, options);
    expect(committed.kind).toBe("ready");
    const sealed = (await sealNote(setup.deviceKey, setup.body.keyId, DOC, content))!;
    expect(await writeSealed(DOC, sealed, options)).toEqual({ kind: "ready" });

    // Second device: read the key, unlock with the recovery code, read and open the note.
    const read = await readKey(options);
    const unlocked = (await unlockKey(read.kind === "ready" ? read.key! : (null as never), setup.recovery))!;
    const back = await readSealed(DOC, options);
    expect(back.kind === "ready" && (await openNote(unlocked.deviceKey, setup.body.keyId, DOC, back.sealed!))).toEqual(content);

    const wire = JSON.stringify(seen);
    for (const secret of [content.text, "izmišljeni", "zaključak", content.place.nodeId, setup.phrase, setup.recovery,
      normaliseSecret(setup.phrase)!, normaliseSecret(setup.recovery)!]) {
      expect(wire).not.toContain(secret);
    }
    expect(new Set(seen.map((s) => `${s.method} ${new URL(s.url).pathname}`))).toEqual(new Set([
      "PUT /api/v1/me/self-note-key", "GET /api/v1/me/self-note-key",
      `PUT /api/v1/works/${DOC}/sealed-self-note`, `GET /api/v1/works/${DOC}/sealed-self-note`,
    ]));
    expect(seen.some((s) => s.url.includes("/self-note") && !s.url.includes("sealed-self-note") && !s.url.includes("self-note-key"))).toBe(false);
  }, 30_000);
});
