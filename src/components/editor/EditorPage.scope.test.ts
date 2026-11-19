import { describe, expect, it, vi } from "vitest";

import { journalScopeOf, readJournalScope } from "./EditorPage.scope";

// WEB-14c: the journal scope is the person's `journalScope` from /api/v1/me
// (SRV-JS). Invented bodies only; no real request is made.
const SCOPE = "a".repeat(64);
const BASE = "https://ductura.test";

function me(body: unknown, init: { status?: number; type?: string } = {}): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "application/json" },
  })) as unknown as typeof fetch;
}

const PERSON = { institution: { slug: "demo-fakultet", displayName: "Izmišljeni fakultet" }, roles: ["student"], displayName: "Demo Student" };

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

describe("readJournalScope", () => {
  it("reads /api/v1/me with the session cookie", async () => {
    const transport = me({ ...PERSON, journalScope: SCOPE });
    expect(await readJournalScope({ baseUrl: BASE, transport })).toEqual({ kind: "scope", scope: SCOPE });
    const [url, init] = (transport as unknown as { mock: { calls: [URL, RequestInit][] } }).mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/me`);
    expect(init).toMatchObject({ method: "GET", credentials: "include", redirect: "manual" });
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
    expect(await readJournalScope({ baseUrl: BASE, transport: broken })).toEqual({ kind: "unavailable" });
  });
});
