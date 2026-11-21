import { describe, expect, it, vi } from "vitest";

import { changesOf, checkDraft, currentOf, draftOf, publishRule, readRules, type RuleRow, type RuleVersion } from "./rules";
import { rulesMessages as t } from "./messages.hr";

const baseUrl = "https://ductura.example.invalid";
const version = (versionNo: number, over: Partial<RuleVersion> = {}): RuleVersion => ({
  versionNo, aiPolicy: "prohibited", aiPurposes: [], evidenceProfile: "basic", importAllowed: false,
  origin: "operator", publishedAt: "2026-10-01T10:00:00.000Z", ...over,
});
const demo: { rules: RuleRow[] } = { rules: [{ workType: "essay", versions: [version(1), version(2, { aiPolicy: "partially_allowed", aiPurposes: ["formatting"] })] }] };
const draft = draftOf(version(2, { aiPolicy: "partially_allowed", aiPurposes: ["formatting"] }));

describe("pravila fakulteta: čitanje", () => {
  it("čita pravila s /api/v1 kroz zajednički klijent", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(demo));
    await expect(readRules({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "ready", rules: demo.rules });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      new URL("/api/v1/institution/faculty-rules", baseUrl), expect.objectContaining({ method: "GET" }),
    );
  });
  it.each([401, 403])("odgovor %s znači da stranicu ne vidi", async (status) => {
    const fetchImpl = async () => Response.json({ error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status }, { status });
    await expect(readRules({ baseUrl, fetchImpl })).resolves.toEqual({ kind: "denied" });
  });
  it("odbija odgovor izvan ugovora i prekid mreže", async () => {
    await expect(readRules({ baseUrl, fetchImpl: async () => Response.json({ rules: [], extra: 1 }) })).resolves.toEqual({ kind: "unavailable" });
    await expect(readRules({ baseUrl, fetchImpl: async () => { throw new Error("offline"); } })).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("pravila fakulteta: verzije i razlika", () => {
  it("verzija na snazi je najnovija, bez obzira na redoslijed", () => {
    expect(currentOf({ workType: "essay", versions: [version(3), version(1), version(2)] })?.versionNo).toBe(3);
    expect(currentOf({ workType: "essay", versions: [] })).toBeNull();
  });
  it("razlika sadrži samo promijenjena polja, uz staru i novu vrijednost", () => {
    const next = { ...draft, evidenceProfile: "extended" as const, importAllowed: true };
    expect(changesOf(version(2, { ...draft, aiPurposes: [...draft.aiPurposes] }), next)).toEqual([
      { field: "evidenceProfile", before: "basic", after: "extended" },
      { field: "importAllowed", before: false, after: true },
    ]);
  });
  it("razlika ne ovisi o redoslijedu odabranih uporaba, a nepromijenjen obrazac nema razlike", () => {
    const two = { ...draft, aiPurposes: ["translation", "formatting"] as const };
    const cur = version(2, { aiPolicy: "partially_allowed", aiPurposes: ["formatting", "translation"] });
    expect(changesOf(cur, two)).toEqual([]);
  });
  it("bez ijedne verzije svako polje je novo", () => {
    expect(changesOf(null, draftOf(null)).map((c) => c.field)).toEqual(["aiPolicy", "aiPurposes", "evidenceProfile", "importAllowed"]);
  });
  it("provjera prije slanja odbija uporabe uz zabranu i prazan popis uz djelomično dopuštenje", () => {
    expect(checkDraft({ ...draft, aiPolicy: "prohibited" }, t).aiPurposes).toBe(t.purposesWithProhibited);
    expect(checkDraft({ ...draft, aiPurposes: [] }, t).aiPurposes).toBe(t.purposesNeeded);
    expect(checkDraft(draft, t)).toEqual({});
  });
});

describe("pravila fakulteta: objava", () => {
  const send = (status: number, body: unknown) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(body, { status }));
    return { fetchImpl, run: () => publishRule("essay", 2, { ...draft, importAllowed: true }, { invalid: t.invalid, fields: t.invalidFields }, { baseUrl, fetchImpl }) };
  };
  it("šalje zatvoreno tijelo s osnovnom verzijom i vraća broj nove verzije", async () => {
    const { fetchImpl, run } = send(201, { versionNo: 3, publishedAt: "2026-11-21T09:00:00.000Z" });
    await expect(run()).resolves.toEqual({ kind: "published", versionNo: 3 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/institution/faculty-rules`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      workType: "essay", basedOnVersionNo: 2, aiPolicy: "partially_allowed", aiPurposes: ["formatting"], evidenceProfile: "basic", importAllowed: true,
    });
  });
  it("422 se prikazuje uz polje koje poslužitelj imenuje", async () => {
    const { run } = send(422, { error: "invalid_ai_purposes", code: "invalid_ai_purposes", messageKey: "errors.invalid_ai_purposes", status: 422 });
    await expect(run()).resolves.toEqual({ kind: "invalid", errors: { aiPurposes: t.invalidFields.aiPurposes } });
  });
  it("422 bez imena polja ide na obrazac", async () => {
    const { run } = send(422, { error: "invalid_input", code: "invalid_input", messageKey: "errors.invalid_input", status: 422 });
    await expect(run()).resolves.toEqual({ kind: "invalid", errors: { form: t.invalid } });
  });
  it.each([
    [409, "conflict", "stale"], [403, "forbidden", "denied"], [401, "unauthorized", "denied"], [503, "unavailable", "unavailable"],
  ] as const)("odgovor %s", async (status, code, kind) => {
    const { run } = send(status, { error: code, code, messageKey: `errors.${code}`, status });
    await expect(run()).resolves.toEqual({ kind });
  });
});
