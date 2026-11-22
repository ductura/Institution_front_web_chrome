// WEB-2135: pure model of the "Zahtjevi rada" list and of the faculty set-up (prototype rules.js, faks.js).
import { fill, rulesHr as t } from "./messages.hr";
import {
  AREAS, STUDY_RULES, UNIT_TOOLS, UNITS, profilesOf, unitById,
  type AreaKey, type RuleProfile, type StyleKey, type ToolKey, type Unit,
} from "./profiles";

export type RuleGroup = "auto" | "manual" | "duct" | "export" | "info";
export type RuleState = "ok" | "todo" | "waiting" | "tick" | "note";
export type RuleItem = { key: string; group: RuleGroup; title: string; detail: string; state: RuleState };

/** What the editor knows about the text; absent until the work is read (the list then says "Čeka tekst rada."). */
export type WorkStats = {
  words: number;
  references: number;
  books: number;
  chapters: Readonly<Record<string, number>>;
};

export type StyleSource = "rule" | "own" | "area" | "study";
export type FacultySetup = { area: AreaKey; tools: readonly ToolKey[]; style: StyleKey; source: StyleSource; abbr: boolean };

const normal = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** The three layers: area → tools, faculty → style and format, study → exception (prototype `setup`). */
export function setupOf(profile: RuleProfile): FacultySetup {
  const unit = unitById(profile.unitId);
  const area: AreaKey = unit?.area ?? "dru";
  const base = AREAS[area];
  const study = STUDY_RULES.find((r) => r.match.test(normal(profile.label)));
  const tools = new Set<ToolKey>([...base.tools, ...(UNIT_TOOLS[profile.unitId] ?? []), ...(study?.tools ?? [])]);
  const named = profile.style && profile.style !== "own" ? profile.style : null;
  const style = named ?? study?.style ?? base.style;
  const source: StyleSource = named ? "rule" : profile.style === "own" ? "own" : study?.style ? "study" : "area";
  return { area, tools: [...tools], style, source, abbr: base.abbr };
}

export const toolsText = (tools: readonly ToolKey[]) => (tools.length === 0 ? t.faculty.noTools : tools.map((k) => t.tools[k]).join(", "));
export const kindText = (profile: RuleProfile) => t.kind[profile.workType];

/** "Opseg: X do Y riječi" or the "teacher sets it" line. */
export function scopeText(profile: RuleProfile): string {
  const { wordMin: min, wordMax: max } = profile;
  if (min !== undefined && max !== undefined) return fill(t.items.scope.range, { min, max });
  if (min !== undefined) return fill(t.items.scope.min, { min });
  return t.items.scope.teacher;
}

const chapterItem = (name: string, key: string, stats: WorkStats | null): RuleItem => {
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  const words = stats?.chapters[key];
  if (!stats) return { key, group: "auto", title, detail: t.list.waiting, state: "waiting" };
  if (words === undefined) return { key, group: "auto", title, detail: t.items.chapter.missing, state: "todo" };
  if (words === 0) return { key, group: "auto", title, detail: t.items.chapter.empty, state: "todo" };
  return { key, group: "auto", title, detail: fill(t.items.chapter.words, { n: words }), state: "ok" };
};

const EXPORT_PARTS: Record<string, { t: string; d: string }> = {
  izjava: t.items.declaration, "sadržaj": t.items.toc, naslovnica: t.items.cover,
};
const CHAPTER_PARTS = new Set(["uvod", "zaključak"]);

/** The list for one profile. Pure: the same profile and stats give the same items in the same order. */
export function itemsOf(profile: RuleProfile, stats: WorkStats | null): RuleItem[] {
  const out: RuleItem[] = [];
  const hasScope = profile.wordMin !== undefined;
  out.push({
    key: "scope", group: hasScope ? "auto" : "info", title: scopeText(profile),
    detail: stats && hasScope ? fill(t.items.scope.now, { n: stats.words }) : hasScope ? t.list.waiting : "",
    state: !hasScope ? "note" : !stats ? "waiting" : stats.words >= (profile.wordMin ?? 0) && stats.words <= (profile.wordMax ?? Infinity) ? "ok" : "todo",
  });
  if (profile.minRefs !== undefined) {
    out.push({
      key: "refs", group: "auto", title: fill(t.items.minRefs, { n: profile.minRefs }),
      detail: stats ? fill(t.items.cited, { n: stats.references }) : t.list.waiting,
      state: !stats ? "waiting" : stats.references >= profile.minRefs ? "ok" : "todo",
    });
  }
  if (profile.minBooks !== undefined) {
    out.push({
      key: "books", group: "auto", title: fill(t.items.minBooks, { n: profile.minBooks }),
      detail: stats ? fill(t.items.cited, { n: stats.books }) : t.list.waiting,
      state: !stats ? "waiting" : stats.books >= profile.minBooks ? "ok" : "todo",
    });
  }
  for (const section of profile.sections) {
    const part = EXPORT_PARTS[section];
    if (part) {
      out.push({ key: `section:${section}`, group: "export", title: part.t, detail: part.d, state: "note" });
    } else if (CHAPTER_PARTS.has(section)) {
      out.push(chapterItem(section, section, stats));
    } else if (section === "literatura") {
      out.push({ key: "section:literatura", group: "export", title: t.items.bibliography.t, detail: t.items.bibliography.d, state: "note" });
    } else {
      out.push({ key: `section:${section}`, group: "manual", title: section.charAt(0).toUpperCase() + section.slice(1), detail: t.items.manualPart, state: "tick" });
    }
  }
  for (const check of profile.manualChecks) {
    out.push({
      key: `check:${check.text}`, group: check.kind, title: check.text, detail: "",
      state: check.kind === "manual" ? "tick" : "note",
    });
  }
  if (profile.font && profile.size && profile.spacing) {
    out.push({
      key: "typography", group: "export", title: t.items.typography.t, state: "note",
      detail: fill(t.items.typography.d, { font: profile.font, size: profile.size, spacing: String(profile.spacing).replace(".", ",") }),
    });
  }
  const setup = setupOf(profile);
  out.push({
    key: "style", group: "export", title: fill(t.items.citeStyle.t, { name: t.styles[setup.style] }), state: "note",
    detail: setup.source === "own" ? t.items.citeStyle.custom : t.items.citeStyle.d,
  });
  t.items.duct.forEach((d, i) => out.push({ key: `duct:${i}`, group: "duct", title: d.t, detail: d.d, state: "note" }));
  return out;
}

/** Ticks are the student's own marks, per profile: `{ profileId: { key: true } }`. */
export type Ticks = Readonly<Record<string, Readonly<Record<string, boolean>>>>;

/** An item counts as "u redu" when ok or ticked; "za riješiti" when todo or an unticked manual item is not counted. */
export function countsOf(items: readonly RuleItem[], ticked: Readonly<Record<string, boolean>>) {
  const todo = items.filter((i) => i.state === "todo").length;
  const manualOpen = items.filter((i) => i.state === "tick" && !ticked[i.key]).length;
  const ok = items.filter((i) => i.state === "ok" || (i.state === "tick" && ticked[i.key])).length;
  return { todo, manualOpen, ok };
}

export function cardLine(items: readonly RuleItem[], ticked: Readonly<Record<string, boolean>>): string {
  const { todo, manualOpen, ok } = countsOf(items, ticked);
  const parts = [todo > 0 ? fill(t.card.todo, { n: todo }) : t.card.allDone];
  if (manualOpen > 0) parts.push(fill(t.card.manual, { n: manualOpen }));
  if (ok > 0) parts.push(fill(t.card.ok, { n: ok }));
  return parts.join(" · ");
}

export function toggleTick(ticks: Ticks, profileId: string, key: string): Ticks {
  const mine = ticks[profileId] ?? {};
  return { ...ticks, [profileId]: { ...mine, [key]: !mine[key] } };
}

/** Faculties filtered by the search text (diacritics and case ignored), grouped by area in the fixed order. */
export function unitsByArea(query: string, order: readonly AreaKey[]): { area: AreaKey; units: Unit[] }[] {
  const q = normal(query.trim());
  return order
    .map((area) => ({ area, units: UNITS.filter((u) => u.area === area && (q === "" || normal(u.name).includes(q))) }))
    .filter((g) => g.units.length > 0);
}

/** Style of a unit's first profile for the table; `star` when the faculty did not prescribe it. */
export function tableRow(unit: Unit): { tools: string; style: string; star: boolean; profiles: number } {
  const profiles = profilesOf(unit.id);
  const first = profiles[0];
  const setup = first ? setupOf(first) : null;
  return {
    tools: toolsText(setup?.tools ?? AREAS[unit.area].tools),
    style: t.styles[setup?.style ?? AREAS[unit.area].style],
    star: setup ? setup.source !== "rule" : true,
    profiles: profiles.length,
  };
}

export const GROUP_ORDER: readonly RuleGroup[] = ["auto", "manual", "duct", "export", "info"];
