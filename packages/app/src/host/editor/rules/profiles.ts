// WEB-2135: invented faculty profiles (owner decision 22. 11. 2026: UI with made-up profiles;
// the Lekta package stays "nedostupno" until Q-11). No real institution or person appears here.
export type AreaKey = "pri" | "teh" | "bm" | "bt" | "dru" | "hum" | "umj";
export type ToolKey = "formula" | "code" | "chem";
export type StyleKey = "fpzg" | "apa" | "chicago" | "ieee" | "vancouver" | "notes";
export type WorkKind = "graduate" | "final" | "doctoral" | "specialist" | "seminar" | "project" | "article";
export type ProfileStatus = "verified" | "partial" | "research" | "generic";

export type RuleProfile = {
  id: string;
  unitId: string;
  label: string;
  status: ProfileStatus;
  workType: WorkKind;
  verifiedAt?: string;
  /** Style named by the rule itself; absent = the area's usual one. */
  style?: StyleKey | "own";
  wordMin?: number;
  wordMax?: number;
  minRefs?: number;
  minBooks?: number;
  font?: string;
  size?: number;
  spacing?: number;
  sections: readonly string[];
  manualChecks: readonly { text: string; kind: "manual" | "export" | "info" }[];
  sources: readonly { t: string; u: string }[];
};

export type Unit = { id: string; name: string; area: AreaKey };

/** Order of the areas in the dialog. */
export const AREA_ORDER: readonly AreaKey[] = ["pri", "teh", "bm", "bt", "dru", "hum", "umj"];

/** Area defaults: tools, usual style and the abbreviation list (prototype faks.js AREAS). */
export const AREAS: Record<AreaKey, { tools: readonly ToolKey[]; style: StyleKey; abbr: boolean }> = {
  pri: { tools: ["formula", "code", "chem"], style: "apa", abbr: true },
  teh: { tools: ["formula", "code"], style: "ieee", abbr: true },
  bm: { tools: ["chem"], style: "vancouver", abbr: true },
  bt: { tools: ["formula", "chem"], style: "apa", abbr: true },
  dru: { tools: [], style: "apa", abbr: false },
  hum: { tools: [], style: "notes", abbr: false },
  umj: { tools: [], style: "chicago", abbr: false },
};

export const UNITS: readonly Unit[] = [
  { id: "pf", name: "Prirodoslovni fakultet Primjer", area: "pri" },
  { id: "tf", name: "Tehnički fakultet Primjer", area: "teh" },
  { id: "rf", name: "Fakultet računarstva Primjer", area: "teh" },
  { id: "mf", name: "Medicinski fakultet Primjer", area: "bm" },
  { id: "bf", name: "Biotehnički fakultet Primjer", area: "bt" },
  { id: "df", name: "Fakultet društvenih znanosti Primjer", area: "dru" },
  { id: "ef", name: "Ekonomski fakultet Primjer", area: "dru" },
  { id: "pr", name: "Pravni fakultet Primjer", area: "dru" },
  { id: "hf", name: "Filozofski fakultet Primjer", area: "hum" },
  { id: "af", name: "Akademija likovnih umjetnosti Primjer", area: "umj" },
];

/** Per-unit exceptions (prototype UX/UCITE): extra tools and a style the unit prescribes. */
export const UNIT_TOOLS: Record<string, readonly ToolKey[]> = { rf: ["code"], ef: ["formula"], tf: ["formula", "chem"] };

/** Per-study exceptions by the profile label (prototype PX): the first matching one wins. */
export const STUDY_RULES: readonly { match: RegExp; tools?: readonly ToolKey[]; style?: StyleKey }[] = [
  { match: /psiholog/, tools: ["formula"], style: "apa" },
  { match: /informat|racunar|računar/, tools: ["code"] },
  { match: /matemat|fizik|statist/, tools: ["formula"] },
  { match: /kemij|biokem/, tools: ["chem"] },
];

const SOURCE = [{ t: "Pravilnik o završnim radovima (izmišljeni primjer)", u: "https://example.org/pravilnik" }] as const;

function profile(p: Partial<RuleProfile> & Pick<RuleProfile, "id" | "unitId" | "label" | "workType">): RuleProfile {
  return {
    status: "partial", sections: [], manualChecks: [], sources: SOURCE, ...p,
  };
}

const FULL_SECTIONS = ["izjava", "sadržaj", "uvod", "zaključak", "literatura", "sažetak", "ključne riječi"] as const;
const FULL_CHECKS = [
  { text: "Naslovnica prema predlošku fakulteta", kind: "export" },
  { text: "Rimski i arapski brojevi stranica od Uvoda", kind: "export" },
  { text: "Tablice i slike imaju naslov i izvor", kind: "manual" },
  { text: "Upute mentora imaju prednost", kind: "info" },
] as const;

export const PROFILES: readonly RuleProfile[] = [
  profile({ id: "df-opci", unitId: "df", label: "Fakultet društvenih znanosti Primjer – opći akademski rad", workType: "seminar" }),
  profile({
    id: "df-diplomski", unitId: "df", label: "Fakultet društvenih znanosti Primjer – diplomski rad", workType: "graduate",
    status: "verified", verifiedAt: "2026-06-28", style: "apa", wordMin: 10000, wordMax: 12000, minRefs: 15, minBooks: 3,
    font: "Times New Roman", size: 12, spacing: 1.5, sections: FULL_SECTIONS, manualChecks: FULL_CHECKS,
  }),
  profile({ id: "df-zavrsni", unitId: "df", label: "Fakultet društvenih znanosti Primjer – završni rad", workType: "final", style: "apa", wordMin: 6000, wordMax: 8000, minRefs: 10, font: "Times New Roman", size: 12, spacing: 1.5, sections: FULL_SECTIONS }),
  profile({ id: "ef-zavrsni", unitId: "ef", label: "Ekonomski fakultet Primjer – završni rad", workType: "final", status: "verified", verifiedAt: "2026-07-02", style: "apa", wordMin: 7000, wordMax: 9000, minRefs: 12, font: "Arial", size: 11, spacing: 1.5, sections: FULL_SECTIONS, manualChecks: FULL_CHECKS }),
  profile({ id: "pr-seminar", unitId: "pr", label: "Pravni fakultet Primjer – seminarski rad", workType: "seminar", style: "notes", wordMin: 4000, wordMax: 6000, font: "Times New Roman", size: 12, spacing: 1.5 }),
  profile({ id: "pr-diplomski", unitId: "pr", label: "Pravni fakultet Primjer – diplomski rad", workType: "graduate", style: "own", wordMin: 12000, wordMax: 15000, minRefs: 20, font: "Times New Roman", size: 12, spacing: 1.5, sections: FULL_SECTIONS }),
  profile({ id: "hf-seminar", unitId: "hf", label: "Filozofski fakultet Primjer – seminarski rad", workType: "seminar", wordMin: 3000, wordMax: 5000 }),
  profile({ id: "hf-diplomski", unitId: "hf", label: "Filozofski fakultet Primjer – diplomski rad", workType: "graduate", status: "verified", verifiedAt: "2026-06-15", style: "notes", wordMin: 9000, wordMax: 12000, minRefs: 15, font: "Times New Roman", size: 12, spacing: 1.5, sections: FULL_SECTIONS, manualChecks: FULL_CHECKS }),
  profile({ id: "pf-zavrsni", unitId: "pf", label: "Prirodoslovni fakultet Primjer – završni rad", workType: "final", style: "apa", wordMin: 5000, wordMax: 7000, minRefs: 8, font: "Arial", size: 12, spacing: 1.5, sections: FULL_SECTIONS }),
  profile({ id: "pf-kemija", unitId: "pf", label: "Prirodoslovni fakultet Primjer – kemija, diplomski rad", workType: "graduate", wordMin: 8000, wordMax: 11000, minRefs: 15, font: "Arial", size: 12, spacing: 1.5 }),
  profile({ id: "tf-zavrsni", unitId: "tf", label: "Tehnički fakultet Primjer – završni rad", workType: "final", style: "ieee", wordMin: 5000, wordMax: 7000, minRefs: 10, font: "Arial", size: 12, spacing: 1.5 }),
  profile({ id: "rf-informatika", unitId: "rf", label: "Fakultet računarstva Primjer – informatika, diplomski rad", workType: "graduate", style: "ieee", wordMin: 8000, wordMax: 10000, minRefs: 15, font: "Arial", size: 12, spacing: 1.5 }),
  profile({ id: "mf-clanak", unitId: "mf", label: "Medicinski fakultet Primjer – članak", workType: "article", style: "vancouver", wordMin: 3000, wordMax: 4500, minRefs: 15 }),
  profile({ id: "mf-diplomski", unitId: "mf", label: "Medicinski fakultet Primjer – diplomski rad", workType: "graduate", style: "vancouver", wordMin: 8000, wordMax: 12000, minRefs: 20, font: "Times New Roman", size: 12, spacing: 1.5 }),
  profile({ id: "bf-projekt", unitId: "bf", label: "Biotehnički fakultet Primjer – projektni rad", workType: "project", wordMin: 4000, wordMax: 6000, minRefs: 8 }),
  profile({ id: "af-seminar", unitId: "af", label: "Akademija Primjer – seminarski rad", workType: "seminar", wordMin: 2500, wordMax: 4000 }),
];

/** The profile a work starts with when the assignment names none (prototype: the general academic work). */
export const DEFAULT_PROFILE_ID = "df-opci";

export const profilesOf = (unitId: string): readonly RuleProfile[] => PROFILES.filter((p) => p.unitId === unitId);
export const profileById = (id: string | null | undefined): RuleProfile | null => PROFILES.find((p) => p.id === id) ?? null;
export const unitById = (id: string): Unit | null => UNITS.find((u) => u.id === id) ?? null;
