import { describe, expect, it, vi } from "vitest";

import { journalScopeOf, readJournalScope, sessionTagOf } from "./EditorPage.scope";

// WEB-14c: the journal scope is the person's `journalScope` from /api/v1/me
// (SRV-JS). Invented bodies only; no real request is made.
const SCOPE = "a".repeat(64);
const TAG = "izmisljena-sesija-0001";
const NOW = () => 1_700_000_000_000;
const BASE = "https://ductura.test";

function me(body: unknown, init: { status?: number; type?: string } = {}): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "application/json" },
  })) as unknown as typeof fetch;
}

const PERSON = { institution: { slug: "demo-fakultet", displayName: "Izmišljeni fakultet" }, roles: ["student"], displayName: "Demo Student", sessionTag: TAG };

describe("journalScopeOf", () => {
  it("takes the own 64-character lower-case hex journalScope", () => {
    expect(journalScopeOf({ ...PERSON, journalScope: SCOPE })).toBe(SCOPE);
  });

  it.each([
    ["missing", PERSON],
    ["null", { ...PERSON, journalScope: null }],
    ["a number", { ...PERSON, journalScope: 42 }],
    ["empty", { ...PERSON, journalScope: "" }],
    ["too short", { ...PERSON, journalScope: "a".repeat(63) }],
    ["too long", { ...PERSON, journalScope: "a".repeat(65) }],
    ["upper case", { ...PERSON, journalScope: "A".repeat(64) }],
    ["not hex", { ...PERSON, journalScope: "g".repeat(64) }],
    ["padded", { ...PERSON, journalScope: ` ${SCOPE}` }],
    ["inherited", Object.create({ journalScope: SCOPE })],
    ["an array", [SCOPE]],
    ["not an object", SCOPE],
  ])("is null when it is %s", (_name, body) => {
    expect(journalScopeOf(body)).toBeNull();
  });
});

describe("sessionTagOf", () => {
  it.each([TAG, "f".repeat(64), "Zm9vYmFyLWl6bWlzbGplbm8=", "11111111-1111-4111-8111-111111111111"])("takes the own token %s", (tag) => {
    expect(sessionTagOf({ journalScope: SCOPE, sessionTag: tag })).toBe(tag);
  });

  it.each([
    ["missing", { journalScope: SCOPE }],
    ["null", { sessionTag: null }],
    ["a number", { sessionTag: 42 }],
    ["empty", { sessionTag: "" }],
    ["too short", { sessionTag: "a".repeat(15) }],
    ["too long", { sessionTag: "a".repeat(257) }],
    ["with a space", { sessionTag: "izmisljena sesija-1" }],
    ["with a semicolon", { sessionTag: "izmisljena;sesija-1" }],
    ["with a comma", { sessionTag: "izmisljena,sesija-1" }],
    ["with a quote", { sessionTag: 'izmisljena"sesija-1' }],
    ["inherited", Object.create({ sessionTag: TAG })],
    ["not an object", TAG],
  ])("is null when it is %s", (_name, body) => {
    expect(sessionTagOf(body)).toBeNull();
  });
});

describe("readJournalScope", () => {
  it("reads /api/v1/me with the session cookie", async () => {
    const transport = me({ ...PERSON, journalScope: SCOPE });
    expect(await readJournalScope({ baseUrl: BASE, transport, now: NOW })).toEqual({ kind: "scope", scope: SCOPE, session: { tag: TAG, at: NOW() } });
    const [url, init] = (transport as unknown as { mock: { calls: [URL, RequestInit][] } }).mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/me`);
    expect(init).toMatchObject({ method: "GET", credentials: "include", redirect: "manual" });
  });

  it("fails closed on a 200 without a valid sessionTag", async () => {
    const { sessionTag: _gone, ...untagged } = PERSON;
    expect(await readJournalScope({ baseUrl: BASE, transport: me({ ...untagged, journalScope: SCOPE }) })).toEqual({ kind: "noScope" });
    expect(await readJournalScope({ baseUrl: BASE, transport: me({ ...PERSON, journalScope: SCOPE, sessionTag: "kratko" }) })).toEqual({ kind: "noScope" });
  });

  it("fails closed on a 200 without a valid journalScope", async () => {
    expect(await readJournalScope({ baseUrl: BASE, transport: me(PERSON) })).toEqual({ kind: "noScope" });
    expect(await readJournalScope({ baseUrl: BASE, transport: me({ ...PERSON, journalScope: "x" }) })).toEqual({ kind: "noScope" });
  });

  it("401 is signed out; any other answer or a broken connection is unavailable", async () => {
    expect(await readJournalScope({ baseUrl: BASE, transport: me({}, { status: 401 }) })).toEqual({ kind: "signedOut" });
    expect(await readJournalScope({ baseUrl: BASE, transport: me({}, { status: 403 }) })).toEqual({ kind: "unavailable" });
    expect(await readJournalScope({ baseUrl: BASE, transport: me({ journalScope: SCOPE }, { type: "text/html" }) })).toEqual({ kind: "unavailable" });
    const broken = vi.fn(async () => { throw new TypeError("offline"); }) as unknown as typeof fetch;
    expect(await readJournalScope({ baseUrl: BASE, transport: broken })).toEqual({ kind: "unavailable", offline: true });
  });
});
