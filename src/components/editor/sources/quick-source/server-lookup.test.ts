// ED-14 (NF2-P7): "Brzi izvor" over the server. Only the identifier is sent; each answer of
// `sources.lookup.post` becomes one state the student can act on.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { createApi } from "@/client/api";

import { LookupInvalid, LookupOffline, lookupSource } from "./lookup";
import { quickSourceHr as t } from "./messages.hr";
import { createSourceLookup, draftOf } from "./server-lookup";

type Call = ReturnType<typeof createApi>;

function fakeCall(reply: () => unknown) {
  const sent: unknown[] = [];
  const call = (async (id: string, input: unknown) => {
    sent.push({ id, input });
    return reply();
  }) as unknown as Call;
  return { call, sent };
}

const article = {
  type: "article" as const, title: "Izmišljeni članak o čitanju naglas",
  authors: [{ name: "Horvat, Ivana", family: "Horvat", given: "Ivana" }],
  year: 2021, journal: "Izmišljeni časopis", volume: "12", issue: "3", pages: "45-60",
};

afterEach(() => vi.unstubAllGlobals());

describe("createSourceLookup", () => {
  it("sends only the normalised identifier and fills the form from the record", async () => {
    const { call, sent } = fakeCall(() => ({ ok: true, status: 200, body: { source: article } }));
    const outcome = await lookupSource("https://doi.org/10.1234/izmisljeno.2026.7", createSourceLookup(call));
    expect(sent).toEqual([{ id: "sources.lookup.post", input: { params: undefined, query: undefined, body: { kind: "doi", identifier: "10.1234/izmisljeno.2026.7" } } }]);
    expect(outcome).toEqual({ state: "found", draft: draftOf(article) });
    expect(draftOf(article)).toMatchObject({ type: "article", journal: "Izmišljeni časopis", volume: "12", authors: [{ kind: "person", family: "Horvat", given: "Ivana" }] });
  });

  it("maps null to not found, 422 to invalid, 503 and 408 to unavailable, a rejected request to offline", async () => {
    const run = (reply: () => unknown) => lookupSource("978-0-306-40615-7", createSourceLookup(fakeCall(reply).call));
    expect(await run(() => ({ ok: true, status: 200, body: { source: null } }))).toEqual({ state: "not_found" });
    expect(await run(() => ({ ok: false, status: 422, code: "invalid_input" }))).toEqual({ state: "invalid" });
    expect(await run(() => ({ ok: false, status: 503, code: "unavailable" }))).toEqual({ state: "unavailable" });
    expect(await run(() => ({ ok: false, status: 408, code: "timeout" }))).toEqual({ state: "unavailable" });
    expect(await run(() => { throw new TypeError("Failed to fetch"); })).toEqual({ state: "offline" });
    expect(await run(() => ({ ok: false, status: 500, code: "internal" }))).toEqual({ state: "failed" });
  });

  it("names people without family and given parts; a record without a type opens as a book", () => {
    expect(draftOf({ type: null, title: "Izmišljena knjiga", authors: [{ name: "Petar Novak" }, { name: "Platon" }], publisher: "Izmišljeni nakladnik" }))
      .toEqual({ type: "book", title: "Izmišljena knjiga", year: undefined, place: "", publisher: "Izmišljeni nakladnik",
        authors: [{ kind: "person", family: "Novak", given: "Petar" }, { kind: "person", family: "Platon", given: "" }] });
  });
});

describe("lookupSource states", () => {
  it("knows it is offline before asking and sends nothing", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    let calls = 0;
    expect(await lookupSource("10.1000/x.1", async () => { calls += 1; return { status: "not_found" }; })).toEqual({ state: "offline" });
    expect(calls).toBe(0);
  });

  it("maps the refusal and the missing network thrown by a lookup", async () => {
    expect(await lookupSource("10.1000/x.1", async () => { throw new LookupInvalid("invalid_input"); })).toEqual({ state: "invalid" });
    expect(await lookupSource("10.1000/x.1", async () => { throw new LookupOffline("network"); })).toEqual({ state: "offline" });
  });

  it("has a text for every state", () => {
    expect({ invalid: t.invalid, not_found: t.notFound, unavailable: t.unavailable, offline: t.offline, failed: t.failed }).toEqual({
      invalid: "Upišite DOI (npr. 10.1234/…) ili ISBN.",
      not_found: "Izvor nije pronađen, unesite ga ručno.",
      unavailable: "Dohvat podataka trenutačno nije dostupan. Izvor možete unijeti ručno.",
      offline: "Dohvat traži vezu s mrežom. Izvor možete unijeti ručno.",
      failed: "Dohvat podataka nije uspio. Pokušajte ponovno ili unesite izvor ručno.",
    });
  });
});
