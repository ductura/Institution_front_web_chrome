import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { PAGES, resolve } from "../../../routes";
import { myRightsMessages } from "../../public/my-rights/messages.hr";
import { facultySettingsMessages as t } from "./messages.hr";
import { WORK_TYPES, assistantRows, summariseRetention, summariseRules, summariseThresholds } from "./read";

const v = (versionNo: number, publishedAt: string, over = {}) => ({
  versionNo, aiPolicy: "prohibited" as const, aiPurposes: [] as never[], evidenceProfile: "basic" as const, importAllowed: false,
  origin: "administrator" as const, publishedAt, ...over,
});

describe("Postavke fakulteta: sažeci", () => {
  it("pravila: broji vrste s pravilom i uzima zadnju promjenu preko svih vrsta", () => {
    const sum = summariseRules([
      { workType: "essay", versions: [v(1, "2026-10-01T10:00:00.000Z"), v(2, "2026-10-05T10:00:00.000Z")] },
      { workType: "short_paper", versions: [v(1, "2026-11-01T10:00:00.000Z", { origin: "operator" })] },
      { workType: "seminar_paper", versions: [] },
    ]);
    expect(sum).toMatchObject({ published: 2, total: 7 });
    expect(sum.latest?.publishedAt).toBe("2026-11-01T10:00:00.000Z");
    expect(sum.latest?.origin).toBe("operator");
    expect(summariseRules([]).latest).toBeNull();
  });
  it("pragovi i čuvanje: broje upisano i određeno, rok koji čeka odluku se vidi", () => {
    expect(summariseThresholds([{ origin: "typed", thresholdPercent: 10, strictness: "soft" }])).toEqual({ set: 1, total: 6 });
    expect(summariseThresholds([]).set).toBe(0);
    const row = (retentionDays: number | null) => ({ key: "sessions", retentionDays, mode: "dry_run", candidates: null, lastRunAt: null }) as never;
    expect(summariseRetention([row(30), row(null)])).toEqual({ decided: 1, total: 2, awaiting: true });
    expect(summariseRetention([row(30)]).awaiting).toBe(false);
  });
  it("asistent: jedan redak po vrsti rada, bez pravila označeno null", () => {
    const rows = assistantRows([{ workType: "essay", versions: [v(1, "2026-10-01T10:00:00.000Z"), v(3, "2026-10-09T10:00:00.000Z", { aiPolicy: "encouraged" })] }]);
    expect(rows.map((r) => r.workType)).toEqual([...WORK_TYPES]);
    expect(rows.find((r) => r.workType === "essay")?.version?.aiPolicy).toBe("encouraged");
    expect(rows.find((r) => r.workType === "master_thesis")?.version).toBeNull();
  });
});

describe("Postavke fakulteta: rute i tekst", () => {
  it("samo administrator vidi postavke i asistenta, a „Moja prava” svaki prijavljeni račun", () => {
    for (const path of ["/ustanova/postavke", "/ustanova/postavke/asistent"]) {
      const page = PAGES.find((p) => p.path === path)!;
      expect(resolve(path, "admin")).toEqual({ kind: "page", page });
      expect(resolve(path, "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
      expect(resolve(path, "student")).toEqual({ kind: "redirect", to: "/zadaci" });
    }
    for (const role of ["admin", "teacher", "student"] as const) expect(resolve("/moja-prava", role).kind).toBe("page");
  });
  it("ne sadrži zabranjene izraze ni ime pružatelja ili modela", () => {
    const flat = (value: unknown): string[] =>
      typeof value === "string" ? [value] : typeof value === "function" ? flat((value as (...a: number[]) => unknown)(1, 7)) : Array.isArray(value) ? value.flatMap(flat)
        : value !== null && typeof value === "object" ? Object.values(value).flatMap(flat) : [];
    for (const text of [...flat(t), ...flat(myRightsMessages)]) {
      expect({ text, terms: findForbiddenTerms(text) }).toEqual({ text, terms: [] });
      expect(text).not.toMatch(/openai|gpt|claude|anthropic|gemini|llama|mistral/i);
    }
  });
  it("asistent je u tekstu isključen, a „Moja prava” kaže da čeka pravni pregled", () => {
    expect(t.assistant.off).toBe("Asistent je isključen");
    expect(myRightsMessages.pendingReview).toContain("pravni pregled");
  });
});
