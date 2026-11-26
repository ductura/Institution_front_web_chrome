import { describe, expect, it, vi } from "vitest";

import { checkConfig, configChanges, draftOf, newestOf, publishConfig, readConfig, type ConfigVersion } from "./config";
import { configMessages as t } from "./messages.config.hr";

const baseUrl = "https://ductura.example.invalid";
const version = (n: number, languages: ("hr" | "en")[] = ["hr"], def: "hr" | "en" = "hr"): ConfigVersion => ({
  version: n, effectiveFrom: "2026-10-01T10:00:00.000Z", rules: { citationStyle: "fpzg", workLanguages: languages, defaultWorkLanguage: def },
});
const err = (status: number, code: string) => Response.json({ error: code, code, messageKey: `errors.${code}`, status }, { status });

describe("postavke ustanove: čitanje", () => {
  it("čita verziju na snazi i povijest s /api/v1 kroz zajednički klijent", async () => {
    const body = { current: version(2), versions: [version(1), version(2)] };
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(body));
    await expect(readConfig({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "ready", ...body });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(new URL("/api/v1/institution/config", baseUrl), expect.objectContaining({ method: "GET" }));
  });
  it("ustanova bez objavljene verzije vraća current null", async () => {
    await expect(readConfig({ baseUrl, fetchImpl: async () => Response.json({ current: null, versions: [] }) })).resolves.toEqual({ kind: "ready", current: null, versions: [] });
  });
  it.each([401, 403])("odgovor %s znači da stranicu ne vidi", async (status) => {
    await expect(readConfig({ baseUrl, fetchImpl: async () => err(status, status === 401 ? "unauthorized" : "forbidden") })).resolves.toEqual({ kind: "denied" });
  });
  it("odgovor izvan ugovora i prekid mreže nisu prazan popis", async () => {
    await expect(readConfig({ baseUrl, fetchImpl: async () => Response.json({ current: null, versions: [], extra: 1 }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readConfig({ baseUrl, fetchImpl: async () => err(503, "unavailable") })).resolves.toEqual({ kind: "unavailable" });
    await expect(readConfig({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("postavke ustanove: verzije i razlika", () => {
  it("verzija na snazi je najnovija bez obzira na redoslijed", () => {
    expect(newestOf([version(3), version(1), version(2)])?.version).toBe(3);
    expect(newestOf([])).toBeNull();
  });
  it("razlika sadrži samo promijenjena polja, neovisno o redoslijedu jezika", () => {
    const cur = version(2, ["hr", "en"], "hr");
    expect(configChanges(cur, { workLanguages: ["en", "hr"], defaultWorkLanguage: "hr" })).toEqual([]);
    expect(configChanges(cur, { workLanguages: ["en"], defaultWorkLanguage: "en" }).map((c) => c.field)).toEqual(["workLanguages", "defaultWorkLanguage"]);
  });
  it("bez verzije oba su polja nova", () => {
    expect(configChanges(null, draftOf(null)).map((c) => c.field)).toEqual(["workLanguages", "defaultWorkLanguage"]);
  });
  it("provjera prije slanja odbija prazan popis jezika i zadani jezik izvan popisa", () => {
    expect(checkConfig({ workLanguages: [], defaultWorkLanguage: "hr" }, t)).toEqual({ workLanguages: t.languagesNeeded });
    expect(checkConfig({ workLanguages: ["hr"], defaultWorkLanguage: "en" }, t)).toEqual({ defaultWorkLanguage: t.defaultNotChosen });
    expect(checkConfig({ workLanguages: ["hr", "en"], defaultWorkLanguage: "en" }, t)).toEqual({});
  });
});

describe("postavke ustanove: objava", () => {
  const send = (response: () => Response, basedOn: number | null = 2) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response());
    return { fetchImpl, run: () => publishConfig(basedOn, { workLanguages: ["en", "hr"], defaultWorkLanguage: "en" }, t.invalid, { baseUrl, fetchImpl }) };
  };
  it("šalje zatvoreno tijelo s očekivanom verzijom i vraća broj nove verzije", async () => {
    const { fetchImpl, run } = send(() => Response.json(version(3, ["hr", "en"], "en"), { status: 201 }));
    await expect(run()).resolves.toEqual({ kind: "published", version: 3 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/institution/config/versions`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ expectedVersion: 2, citationStyle: "fpzg", workLanguages: ["hr", "en"], defaultWorkLanguage: "en" });
  });
  it("prva objava šalje expectedVersion 0", async () => {
    const { fetchImpl, run } = send(() => Response.json(version(1), { status: 201 }), null);
    await run();
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)).expectedVersion).toBe(0);
  });
  it.each([
    [422, "invalid_input", "invalid"], [409, "conflict", "stale"], [403, "forbidden", "denied"], [401, "unauthorized", "denied"], [503, "unavailable", "unavailable"],
  ] as const)("odgovor %s", async (status, code, kind) => {
    const { run } = send(() => err(status, code));
    const result = await run();
    expect(result.kind).toBe(kind);
  });
  it("nečitljiv odgovor (status 0) nije odbijanje vrijednosti nego nepotvrđena objava", async () => {
    const { run } = send(() => new Response("{", { status: 201 }));
    await expect(run()).resolves.toEqual({ kind: "unavailable" });
  });
  it("prekid mreže nije objava", async () => {
    const fetchImpl = async () => { throw new Error("offline"); };
    await expect(publishConfig(1, draftOf(version(1)), t.invalid, { baseUrl, fetchImpl })).resolves.toEqual({ kind: "unavailable" });
  });
});
