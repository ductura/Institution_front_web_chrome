import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../src/client/api.ts";

import { LOCALE_KEY, readInterfaceLocale, readStoredLocale, saveInterfaceLocale, storeLocale, type LocaleCall } from "./interface-locale";

/** createApi over a transport that answers `status` with `body`, so the contract checks run as in the browser. */
function answering(status: number, body: unknown) {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  const api = createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: fetchImpl as unknown as typeof fetch });
  const call: LocaleCall = (id, input) => api(id, input as never) as ReturnType<LocaleCall>;
  return { call, fetchImpl };
}

describe("reading the saved interface language", () => {
  it.each([
    [{ locale: "en" }, { kind: "saved", locale: "en" }],
    [{ locale: "hr" }, { kind: "saved", locale: "hr" }],
    [{ locale: null }, { kind: "saved", locale: null }],
  ])("reads %j", async (body, read) => {
    const { call, fetchImpl } = answering(200, body);
    expect(await readInterfaceLocale(call)).toEqual(read);
    expect(String((fetchImpl.mock.calls as unknown as [string][])[0]?.[0])).toBe("http://127.0.0.1:1/api/v1/profile/interface-locale");
  });

  it("does not take a body the contract does not declare", async () => {
    expect(await readInterfaceLocale(answering(200, { locale: "de" }).call)).toEqual({ kind: "unavailable" });
    expect(await readInterfaceLocale(answering(200, { locale: "en", extra: 1 }).call)).toEqual({ kind: "unavailable" });
  });

  it("tells a signed-out caller from an unavailable server", async () => {
    expect(await readInterfaceLocale(answering(401, { error: "unauthorized" }).call)).toEqual({ kind: "signedOut" });
    expect(await readInterfaceLocale(answering(503, { error: "unavailable" }).call)).toEqual({ kind: "unavailable" });
  });

  it("reads a transport that throws as unavailable", async () => {
    const call: LocaleCall = async () => { throw new TypeError("offline"); };
    expect(await readInterfaceLocale(call)).toEqual({ kind: "unavailable" });
  });
});

describe("saving the interface language", () => {
  it("posts only the locale and takes the saved value", async () => {
    const { call, fetchImpl } = answering(200, { locale: "en" });
    expect(await saveInterfaceLocale(call, "en")).toEqual({ kind: "saved", locale: "en" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"locale":"en"}');
  });

  it("does not report a save the server did not confirm", async () => {
    expect(await saveInterfaceLocale(answering(200, { locale: null }).call, "en")).toEqual({ kind: "failed" });
    expect(await saveInterfaceLocale(answering(503, { error: "unavailable" }).call, "en")).toEqual({ kind: "failed" });
    expect(await saveInterfaceLocale(answering(401, { error: "unauthorized" }).call, "hr")).toEqual({ kind: "signedOut" });
  });

  it("never sends a value outside the contract", async () => {
    const { call, fetchImpl } = answering(200, { locale: "en" });
    expect(await saveInterfaceLocale(call, "de" as "en")).toEqual({ kind: "failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("the browser's copy", () => {
  const store = () => {
    const map = new Map<string, string>();
    return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
  };

  it("keeps and reads a language", () => {
    const s = store();
    storeLocale(s, "en");
    expect(s.map.get(LOCALE_KEY)).toBe("en");
    expect(readStoredLocale(s)).toBe("en");
  });

  it("reads anything else, a missing store or a blocked one as nothing", () => {
    const s = store();
    s.map.set(LOCALE_KEY, "de");
    expect(readStoredLocale(s)).toBeNull();
    expect(readStoredLocale(undefined)).toBeNull();
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readStoredLocale(blocked)).toBeNull();
    expect(() => storeLocale(blocked, "hr")).not.toThrow();
  });
});
